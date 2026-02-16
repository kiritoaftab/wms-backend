import express from "express";
import {
  createShipment,
  dispatchShipment,
  getShipments,
  getShipmentById,
} from "../controllers/shippingController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// List shipments (with filters)
router.get("/", authorize("SHIPPINGS", "READ"), getShipments);

// Get shipment details
router.get("/:shipmentId", authorize("SHIPPINGS", "READ"), getShipmentById);

// Create shipment for order
router.post(
  "/:orderId/create",
  authorize("SHIPPINGS", "UPDATE"),
  createShipment,
);

// Dispatch shipment
router.post(
  "/:shipmentId/dispatch",
  authorize("SHIPPINGS", "UPDATE"),
  dispatchShipment,
);

export default router;
