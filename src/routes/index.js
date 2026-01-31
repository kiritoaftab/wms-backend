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

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "WMS Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
