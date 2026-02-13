import express from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import roleRoutes from "./roleRoutes.js";
import moduleRoutes from "./moduleRoutes.js";
import permissionRoutes from "./permissionRoutes.js";
import userRoleRoutes from "./userRoleRoutes.js";

import warehouseRoutes from "./warehouseRoutes.js";
import clientRoutes from "./clientRoutes.js";
import supplierRoutes from "./supplierRoutes.js";
import dockRoutes from "./dockRoutes.js";
import skuRoutes from "./skuRoutes.js";
import asnRoutes from "./asnRoutes.js";
import asnLineRoutes from "./asnLineRoutes.js";
import palletRoutes from "./palletRoutes.js";
import grnRoutes from "./grnRoutes.js";
import grnLineRoutes from "./grnLineRoutes.js";
import locationRoutes from "./locationRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";
import inventoryHoldRoutes from "./inventoryHoldRoutes.js";

// Outbound routes
import salesOrderRoutes from "./salesOrderRoutes.js";
import salesOrderLineRoutes from "./salesOrderLineRoutes.js";
import stockAllocationRoutes from "./stockAllocationRoutes.js";
import pickWaveRoutes from "./pickWaveRoutes.js";
import pickTaskRoutes from "./pickTaskRoutes.js";
import carrierRoutes from "./carrierRoutes.js";
import packingRoutes from "./packingRoutes.js";

const router = express.Router();

// API routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/modules", moduleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/user-roles", userRoleRoutes);
router.use("/warehouses", warehouseRoutes);
router.use("/clients", clientRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/docks", dockRoutes);
router.use("/skus", skuRoutes);
router.use("/asns", asnRoutes);
router.use("/asn-lines", asnLineRoutes);
router.use("/pallets", palletRoutes);
router.use("/grns", grnRoutes);
router.use("/grn-lines", grnLineRoutes);
router.use("/locations", locationRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/inventory-holds", inventoryHoldRoutes);

// Outbound operations
router.use("/sales-orders", salesOrderRoutes);
router.use("/sales-order-lines", salesOrderLineRoutes);
router.use("/stock-allocations", stockAllocationRoutes);
router.use("/pick-waves", pickWaveRoutes);
router.use("/pick-tasks", pickTaskRoutes);
router.use("/carriers", carrierRoutes);
router.use("/packing", packingRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "WMS Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
