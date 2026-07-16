import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { createFlag, getFlagsBySession } from "../services/flagService.js";

const router = express.Router();

// POST /api/flags — candidate reports a violation
router.post("/", protectRoute, async (req, res) => {
    const { sessionId, reason } = req.body;

    if (!sessionId || !reason) {
        return res.status(400).json({ message: "sessionId and reason are required" });
    }

    try {
        const flag = await createFlag({
            sessionId,          // the 6-digit session code
            userId: req.user._id,
            reason,
        });
        res.status(201).json({ ok: true, flag });
    } catch (err) {
        console.error("Error creating flag:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// GET /api/flags/:sessionId — interviewer fetches all flags for a session
router.get("/:sessionId", protectRoute, async (req, res) => {
    try {
        const flags = await getFlagsBySession(req.params.sessionId);
        res.json({ flags });
    } catch (err) {
        console.error("Error fetching flags:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

export default router;
