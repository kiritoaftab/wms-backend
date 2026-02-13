import express from "express";
import {
  getAllCarriers,
  getCarrierById,
  createCarrier,
  updateCarrier,
  deleteCarrier,
} from "../controllers/carrierController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all carriers
router.get("/", authorize("CARRIERS", "READ"), getAllCarriers);

// Get carrier by ID
router.get("/:id", authorize("CARRIERS", "READ"), getCarrierById);

// Create carrier
router.post("/", authorize("CARRIERS", "CREATE"), createCarrier);

// Update carrier
router.put("/:id", authorize("CARRIERS", "UPDATE"), updateCarrier);

// Delete carrier
router.delete("/:id", authorize("CARRIERS", "DELETE"), deleteCarrier);

export default router;
