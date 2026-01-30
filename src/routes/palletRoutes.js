import express from "express";
import {
  getAllPallets,
  getPalletById,
  createPallet,
  updatePalletLocation,
  deletePallet,
} from "../controllers/palletController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all pallets
router.get("/", authorize("PALLET", "READ"), getAllPallets);

// Get pallet by ID
router.get("/:id", authorize("PALLET", "READ"), getPalletById);

// Create pallet
router.post("/", authorize("PALLET", "CREATE"), createPallet);

// Update pallet location
router.put("/:id", authorize("PALLET", "UPDATE"), updatePalletLocation);

// Delete pallet
router.delete("/:id", authorize("PALLET", "DELETE"), deletePallet);

export default router;
