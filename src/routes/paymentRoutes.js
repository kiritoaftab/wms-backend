import express from "express";
import {
  listPayments,
  getPayment,
  recordPayment,
  confirmPayment,
  reversePayment,
  getAgingReport,
} from "../controllers/paymentController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

// Static routes before /:id
router.get("/aging", authorize("BILLING", "READ"), getAgingReport);
router.get("/", authorize("BILLING", "READ"), listPayments);
router.post("/", authorize("BILLING", "CREATE"), recordPayment);
router.get("/:id", authorize("BILLING", "READ"), getPayment);
router.post("/:id/confirm", authorize("BILLING", "UPDATE"), confirmPayment);
router.post("/:id/reverse", authorize("BILLING", "UPDATE"), reversePayment);

export default router;
