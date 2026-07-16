import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
    createSession,
    endSession,
    getActiveSessions,
    getMyRecentSessions,
    getSessionById,
    joinSession,
    verifyAndJoinSession,
    getProctorToken,
    runCode,
    updateSessionSettings,
} from "../controllers/sessionController.js";

const router = express.Router();

router.post("/", protectRoute, createSession);
router.get("/active", protectRoute, getActiveSessions);
router.get("/my-recent", protectRoute, getMyRecentSessions);

// --- NEW ROUTES ---
router.get("/proctor-token", getProctorToken); 
router.post("/verify-join", protectRoute, verifyAndJoinSession); 
router.post("/run-code", protectRoute, runCode); 
// ------------------

router.get("/:id", protectRoute, getSessionById);
router.patch("/:id/settings", protectRoute, updateSessionSettings);
router.post("/:id/join", protectRoute, joinSession); // (We kept this as fallback)
router.post("/:id/end", protectRoute, endSession);

export default router;