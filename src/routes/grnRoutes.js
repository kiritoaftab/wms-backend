import express from "express";
import {
  getAllGRNs,
  getGRNById,
  postGRNFromASN,
  assignPutawayTask,
  completePutawayTask,
} from "../controllers/grnController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all GRNs
router.get("/", authorize("GRN", "READ"), getAllGRNs);

// Get GRN by ID
router.get("/:id", authorize("GRN", "READ"), getGRNById);

// Post GRN from ASN (single atomic operation: creates + posts GRN)
router.post("/post-from-asn", authorize("GRN", "CREATE"), postGRNFromASN);

// Assign putaway task
router.post("/assign-putaway", authorize("GRN", "UPDATE"), assignPutawayTask);

// Complete putaway task
router.post("/:lineId/complete-putaway", authorize("GRN", "UPDATE"), completePutawayTask);

export default router;
