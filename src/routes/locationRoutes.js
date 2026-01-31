import express from "express";
import {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationStats,
  getLocationsByZone,
  bulkCreateLocations,
} from "../controllers/locationController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all locations (with filters, pagination)
router.get("/", authorize("WAREHOUSE", "READ"), getAllLocations);

// Get location capacity stats by warehouse
router.get("/stats", authorize("WAREHOUSE", "READ"), getLocationStats);

// Get locations grouped by zone
router.get("/by-zone", authorize("WAREHOUSE", "READ"), getLocationsByZone);

// Get location by ID (with inventory details)
router.get("/:id", authorize("WAREHOUSE", "READ"), getLocationById);

// Create location
router.post("/", authorize("WAREHOUSE", "CREATE"), createLocation);

// Bulk create locations
router.post("/bulk", authorize("WAREHOUSE", "CREATE"), bulkCreateLocations);

// Update location
router.put("/:id", authorize("WAREHOUSE", "UPDATE"), updateLocation);

// Delete location (soft delete)
router.delete("/:id", authorize("WAREHOUSE", "DELETE"), deleteLocation);

export default router;
