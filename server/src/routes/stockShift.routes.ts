import { Router } from "express";
import {
  closeStockShift,
  deleteStockShift,
  listStockShifts,
  previewStockShift,
  startStockShift,
} from "../controllers/stockShift.controller";

const router = Router();

router.get("/list", listStockShifts);
router.post("/start", startStockShift);
router.get("/:id/preview", previewStockShift);
router.post("/:id/close", closeStockShift);
router.delete("/:id", deleteStockShift);

export default router;
