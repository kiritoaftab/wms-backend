import express from "express";
import {
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
} from "../controllers/permissionController.js";
import { authenticate, hasRole } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all permissions - accessible to all authenticated users
router.get("/", getAllPermissions);

// Get permission by ID
router.get("/:id", getPermissionById);

// Create permission - Admin only
router.post("/", hasRole("ADMIN"), createPermission);

// Update permission - Admin only
router.put("/:id", hasRole("ADMIN"), updatePermission);

// Delete permission - Admin only
router.delete("/:id", hasRole("ADMIN"), deletePermission);

export default router;
