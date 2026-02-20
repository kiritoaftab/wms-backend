import express from "express";
import {
  getAllRateCards,
  getRateCardById,
  createRateCard,
  updateRateCard,
  deleteRateCard,
} from "../controllers/rateCardController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("BILLING", "READ"), getAllRateCards);
router.get("/:id", authorize("BILLING", "READ"), getRateCardById);
router.post("/", authorize("BILLING", "CREATE"), createRateCard);
router.put("/:id", authorize("BILLING", "UPDATE"), updateRateCard);
router.delete("/:id", authorize("BILLING", "DELETE"), deleteRateCard);

export default router;
