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
router.get("/stats", authorize("ASN", "READ"), getASNStats);

// Get all ASNs
router.get("/", authorize("ASN", "READ"), getAllASNs);

// Get ASN by ID
router.get("/:id", authorize("ASN", "READ"), getASNById);

// Create ASN
router.post("/", authorize("ASN", "CREATE"), createASN);

// Update ASN
router.put("/:id", authorize("ASN", "UPDATE"), updateASN);

// Confirm ASN
router.post("/:id/confirm", authorize("ASN", "UPDATE"), confirmASN);

// Start receiving
router.post("/:id/start-receiving", authorize("ASN", "UPDATE"), startReceiving);

// Cancel ASN
router.delete("/:id", authorize("ASN", "DELETE"), cancelASN);

export default router;
