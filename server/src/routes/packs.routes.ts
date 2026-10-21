import { Router } from "express";
import {
  addPack,
  deletePack,
  editPack,
  getPacks,
  toggleHidePack,
} from "../controllers/packs.controller";

const router = Router();

router.post("/add", addPack);
router.get("/list", getPacks);
router.put("/edit/:id", editPack);
router.put("/toggleHide/:id", toggleHidePack);
router.delete("/delete/:id", deletePack);

export default router;
