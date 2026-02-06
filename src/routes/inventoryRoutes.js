import express from "express";
import {
  getAllInventory,
  getInventoryById,
  getInventoryBySKU,
  getInventoryByLocation,
  getInventorySummary,
  adjustStock,
  transferStock,
  getInventoryTransactions,
  groupInventoryBySKU,
  groupInventoryByZone,
} from "../controllers/inventoryController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get inventory summary/dashboard
router.get("/summary", getInventorySummary);

// Get inventory by SKU
router.get("/sku/:sku_id", getInventoryBySKU);

// Get inventory by location
router.get("/location/:location_id", getInventoryByLocation);

// Get transaction history
router.get("/transactions", getInventoryTransactions);

// Group inventory by SKU (for reporting)
router.get("/group-by-sku", groupInventoryBySKU);

router.get("/group-by-zone", groupInventoryByZone);

// Get all inventory (with filters)
router.get("/", getAllInventory);

// Get single inventory record
router.get("/:id", getInventoryById);

// Stock adjustment
router.post("/adjust", adjustStock);

// Stock transfer
router.post("/transfer", transferStock);

export default router;
