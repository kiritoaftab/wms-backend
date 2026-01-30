import express from "express";
import {
  getAllASNs,
  getASNById,
  createASN,
  updateASN,
  confirmASN,
  startReceiving,
  cancelASN,
  getASNStats,
} from "../controllers/asnController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get ASN statistics
router.get("/stats", authorize("INBOUND", "READ"), getASNStats);

// Get all ASNs
router.get("/", authorize("INBOUND", "READ"), getAllASNs);

// Get ASN by ID
router.get("/:id", authorize("INBOUND", "READ"), getASNById);

// Create ASN
router.post("/", authorize("INBOUND", "CREATE"), createASN);

// Update ASN
router.put("/:id", authorize("INBOUND", "UPDATE"), updateASN);

// Confirm ASN
router.post("/:id/confirm", authorize("INBOUND", "UPDATE"), confirmASN);

// Start receiving
router.post(
  "/:id/start-receiving",
  authorize("INBOUND", "UPDATE"),
  startReceiving,
);
// Cancel ASN
router.delete("/:id", authorize("INBOUND", "DELETE"), cancelASN);

export default router;
