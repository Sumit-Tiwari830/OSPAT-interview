import Flag from "../models/Flag.js";
import Session from "../models/Session.js";

/**
 * Create a proctoring flag.
 * Looks up the session by the 6-digit sessionId code, then persists the flag.
 */
export const createFlag = async ({ sessionId, userId, reason }) => {
    const session = await Session.findOne({ sessionId });
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    return Flag.create({
        session: session._id,
        user: userId,
        reason,
    });
};

/**
 * Fetch all flags for a session (for the interviewer dashboard).
 */
export const getFlagsBySession = async (sessionId) => {
    const session = await Session.findOne({ sessionId });
    if (!session) return [];

    return Flag.find({ session: session._id })
        .populate("user", "name email profileImage")
        .sort({ createdAt: 1 });
};
