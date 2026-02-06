import express from "express";
import {
  getOrderLines,
  getOrderLineById,
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
} from "../controllers/salesOrderLineController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get lines for an order
router.get("/order/:orderId", getOrderLines);

// CRUD operations
router.post("/", addOrderLine);
router.get("/:id", getOrderLineById);
router.put("/:id", updateOrderLine);
router.delete("/:id", deleteOrderLine);

export default router;
