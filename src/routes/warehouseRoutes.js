import express from "express";
import {
  getAllWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../controllers/warehouseController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all warehouses
router.get("/", authorize("WAREHOUSE", "READ"), getAllWarehouses);

// Get warehouse by ID
router.get("/:id", authorize("WAREHOUSE", "READ"), getWarehouseById);

// Create warehouse
router.post("/", authorize("WAREHOUSE", "CREATE"), createWarehouse);

// Update warehouse
router.put("/:id", authorize("WAREHOUSE", "UPDATE"), updateWarehouse);

// Delete warehouse
router.delete("/:id", authorize("WAREHOUSE", "DELETE"), deleteWarehouse);

export default router;
