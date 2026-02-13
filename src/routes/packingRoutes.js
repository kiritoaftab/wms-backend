import express from "express";
import {
  startPacking,
  createCarton,
  addItemToCarton,
  removeItemFromCarton,
  closeCarton,
  finalizePacking,
  getOrderCartons,
} from "../controllers/packingController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get cartons for order
router.get("/:orderId/cartons", authorize("ORDERS", "READ"), getOrderCartons);

// Start packing
router.post("/:orderId/start", authorize("ORDERS", "UPDATE"), startPacking);

// Create carton
router.post("/:orderId/cartons", authorize("ORDERS", "UPDATE"), createCarton);

// Add item to carton
router.post(
  "/:orderId/cartons/:cartonId/items",
  authorize("ORDERS", "UPDATE"),
  addItemToCarton,
);

// Remove item from carton
router.delete(
  "/:orderId/cartons/:cartonId/items/:itemId",
  authorize("ORDERS", "DELETE"),
  removeItemFromCarton,
);

// Close carton
router.put(
  "/:orderId/cartons/:cartonId/close",
  authorize("ORDERS", "UPDATE"),
  closeCarton,
);

// Finalize packing
router.post(
  "/:orderId/finalize",
  authorize("ORDERS", "UPDATE"),
  finalizePacking,
);

export default router;
