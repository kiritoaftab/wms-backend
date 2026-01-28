import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
} from "../controllers/userController.js";
import { authenticate, authorize, hasRole } from "../middleware/auth.js";

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Get all users - requires USER_MANAGEMENT module READ permission
router.get("/", authorize("USER_MANAGEMENT", "READ"), getAllUsers);

// Get user by ID
router.get("/:id", authorize("USER_MANAGEMENT", "READ"), getUserById);

// Create user - requires CREATE permission
router.post("/", authorize("USER_MANAGEMENT", "CREATE"), createUser);

// Update user - requires UPDATE permission
router.put("/:id", authorize("USER_MANAGEMENT", "UPDATE"), updateUser);

// Delete user - requires DELETE permission
router.delete("/:id", authorize("USER_MANAGEMENT", "DELETE"), deleteUser);

// Change password - users can change their own, admins can change anyone's
router.put("/:id/password", changePassword);

export default router;
