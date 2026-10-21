// src/routes/user.routes.ts
import { Router } from "express";
import {
  editUser,
  getUsers,
  loginUser,
  logoutUser,
  me,
  registerUser,
  toggleBan,
} from "../controllers/user.controller";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/check", me);
router.post("/logout", logoutUser);
router.get("/list", getUsers);
router.put("/edit/:id", editUser);
router.put("/toggleBan/:id", toggleBan);

export default router;
