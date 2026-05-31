import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";

export async function createSession(req, res) {
    try {
        // 1. Pull password from the frontend request
        const { problem, difficulty, password } = req.body;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;

        if (!problem || !difficulty) {
            return res.status(400).json({ message: "Problem and difficulty are required" });
        }
        
        // 2. Enforce the password requirement
        if (!password) {
            return res.status(400).json({ message: "Password is required to secure the interview" });
        }

        if (!["easy", "medium", "hard"].includes(difficulty)) {
            return res.status(400).json({ message: "Invalid difficulty value" });
        }
        
        // 3. Generate a clean, 6-digit readable Session ID for the student
        const generatedSessionId = Math.floor(100000 + Math.random() * 900000).toString();
        
        const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // 4. Save the generated ID and password in the database
        const session = await Session.create({ 
            problem, 
            difficulty, 
            host: userId, 
            callId,
            sessionId: generatedSessionId,
            password 
        });

        // create stream video call
        await streamClient.video.call("default", callId).getOrCreate({
            data: {
                created_by_id: clerkId,
                custom: { problem, difficulty, sessionId: session._id.toString() },
            },
        });

        // chat messaging
        const channel = chatClient.channel("messaging", callId, {
            name: `${problem} Session`,
            created_by_id: clerkId,
            members: [clerkId],
        });

        await channel.create();

        res.status(201).json({ session });
    } catch (error) {
        console.log("Error in createSession controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getActiveSessions(_, res) {
    try {
        const sessions = await Session.find({ status: "active" })
            .populate("host", "name profileImage email clerkId")
            .populate("participant", "name profileImage email clerkId")
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({ sessions });
    } catch (error) {
        console.log("Error in getActiveSessions controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getMyRecentSessions(req, res) {
    try {
        const userId = req.user._id;

        // get sessions where user is either host or participant
        const sessions = await Session.find({
            status: "completed",
            $or: [{ host: userId }, { participant: userId }],
        })
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({ sessions });
    } catch (error) {
        console.log("Error in getMyRecentSessions controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getSessionById(req, res) {
    try {
        const { id } = req.params;

        const session = await Session.findById(id)
            .populate("host", "name email profileImage clerkId")
            .populate("participant", "name email profileImage clerkId");

        if (!session) return res.status(404).json({ message: "Session not found" });

        res.status(200).json({ session });
    } catch (error) {
        console.log("Error in getSessionById controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// ---------------------------------------------------------
// EXISTING JOIN ROUTE (Updated with your Race Condition Fix)
// ---------------------------------------------------------
export async function joinSession(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;

        // Your exact race-condition fix implemented here
        const session = await Session.findOneAndUpdate(
            {
                _id: id,
                status: "active",
                participant: null,
                host: { $ne: userId },
            },
            {
                $set: { participant: userId },
            },
            {
                new: true,
            }
        );

        if (!session) {
            return res.status(409).json({ message: "Session is full, unavailable, or you are the host." });
        }

        const channel = chatClient.channel("messaging", session.callId);
        await channel.addMembers([clerkId]);

        res.status(200).json({ session });
    } catch (error) {
        console.log("Error in joinSession controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// ---------------------------------------------------------
// NEW ROUTE: Validate 6-Digit ID & Password from Dashboard
// ---------------------------------------------------------
export async function verifyAndJoinSession(req, res) {
    try {
        const { sessionId, password } = req.body;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;

        // 1. Find the session by the 6-digit code
        const targetSession = await Session.findOne({ sessionId, status: "active" });
        
        if (!targetSession) {
            return res.status(404).json({ message: "Active interview session not found." });
        }

        // 2. Verify the password
        if (targetSession.password !== password) {
            return res.status(401).json({ message: "Incorrect interview password." });
        }

        // 3. Atomically add the user as a participant (using your race condition fix)
        const session = await Session.findOneAndUpdate(
            {
                _id: targetSession._id,
                status: "active",
                $or: [{ participant: null }, { participant: userId }], // Allow if they already joined
                host: { $ne: userId },
            },
            {
                $set: { participant: userId },
            },
            {
                new: true,
            }
        );

        if (!session) {
            return res.status(409).json({ message: "Session is already full or you are the host." });
        }

        // 4. Add them to the Stream Chat
        const channel = chatClient.channel("messaging", session.callId);
        await channel.addMembers([clerkId]);

        // Return the MongoDB Object ID so the frontend knows which URL to navigate to
        res.status(200).json({ 
            success: true, 
            message: "Access granted", 
            roomObjectId: session._id 
        });
    } catch (error) {
        console.log("Error in verifyAndJoinSession:", error.message);
        res.status(500).json({ message: "Error joining session" });
    }
}

export async function endSession(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const session = await Session.findById(id);

        if (!session) return res.status(404).json({ message: "Session not found" });

        // check if user is the host
        if (session.host.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Only the host can end the session" });
        }

        // check if session is already completed
        if (session.status === "completed") {
            return res.status(400).json({ message: "Session is already completed" });
        }

        // delete stream video call
        const call = streamClient.video.call("default", session.callId);
        await call.delete({ hard: true });

        // delete stream chat channel
        const channel = chatClient.channel("messaging", session.callId);
        await channel.delete();

        session.status = "completed";
        await session.save();

        res.status(200).json({ session, message: "Session ended successfully" });
    } catch (error) {
        console.log("Error in endSession controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getProctorToken(req, res) {
    try {
        const proctorId = "proctor_camera_01";
        const token = chatClient.createToken(proctorId);
        res.status(200).json({ token });
    } catch (error) {
        console.log("Error in getProctorToken controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}