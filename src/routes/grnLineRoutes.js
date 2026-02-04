import express from "express";
import {
  getGRNLineById,
  updateGRNLine,
  getSuggestedLocation,
  bulkUpdateGRNLines,
  getAllGRNLines,
} from "../controllers/grnLineController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get("/", authorize("WAREHOUSE", "READ"), getAllGRNLines);

// Get GRN Line by ID
router.get("/:id", authorize("WAREHOUSE", "READ"), getGRNLineById);

// Get suggested putaway location for a GRN Line
router.get(
  "/:id/suggest-location",
  authorize("WAREHOUSE", "READ"),
  getSuggestedLocation,
);

// Update GRN Line (mainly for location updates)
router.put("/:id", authorize("WAREHOUSE", "UPDATE"), updateGRNLine);

// Bulk update multiple GRN Lines
router.put(
  "/bulk/update",
  authorize("WAREHOUSE", "UPDATE"),
  bulkUpdateGRNLines,
);

export default router;
