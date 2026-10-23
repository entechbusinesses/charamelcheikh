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
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.get("/list", StatsList);
router.get("/items/:stat_id", getStatItems);
router.post("/add", AddToStats);
// tickets can only be edited / deleted by admins (cashiers have read-only access)
router.post("/add_item", requireAdmin, UpdateStat);
router.delete("/delete/:id", requireAdmin, deleteSale);
router.delete("/delete_item", requireAdmin, deleteSaleItem);
router.put("/update_quantity", requireAdmin, handleChangeQuantity);
router.get("/all_products_services", fetchAllProdsServices);
router.get("/report", SalesStats);
router.get("/dashboard", DashboardStats);

export default router;
