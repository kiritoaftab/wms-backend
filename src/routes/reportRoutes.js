import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getInboundTAT,
  getPutawayAging,
  getSpaceUtilization,
  getPickProductivity,
  getPackProductivity,
  getOutboundSLA,
  getBillingRevenue,
} from "../controllers/reportController.js";

const router = express.Router();

router.use(authenticate);

router.get("/inbound-tat",       authorize("REPORTS", "READ"), getInboundTAT);
router.get("/putaway-aging",     authorize("REPORTS", "READ"), getPutawayAging);
router.get("/space-utilization", authorize("REPORTS", "READ"), getSpaceUtilization);
router.get("/pick-productivity", authorize("REPORTS", "READ"), getPickProductivity);
router.get("/pack-productivity", authorize("REPORTS", "READ"), getPackProductivity);
router.get("/outbound-sla",      authorize("REPORTS", "READ"), getOutboundSLA);
router.get("/billing-revenue",   authorize("REPORTS", "READ"), getBillingRevenue);

export default router;
