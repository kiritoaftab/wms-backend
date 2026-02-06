import express from "express";
import {
  getOrderAllocations,
  getAllAllocations,
  getAllocationById,
  manualAllocate,
  releaseSingleAllocation,
  releaseOrderAllAllocations,
  getAllocationStats,
} from "../controllers/stockAllocationController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Statistics
router.get("/stats", getAllocationStats);

// Get allocations
router.get("/", getAllAllocations);
router.get("/order/:orderId", getOrderAllocations);
router.get("/:id", getAllocationById);

// Allocation actions
router.post("/allocate", manualAllocate);
router.post("/:id/release", releaseSingleAllocation);
router.post("/order/:orderId/release-all", releaseOrderAllAllocations);

export default router;
