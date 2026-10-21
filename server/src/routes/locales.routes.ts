// src/routes/user.routes.ts
import { Router } from "express";
import {
  addlocale,
  getlocals,
  editlocale,
} from "../controllers/locales.controller";

const router = Router();

router.post("/add", addlocale);
router.get("/list", getlocals);
router.put("/edit/:id", editlocale);

export default router;
