import { Router } from "express";
import {
  closeShift,
  getCurrentShift,
  listShifts,
  startShift,
} from "../controllers/shift.controller";

const router = Router();

router.get("/current", getCurrentShift);
router.post("/start", startShift);
router.post("/close", closeShift);
router.get("/list", listShifts);

export default router;
