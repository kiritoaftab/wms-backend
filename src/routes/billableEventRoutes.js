import express from "express";
import {
  getAllBillableEvents,
  getSummary,
  getBillableEventById,
  updateBillableEvent,
  createManualEvent,
  voidBillableEvent,
} from "../controllers/billableEventController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

// Static routes — must be declared before /:id to avoid Express treating
// "summary" and "manual" as ID parameters.
router.get("/summary", authorize("BILLING", "READ"), getSummary);
router.post("/manual", authorize("BILLING", "CREATE"), createManualEvent);

// Parameterized routes
router.get("/", authorize("BILLING", "READ"), getAllBillableEvents);
router.get("/:id", authorize("BILLING", "READ"), getBillableEventById);
router.put("/:id", authorize("BILLING", "UPDATE"), updateBillableEvent);
router.post("/:id/void", authorize("BILLING", "UPDATE"), voidBillableEvent);

export default router;
