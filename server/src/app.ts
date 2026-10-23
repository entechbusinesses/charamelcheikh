import express, { Application } from "express";
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import session from "express-session";
import cors from "cors";
import { map } from "./data/data";
import path from "path";
import fs from "fs";
import PrismaSessionStore from "./prismaSessionStore";

const app: Application = express();
const prisma = new PrismaClient();

app.set("trust proxy", 1);

app.use(cookieParser());

app.use(
  cors({
    credentials: true,
    origin: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "",
    resave: false,
    saveUninitialized: true,
    store: new PrismaSessionStore(),
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

map.forEach((value) => {
  app.use(`/api${value.path}`, value.element);
});

// Multer saves files to "./uploads/..." relative to the working directory, so
// serve them from the same place (server/ in dev, the app root on Hostinger)
const uploadsDir = path.resolve("uploads");
["categories", "locals_logo", "products", "services"].forEach((dir) =>
  fs.mkdirSync(path.join(uploadsDir, dir), { recursive: true })
);
app.use("/api/uploads", express.static(uploadsDir));

app.use(express.static(path.join(__dirname, "../client")));

app.get("*", (req, res) => {
  const htmlFile = path.join(__dirname, "../client/index.html");
  res.sendFile(htmlFile);
});

export { app, prisma };
