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
router.get("/asn/:asnId", authorize("ASN", "READ"), getLinesByASN);

// Add line to ASN
router.post("/", authorize("ASN", "CREATE"), addLineToASN);

// Update ASN line
router.put("/:id", authorize("ASN", "UPDATE"), updateASNLine);

// Delete ASN line
router.delete("/:id", authorize("ASN", "DELETE"), deleteASNLine);

export default router;
