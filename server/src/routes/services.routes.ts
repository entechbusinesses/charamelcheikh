// src/routes/user.routes.ts
import { Router } from "express";
import {
  addservice,
  editservice,
  getservices,
  toggleHide,
  deleteservice,
} from "../controllers/services.controller";

const router = Router();

router.post("/add", addservice);
router.get("/list", getservices);
router.put("/edit/:id", editservice);
router.delete("/delete/:id", deleteservice);
router.put("/toggleHide/:id", toggleHide);

export default router;
