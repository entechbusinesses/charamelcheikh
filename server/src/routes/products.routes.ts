import { Router } from "express";
import {
  addProduct,
  editProduct,
  getproducts,
  getTotalArticles,
  toggleHideProduct,
} from "../controllers/products.controller";

const router = Router();

router.post("/add", addProduct);
router.get("/list", getproducts);
router.get("/total-articles", getTotalArticles);
router.put("/edit/:id", editProduct);
router.put("/toggleHide/:id", toggleHideProduct);

export default router;
