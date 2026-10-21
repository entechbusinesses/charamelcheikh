import { Router } from "express";
import {
  addReception,
  deleteReception,
  getReceptions,
  getReceptionsItems,
} from "../controllers/reception.controller";

const router = Router();

router.post("/add", addReception);
router.get("/list", getReceptions);
router.get("/items", getReceptionsItems);
router.delete("/remove/:id", deleteReception);

export default router;
