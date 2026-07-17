import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import multer from "multer";
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
    submitCode,
    uploadResume,
    changeQuestion,
    transcribeAudio,
    generateSpeechProxy,
} from "../controllers/sessionController.js";

const upload = multer({ dest: "uploads/" });
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
router.patch("/:id/question", protectRoute, changeQuestion);
router.post("/:id/join", protectRoute, joinSession); // (We kept this as fallback)
router.post("/:id/submit-code", protectRoute, submitCode);
router.post("/:id/resume", protectRoute, uploadResume);
router.post("/:id/transcribe", protectRoute, upload.single("file"), transcribeAudio);
router.post("/:id/tts", protectRoute, generateSpeechProxy);
router.post("/:id/end", protectRoute, endSession);

export default router;