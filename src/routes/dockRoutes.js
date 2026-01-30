import express from "express";
import {
  getAllDocks,
  getDockById,
  createDock,
  updateDock,
  deleteDock,
} from "../controllers/dockController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all docks (optionally filter by warehouse_id)
router.get("/", authorize("WAREHOUSE", "READ"), getAllDocks);

// Get dock by ID
router.get("/:id", authorize("WAREHOUSE", "READ"), getDockById);

// Create dock
router.post("/", authorize("WAREHOUSE", "CREATE"), createDock);

// Update dock
router.put("/:id", authorize("WAREHOUSE", "UPDATE"), updateDock);

// Delete dock
router.delete("/:id", authorize("WAREHOUSE", "DELETE"), deleteDock);

export default router;
