import express from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  confirmOrder,
  cancelOrder,
  getOrderStats,
  getOutboundSummary,
} from "../controllers/salesOrderController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Statistics
router.get("/stats", getOrderStats);
router.get("/outbound-summary", getOutboundSummary);

// CRUD operations
router.post("/", createOrder);
router.get("/", getAllOrders);
router.get("/:id", getOrderById);
router.put("/:id", updateOrder);

// Order actions
router.post("/:id/confirm", confirmOrder);
router.delete("/:id/cancel", cancelOrder);

export default router;
