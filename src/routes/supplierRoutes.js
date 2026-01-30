import express from "express";
import {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../controllers/supplierController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all suppliers
router.get("/", authorize("SUPPLIERS", "READ"), getAllSuppliers);

// Get supplier by ID
router.get("/:id", authorize("SUPPLIERS", "READ"), getSupplierById);

// Create supplier
router.post("/", authorize("SUPPLIERS", "CREATE"), createSupplier);

// Update supplier
router.put("/:id", authorize("SUPPLIERS", "UPDATE"), updateSupplier);

// Delete supplier
router.delete("/:id", authorize("SUPPLIERS", "DELETE"), deleteSupplier);

export default router;
