// Firebase Cloud Messaging (free) — sends push notifications to the PWA.
// Needs the Firebase Admin private key: Firebase console → Project settings →
// Service accounts → "Generate new private key", saved as
// server/firebase-service-account.json (or set FIREBASE_SERVICE_ACCOUNT_PATH).
import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { prisma } from "../app";

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // page opened when the notification is clicked
  icon?: string;
  tag?: string; // same tag replaces the previous notification
};

let messaging: Messaging | null | undefined;

const getFcm = (): Messaging | null => {
  if (messaging !== undefined) return messaging;

  const keyPath = path.resolve(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, "../../firebase-service-account.json")
  );
  if (!fs.existsSync(keyPath)) {
    console.warn(`[push] Firebase key not found at ${keyPath} — push disabled`);
    messaging = null;
    return messaging;
  }

  const app =
    getApps()[0] ||
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });
  messaging = getMessaging(app);
  return messaging;
};

export const isPushEnabled = () => getFcm() !== null;

// Sends to the given tokens; removes tokens Firebase reports as dead.
const sendToTokens = async (tokens: string[], payload: PushPayload) => {
  const fcm = getFcm();
  if (!fcm || tokens.length === 0) return { sent: 0, failed: 0 };

  // Data-only message: public/serviceworker.js builds the notification itself.
  const data: Record<string, string> = {
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
  };
  if (payload.icon) data.icon = payload.icon;
  if (payload.tag) data.tag = payload.tag;

  let sent = 0;
  let failed = 0;
  // FCM accepts at most 500 tokens per multicast
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const res = await fcm.sendEachForMulticast({
      tokens: batch,
      data,
      webpush: { headers: { Urgency: "high" } },
    });
    sent += res.successCount;
    failed += res.failureCount;

    const dead = batch.filter((_, idx) => {
      const code = res.responses[idx].error?.code;
      return (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      );
    });
    if (dead.length) {
      await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    }
  }
  return { sent, failed };
};

// Notifications are for admins only: every send is limited to ADMIN users' devices.
export const sendToAdmins = async (payload: PushPayload) => {
  const rows = await prisma.pushToken.findMany({
    where: { user: { role: "ADMIN", banned: false } },
    select: { token: true },
  });
  return sendToTokens(rows.map((r) => r.token), payload);
};

// One specific admin (e.g. the test button); ignored for non-admin users
export const sendToAdmin = async (userId: number, payload: PushPayload) => {
  const rows = await prisma.pushToken.findMany({
    where: { user_id: userId, user: { role: "ADMIN", banned: false } },
    select: { token: true },
  });
  return sendToTokens(rows.map((r) => r.token), payload);
};
