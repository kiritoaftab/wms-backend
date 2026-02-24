// src/routes/searchRoutes.js
import express from "express";
import { globalSearch } from "../controllers/searchController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, globalSearch);

export default router;
