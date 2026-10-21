import { Request, Response } from "express";
import { prisma } from "../app";
import { isPushEnabled, sendToAdmin } from "../services/push.service";

// Role from the database, not the session: the session keeps the role from login time
// (up to 24h), so an account promoted to ADMIN would otherwise be refused notifications.
const isActiveAdmin = async (userId: number) => {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, banned: true },
  });
  return row?.role === "ADMIN" && !row.banned;
};

// Saves (or re-links) this device's FCM token to the logged-in admin.
// For any other role the token is removed, so a shared device stops getting admin notifications.
export const registerToken = async (req: Request, res: Response): Promise<void> => {
  const user = req.session.user;
  const { token } = req.body;
  if (!user) {
    res.status(401).json({ error: "No active session." });
    return;
  }
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" });
    return;
  }

  try {
    if (!(await isActiveAdmin(user.id))) {
      await prisma.pushToken.deleteMany({ where: { token } });
      res.status(403).json({ error: "Notifications are reserved for admins" });
      return;
    }

    await prisma.pushToken.upsert({
      where: { token },
      create: { token, user_id: user.id },
      update: { user_id: user.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to save push token:", error);
    res.status(500).json({ error: "Failed to save push token" });
  }
};

export const unregisterToken = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  try {
    await prisma.pushToken.deleteMany({ where: { token } });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete push token:", error);
    res.status(500).json({ error: "Failed to delete push token" });
  }
};

// Sends a test notification to the logged-in admin's devices
export const sendTest = async (req: Request, res: Response): Promise<void> => {
  const user = req.session.user;
  if (!user) {
    res.status(401).json({ error: "No active session." });
    return;
  }
  if (!(await isActiveAdmin(user.id))) {
    res.status(403).json({ error: "Notifications are reserved for admins" });
    return;
  }
  if (!isPushEnabled()) {
    res.status(503).json({ error: "Firebase n'est pas configuré sur le serveur" });
    return;
  }

  try {
    const result = await sendToAdmin(user.id, {
      title: "Charam El Cheikh",
      body: `Bonjour ${user.name}, les notifications fonctionnent ✅`,
      url: "/",
    });
    res.json(result);
  } catch (error) {
    console.error("Failed to send test push:", error);
    res.status(500).json({ error: "Failed to send test push" });
  }
};
