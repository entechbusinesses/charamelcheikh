// sales routes
import { Router } from "express";
import {
  AddToStats,
  deleteSale,
  deleteSaleItem,
  fetchAllProdsServices,
  getStatItems,
  handleChangeQuantity,
  SalesStats,
  StatsList,
  UpdateStat,
} from "../controllers/stats.controller";
import { DashboardStats } from "../controllers/dashboard.controller";

const router = Router();

router.get("/list", StatsList);
router.get("/items/:stat_id", getStatItems);
router.post("/add", AddToStats);
router.post("/add_item", UpdateStat);
router.delete("/delete/:id", deleteSale);
router.delete("/delete_item", deleteSaleItem);
router.put("/update_quantity", handleChangeQuantity);
router.get("/all_products_services", fetchAllProdsServices);
router.get("/report", SalesStats);
router.get("/dashboard", DashboardStats);

export default router;
