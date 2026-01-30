import express from "express";
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from "../controllers/clientController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all clients
router.get("/", authorize("USER_MANAGEMENT", "READ"), getAllClients);

// Get client by ID
router.get("/:id", authorize("USER_MANAGEMENT", "READ"), getClientById);

// Create client
router.post("/", authorize("USER_MANAGEMENT", "CREATE"), createClient);

// Update client
router.put("/:id", authorize("USER_MANAGEMENT", "UPDATE"), updateClient);

// Delete client
router.delete("/:id", authorize("USER_MANAGEMENT", "DELETE"), deleteClient);

export default router;
