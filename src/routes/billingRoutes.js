import express from "express";
import {
  runBilling,
  previewBilling,
  getReadyToInvoice,
} from "../controllers/billingController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

// Static routes first
router.get("/ready-to-invoice", authorize("BILLING", "READ"), getReadyToInvoice);
router.post("/preview", authorize("BILLING", "READ"), previewBilling);
router.post("/run", authorize("BILLING", "CREATE"), runBilling);

export default router;
