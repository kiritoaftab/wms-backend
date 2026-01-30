import express from "express";
import {
  getAllSKUs,
  getSKUById,
  createSKU,
  updateSKU,
  deleteSKU,
} from "../controllers/skuController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all SKUs (supports pagination, client_id filter, search)
router.get("/", authorize("INVENTORY", "READ"), getAllSKUs);

// Get SKU by ID
router.get("/:id", authorize("INVENTORY", "READ"), getSKUById);

// Create SKU
router.post("/", authorize("INVENTORY", "CREATE"), createSKU);

// Update SKU
router.put("/:id", authorize("INVENTORY", "UPDATE"), updateSKU);

// Delete SKU
router.delete("/:id", authorize("INVENTORY", "DELETE"), deleteSKU);

export default router;
