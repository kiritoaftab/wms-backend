import express from "express";
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignPermission,
  removePermission,
} from "../controllers/roleController.js";
import { authenticate, authorize, hasRole } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all roles
router.get("/", authorize("USER_MANAGEMENT", "READ"), getAllRoles);

// Get role by ID with permissions
router.get("/:id", authorize("USER_MANAGEMENT", "READ"), getRoleById);

// Create role - Admin only
router.post("/", hasRole("ADMIN"), createRole);

// Update role - Admin only
router.put("/:id", hasRole("ADMIN"), updateRole);

// Delete role - Admin only
router.delete("/:id", hasRole("ADMIN"), deleteRole);

// Assign permission to role - Admin only
router.post("/permissions", hasRole("ADMIN"), assignPermission);

// Remove permission from role - Admin only
router.delete("/permissions", hasRole("ADMIN"), removePermission);

export default router;
