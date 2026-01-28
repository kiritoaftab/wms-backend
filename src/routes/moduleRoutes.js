import express from "express";
import {
  getAllModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
} from "../controllers/moduleController.js";
import { authenticate, hasRole } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all modules - accessible to all authenticated users
router.get("/", getAllModules);

// Get module by ID
router.get("/:id", getModuleById);

// Create module - Admin only
router.post("/", hasRole("ADMIN"), createModule);

// Update module - Admin only
router.put("/:id", hasRole("ADMIN"), updateModule);

// Delete module - Admin only
router.delete("/:id", hasRole("ADMIN"), deleteModule);

export default router;
