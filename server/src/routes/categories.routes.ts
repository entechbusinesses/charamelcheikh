// src/routes/user.routes.ts
import { Router } from "express";
import {
  addCategory,
  editCategory,
  getcategories,
  toggleHideCategory,
} from "../controllers/categories.controller";

const router = Router();

router.post("/add", addCategory);
router.get("/list", getcategories);
router.put("/edit/:id", editCategory);
router.put("/toggleHide/:id", toggleHideCategory);

export default router;
