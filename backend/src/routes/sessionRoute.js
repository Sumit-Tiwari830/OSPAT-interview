import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
    createSession,
    endSession,
    getActiveSessions,
    getMyRecentSessions,
    getSessionById,
    joinSession,
    verifyAndJoinSession, // <-- Added
    getProctorToken       // <-- Added (from our earlier QR code work!)
} from "../controllers/sessionController.js";

const router = express.Router();

router.post("/", protectRoute, createSession);
router.get("/active", protectRoute, getActiveSessions);
router.get("/my-recent", protectRoute, getMyRecentSessions);

// --- NEW ROUTES ---
router.get("/proctor-token", getProctorToken); 
router.post("/verify-join", protectRoute, verifyAndJoinSession); 
// ------------------

router.get("/:id", protectRoute, getSessionById);
router.post("/:id/join", protectRoute, joinSession); // (We kept this as fallback)
router.post("/:id/end", protectRoute, endSession);

export default router;