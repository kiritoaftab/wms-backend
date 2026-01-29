import express from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import roleRoutes from "./roleRoutes.js";
import moduleRoutes from "./moduleRoutes.js";
import permissionRoutes from "./permissionRoutes.js";
import userRoleRoutes from "./userRoleRoutes.js";

const router = express.Router();

// API routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/modules", moduleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/user-roles", userRoleRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "WMS Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
