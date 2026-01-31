import express from "express";
import {
  createHold,
  releaseHold,
  getAllHolds,
  getHoldById,
  getHoldStats,
  updateHold,
  deleteHold,
} from "../controllers/inventoryHoldController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get hold statistics
router.get("/stats", getHoldStats);

// Get all holds (with filters)
router.get("/", getAllHolds);

// Get single hold
router.get("/:id", getHoldById);

// Create new hold
router.post("/", createHold);

// Release hold
router.post("/:id/release", releaseHold);

// Update hold
router.put("/:id", updateHold);

// Delete hold (only if released)
router.delete("/:id", deleteHold);

export default router;
