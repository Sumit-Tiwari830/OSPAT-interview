// ─────────────────────────────────────────────────────────────────
// routes/aiRoute.js
// Single Responsibility: ONLY maps HTTP routes to controller
// handlers. No logic — just routing + auth middleware.
// ─────────────────────────────────────────────────────────────────

import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
    getReview,
    startConductorHandler,
    pushCodeHandler,
    wrapUpHandler,
    getMessagesHandler,
    getScorecardHandler,
    chatHandler,
    analyzeAtsHandler,
    chatAtsHandler,
} from "../controllers/aiController.js";

const router = express.Router();

// All AI routes require authentication
router.use(protectRoute);

// ── Code Review ───────────────────────────────────────────────────
router.get("/review/:sessionId", getReview);

// ── Interview Conductor ───────────────────────────────────────────
router.post("/conductor/start", startConductorHandler);
router.post("/conductor/:sessionId/code", pushCodeHandler);
router.post("/conductor/:sessionId/wrapup", wrapUpHandler);
router.post("/conductor/:sessionId/chat", chatHandler);
router.get("/conductor/:sessionId/messages", getMessagesHandler);
router.get("/conductor/:sessionId/scorecard", getScorecardHandler);

// ── ATS Scanner ───────────────────────────────────────────────────
router.post("/ats/analyze", analyzeAtsHandler);
router.post("/ats/chat", chatAtsHandler);

export default router;
