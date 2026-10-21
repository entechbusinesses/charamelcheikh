import { Request, Response } from "express";
import { prisma } from "../app";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/locals_logo/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
}).single("local_pic");

export const addlocale = async (req: Request, res: Response): Promise<void> => {
  upload(req, res, async (err) => {
    const { name, type } = req.body;

    let local_pic = null;
    if (req.file) {
      local_pic = `/uploads/locals_logo/${req.file.filename}`;
    }

    if (type !== "BELDI" && type !== "TURKI" && type !== "DEPOT") {
      res
        .status(401)
        .json({ message: "Local adding faild because of invalid type!" });
      return;
    }
    try {
      const data = await prisma.locals.create({
        data: { type, name, logo_url: local_pic },
      });

      res.status(201).json({ message: "Local registered successfully", data });
    } catch (error) {
      res.status(500).json({ message: "Failed to add locale", error });
    }
  });
};

export const getlocals = async (req: Request, res: Response): Promise<void> => {
  let { users, count, depot } = req.query;

  const withUsers = users === "true";
  const userCount = count === "true";
  const withDepot = depot === "true";

  try {
    const data = await prisma.locals.findMany({
      // Only count users: counting every relation hits tables that may not exist yet (e.g. StockHistory)
      include: {
        users: withUsers,
        _count: userCount ? { select: { users: true } } : false,
      },
      where: {
        type: {
          in: withDepot ? ["BELDI", "TURKI", "DEPOT"] : ["BELDI", "TURKI"],
        },
      },
    });

    res.status(201).json({ message: "Local shown successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to get locales", error });
  }
};

export const editlocale = async (
  req: Request,
  res: Response
): Promise<void> => {
  upload(req, res, async (err) => {
    const { name, type } = req.body;
    const { id } = req.params;

    let local_pic = null;
    if (req.file) {
      local_pic = `/uploads/locals_logo/${req.file.filename}`;
    }
    try {
      const data = await prisma.locals.update({
        data: {
          type,
          name,
          logo_url: local_pic,
        },
        where: { id: +id },
        include: { _count: { select: { users: true } } },
      });

      res.status(201).json({ message: "Local edited successfully", data });
    } catch (error) {
      res.status(500).json({ message: "Failed to edit local", error });
    }
  });
};
