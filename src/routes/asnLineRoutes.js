import express from "express";
import {
  addLineToASN,
  updateASNLine,
  deleteASNLine,
  getLinesByASN,
} from "../controllers/asnLineController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get lines by ASN ID
router.get("/asn/:asnId", authorize("INBOUND", "READ"), getLinesByASN);

// Add line to ASN
router.post("/", authorize("INBOUND", "CREATE"), addLineToASN);

// Update ASN line
router.put("/:id", authorize("INBOUND", "UPDATE"), updateASNLine);

// Delete ASN line
router.delete("/:id", authorize("INBOUND", "DELETE"), deleteASNLine);

export default router;
