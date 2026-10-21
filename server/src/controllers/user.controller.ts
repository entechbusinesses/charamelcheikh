import { Request, Response } from "express";
import { prisma } from "../app";
import { PDVTypes } from "@prisma/client";

declare module "express-session" {
  interface SessionData {
    user?: {
      name: string;
      id: number;
      role: string;
      local: { name: string; type: PDVTypes; id: number } | null;
    };
  }
}

export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { password, name, role, local_id } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { password },
    });
    if (existingUser) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const newUser = await prisma.user.create({
      data: {
        password,
        name,
        role,
        local_id: +local_id,
      },
    });

    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Failed to register user", error });
    console.log(error);
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { password },
      include: { local: true },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        msg: "Mot de passe Incorrect",
      });
      return;
    }

    // Store user info in the session
    req.session.user = {
      id: user.id,
      name: user.name,
      role: user.role,
      local: user.local,
    };

    res.json({
      message: "Login successful",
      // Same shape as /auth/check, so the UI has the name and local right after login
      user: { id: user.id, role: user.role, name: user.name, local: user.local },
    });
  } catch (error) {
    console.error("Failed to log in:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  if (!req.session.user) {
    res.status(401).json({ error: "No active session." });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.user.id },
      select: { role: true, name: true, local: true, id: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error("Failed to fetch user details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const password = req.query.password === "true";
  const typeCaissier = req.query.type === "caissier";
  const typeAdmin = req.query.type === "admin";

  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: typeCaissier
            ? ["CAISSIER"]
            : typeAdmin
            ? ["ADMIN"]
            : ["ADMIN", "CAISSIER"],
        },
      },
      select: {
        local: true,
        password,
        name: true,
        createdAt: true,
        role: true,
        id: true,
      },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to see users" });
  }
};

export const editUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, role, local_id, password } = req.body;

  try {
    // Empty password means "keep the current one"
    const newPassword =
      typeof password === "string" && password.trim() !== ""
        ? password
        : undefined;

    if (newPassword) {
      const existingUser = await prisma.user.findUnique({
        where: { password: newPassword },
      });
      if (existingUser && existingUser.id !== +id) {
        res.status(400).json({ error: "Password already used by another user" });
        return;
      }
    }

    await prisma.user.update({
      where: { id: +id },
      data: {
        name,
        role,
        local_id: +local_id,
        ...(newPassword && { password: newPassword }),
      },
    });

    res.send("edited-success");
  } catch (error) {
    res.status(500).json({ error: "Failed to see users" });
  }
};

export const toggleBan = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { banned } = req.body;

  try {
    await prisma.user.update({
      where: { id: +id },
      data: { banned },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to see users" });
  }
};

export const logoutUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Failed to destroy session:", err);
      res.status(500).json({ error: "Failed to log out" });
      return;
    }
    res.json({ message: "Logged out successfully" });
  });
};
