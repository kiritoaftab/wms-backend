import express from "express";
import {
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getUsersByRole,
  bulkAssignRolesToUser,
  getAllUserRoles,
} from "../controllers/userRoleController.js";
import { authenticate, hasRole } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all user-role assignments - Admin only
router.get("/", hasRole("ADMIN"), getAllUserRoles);

// Get all roles for a specific user
router.get("/user/:userId", getUserRoles);

// Get all users with a specific role
router.get("/role/:roleId", getUsersByRole);

// Assign role to user - Admin only
router.post("/", hasRole("ADMIN"), assignRoleToUser);

// Bulk assign roles to user (replace all) - Admin only
router.post("/bulk", hasRole("ADMIN"), bulkAssignRolesToUser);

// Remove role from user - Admin only
router.delete("/", hasRole("ADMIN"), removeRoleFromUser);

export default router;
