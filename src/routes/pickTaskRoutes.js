import express from "express";
import {
  getAllTasks,
  getMyTasks,
  getTaskById,
  assignTasks,
  selfAssignTask,
  startPicking,
  completePicking,
  getWaveTasks,
} from "../controllers/pickTaskController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// My tasks (for pickers)
router.get("/my-tasks", getMyTasks);

// Task assignment
router.post("/assign", assignTasks);
router.post("/self-assign", selfAssignTask);

// Task execution
router.post("/:id/start", startPicking);
router.post("/:id/complete", completePicking);

// Get tasks
router.get("/wave/:waveId", getWaveTasks);
router.get("/:id", getTaskById);
router.get("/", getAllTasks);

export default router;
