import express from "express";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  sendInvoice,
  voidInvoice,
} from "../controllers/invoiceController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

// Static action routes before /:id
router.get("/", authorize("BILLING", "READ"), listInvoices);
router.post("/", authorize("BILLING", "CREATE"), createInvoice);
router.get("/:id", authorize("BILLING", "READ"), getInvoice);
router.put("/:id", authorize("BILLING", "UPDATE"), updateInvoice);
router.post("/:id/send", authorize("BILLING", "UPDATE"), sendInvoice);
router.post("/:id/void", authorize("BILLING", "UPDATE"), voidInvoice);

export default router;
