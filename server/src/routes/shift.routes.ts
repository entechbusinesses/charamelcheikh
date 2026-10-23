import { Router } from "express";
import {
  closeShift,
  getCurrentShift,
  getCurrentShiftDetails,
  getShiftSales,
  listShifts,
  startShift,
} from "../controllers/shift.controller";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.get("/current", getCurrentShift);
router.get("/current/details", getCurrentShiftDetails);
router.post("/start", startShift);
router.post("/close", closeShift);
// shifts history is reserved to admins (cashiers only see their current shift)
router.get("/list", requireAdmin, listShifts);
// cashiers can open the tickets of their own shifts (checked in the controller)
router.get("/:id/sales", getShiftSales);

export default router;
