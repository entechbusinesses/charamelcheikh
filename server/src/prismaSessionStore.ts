import { PrismaClient } from "@prisma/client";
import session, { SessionData } from "express-session";

const prisma = new PrismaClient();

class PrismaSessionStore extends session.Store {
  constructor() {
    super();
  }

  async get(
    sid: string,
    callback: (err: any, session?: SessionData | null) => void
  ) {
    try {
      const sessionRecord = await prisma.session.findUnique({ where: { sid } });
      if (!sessionRecord) return callback(null, null);

      const sessionData: SessionData = JSON.parse(sessionRecord.data);
      callback(null, sessionData);
    } catch (err) {
      callback(err);
    }
  }

  async set(
    sid: string,
    sessionData: SessionData,
    callback?: (err?: any) => void
  ) {
    try {
      const data = JSON.stringify(sessionData || "{}");
      const expiresAt = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(Date.now() + 86400000); // fallback 1 day

      await prisma.session.upsert({
        where: { sid },
        update: { data, expiresAt },
        create: { sid, data, expiresAt },
      });

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await prisma.session.delete({ where: { sid } });
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}

export default PrismaSessionStore;
