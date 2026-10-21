import { Router } from "express";
import {
  registerToken,
  sendTest,
  unregisterToken,
} from "../controllers/notifications.controller";

const router = Router();

router.post("/register", registerToken);
router.post("/unregister", unregisterToken);
router.post("/test", sendTest);

export default router;
