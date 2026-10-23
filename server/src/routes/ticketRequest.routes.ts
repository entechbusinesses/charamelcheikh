import { Router } from "express";
import {
  createTicketRequest,
  listTicketRequests,
  reviewTicketRequest,
} from "../controllers/ticketRequest.controller";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

// cashiers ask, admins validate or refuse
router.get("/", listTicketRequests);
router.post("/", createTicketRequest);
router.post("/:id/review", requireAdmin, reviewTicketRequest);

export default router;
