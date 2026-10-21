// src/routes/user.routes.ts
import { Router } from "express";
import {
  addTotalDay,
  editTotalDay,
  getAllTotalDays,
  getTotalDay,
} from "../controllers/totalday.controller";

const router = Router();

router.get("/", getTotalDay);
router.post("/add", addTotalDay);
router.get("/list", getAllTotalDays);
router.put("/update", editTotalDay);

export default router;
