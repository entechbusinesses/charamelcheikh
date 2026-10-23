import { NextFunction, Request, Response } from "express";
import { prisma } from "../app";

// Role from the database, not the session: the session keeps the role from login
// time (up to 24h), so a demoted admin would otherwise keep write access.
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ message: "Session expirée" });
    return;
  }

  try {
    const row = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true, banned: true },
    });
    if (row?.role !== "ADMIN" || row.banned) {
      res.status(403).json({ message: "Action réservée aux administrateurs" });
      return;
    }
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to check role", error });
  }
};
