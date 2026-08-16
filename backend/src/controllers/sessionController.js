import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";
import { ENV } from "../lib/env.js";
import { inngest } from "../lib/inngest.js";
import fs from "fs";
import Groq from "groq-sdk";

export async function createSession(req, res) {
    try {
        const { problem, customDescription = "", difficulty = "medium", password, fullscreenRequired, type = "personal", duration } = req.body;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;

        // ONLY problem (title) is required
        if (!problem) {
            return res.status(400).json({ message: "Problem title is required" });
        }

        const validDifficulties = ["easy", "medium", "hard"];
        const sessionDifficulty = validDifficulties.includes(difficulty.toLowerCase()) 
            ? difficulty.toLowerCase() 
            : "medium";

        // Validate and bound duration to 1-45 minutes
        let sessionDuration = 30;
        if (duration) {
            const parsed = parseInt(duration);
            if (!isNaN(parsed)) {
                sessionDuration = Math.max(1, Math.min(45, parsed));
            }
        }

        // Auto-generate 6-digit password if not provided for personal sessions
        const sessionPassword = password || Math.floor(100000 + Math.random() * 900000).toString();
        
        const generatedSessionId = Math.floor(100000 + Math.random() * 900000).toString();
        const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // Setup initial conductor state for AI mode
        const welcomeGreeting = "";
        const conductorState = {
            hintsGiven: 0,
            qnaCount: 0,
            phase: "intro",
            lastMessage: welcomeGreeting,
            scorecard: null
        };

        const session = await Session.create({ 
            problem, 
            customDescription,
            difficulty: sessionDifficulty, 
            host: userId,
            participant: type === "ai" ? userId : null, // Creator is participant in AI mode
            callId,
            sessionId: generatedSessionId,
            password: type === "ai" ? "ai-session" : sessionPassword,
            fullscreenRequired: !!fullscreenRequired,
            type,
            duration: sessionDuration,
            conductorState
        });

        // Initialize Stream video and chat ONLY for personal interviews
        if (type === "personal") {
            await streamClient.video.call("default", callId).getOrCreate({
                data: {
                    created_by_id: clerkId,
                    custom: { problem, difficulty, sessionId: session._id.toString() },
                },
            });

            const channel = chatClient.channel("messaging", callId, {
                name: `${problem} Session`,
                created_by_id: clerkId,
                members: [clerkId],
            });

            await channel.create();
        }

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

        const query = {
            status: "completed",
            $or: [{ host: userId }, { participant: userId }],
        };

        // get sessions where user is either host or participant
        const sessions = await Session.find(query)
            .sort({ createdAt: -1 })
            .limit(6);

        const totalCount = await Session.countDocuments(query);

        res.status(200).json({ sessions, totalCount });
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
        // Accept final code from frontend when host ends session
        const { finalCode, finalLanguage } = req.body;

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

        // delete stream video call and chat channel ONLY for personal sessions
        if (session.type === "personal") {
            try {
                const call = streamClient.video.call("default", session.callId);
                await call.delete({ hard: true });
            } catch (err) {
                console.error("Failed to delete Stream call:", err.message);
            }

            try {
                const channel = chatClient.channel("messaging", session.callId);
                await channel.delete();
            } catch (err) {
                console.error("Failed to delete Stream channel:", err.message);
            }
        }

        // Save final code snapshot for AI code reviewer
        if (finalCode) {
            session.finalCode = finalCode;
            session.finalLanguage = finalLanguage || "javascript";
        }
        session.status = "completed";
        await session.save();

        // For AI sessions, manually trigger wrapup and final evaluation/scorecard on the AI conductor
        if (session.type === "ai") {
            try {
                const axios = (await import("axios")).default;
                const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

                const state = {
                    session_id: session._id.toString(),
                    problem_title: session.problem,
                    difficulty: session.difficulty,
                    language: session.finalLanguage || "javascript",
                    current_code: session.finalCode || "",
                    final_code: session.finalCode || "",
                    hints_given: session.conductorState.hintsGiven || 0,
                    time_elapsed_minutes: 0,
                    phase: "scorecard",
                    last_message: session.conductorState.lastMessage || "",
                    scorecard: null,
                    should_end: true,
                    candidate_resume_text: session.candidateResumeText || "",
                    job_description: session.jobDescription || "",
                    qna_count: session.conductorState.qnaCount || 0,
                    duration_minutes: session.duration || 30,
                };

                const response = await axios.post(`${AI_SERVICE_URL}/conductor/step`, state);
                const newState = response.data.state;

                session.conductorState = {
                    hintsGiven: newState.hints_given,
                    qnaCount: newState.qna_count,
                    phase: newState.phase,
                    lastMessage: newState.last_message,
                    scorecard: newState.scorecard,
                };
                await session.save();

                const ConductorMessage = (await import("../models/ConductorMessage.js")).default;
                await ConductorMessage.create({
                    session: session._id,
                    phase: "done",
                    message: newState.last_message,
                    scorecard: newState.scorecard || null,
                });
            } catch (aiErr) {
                console.error("Failed to generate final scorecard for manually ended AI session:", aiErr.message);
            }
        }

        // Fire background event to trigger AI code review (non-blocking)
        if (session.finalCode) {
            await inngest.send({
                name: "session/ended",
                data: { sessionId: session._id.toString(), problem: session.problem },
            });
        }

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

const COMPILER_IDS = {
    javascript: "typescript-deno",
    python: "python-3.14",
    java: "openjdk-25",
    "c++": "g++-15",
    cpp: "g++-15",
    c: "gcc-15"
};

export async function runCode(req, res) {
    try {
        const { language, code, input } = req.body;

        if (!language || !code) {
            return res.status(400).json({ message: "Language and code are required" });
        }

        const compilerId = COMPILER_IDS[language.toLowerCase()];
        if (!compilerId) {
            return res.status(400).json({ message: `Unsupported language: ${language}` });
        }

        const requestBody = {
            compiler: compilerId,
            code: code
        };
        if (input) {
            requestBody.input = input;
        }

        const response = await fetch("https://api.onlinecompiler.io/api/run-code-sync/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': ENV.ONLINECOMPILER_KEY
            },
            body: JSON.stringify(requestBody)
        });

        if (response.status === 429) {
            return res.status(429).json({ error: "Too many requests! Please wait a moment." });
        }
        if (!response.ok) {
            return res.status(response.status).json({ error: `API Error! status: ${response.status}` });
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Error in runCode backend:", error.message);
        res.status(500).json({ message: "Internal Server Error during code execution" });
    }
}

// ---------------------------------------------------------
// PATCH /:id/settings — host toggles fullscreenRequired
// ---------------------------------------------------------
export async function updateSessionSettings(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const { fullscreenRequired } = req.body;

        const session = await Session.findById(id);
        if (!session) return res.status(404).json({ message: "Session not found" });

        if (session.host.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Only the host can change session settings" });
        }

        if (typeof fullscreenRequired === "boolean") {
            session.fullscreenRequired = fullscreenRequired;
        }

        if (typeof req.body.allowStudentReview === "boolean") {
            session.allowStudentReview = req.body.allowStudentReview;
        }

        await session.save();
        res.status(200).json({ session });
    } catch (error) {
        console.error("Error in updateSessionSettings:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function submitCode(req, res) {
    try {
        const { id } = req.params;
        const { code, language } = req.body;
        const userId = req.user._id;

        const session = await Session.findById(id);
        if (!session) return res.status(404).json({ message: "Session not found" });

        // Ensure host or participant can submit code
        const isParticipant = session.participant?.toString() === userId.toString();
        const isHost = session.host.toString() === userId.toString();
        
        if (!isParticipant && !isHost) {
            return res.status(403).json({ message: "You are not authorized to submit code for this session" });
        }

        session.finalCode = code;
        session.finalLanguage = language || "javascript";
        await session.save();

        // Generate or regenerate the AI review in the background on every submission
        await inngest.send({
            name: "session/ended",
            data: { sessionId: session._id.toString(), problem: session.problem },
        });

        res.status(200).json({ message: "Code submitted successfully", session });
    } catch (error) {
        console.error("Error in submitCode controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function uploadResume(req, res) {
    try {
        const { id } = req.params;
        const { resumeText, resumeFileUrl, resumeFileName, model } = req.body;
        const userId = req.user._id;

        const session = await Session.findById(id);
        if (!session) return res.status(404).json({ message: "Session not found" });

        // Ensure user is the participant (or host in AI mode)
        const isParticipant = session.participant?.toString() === userId.toString();
        const isHost = session.host.toString() === userId.toString();
        if (!isParticipant && !isHost) {
            return res.status(403).json({ message: "You are not authorized to upload a resume for this session" });
        }

        session.candidateResumeText = resumeText;
        if (resumeFileUrl) session.candidateResumeFileUrl = resumeFileUrl;
        if (resumeFileName) session.candidateResumeFileName = resumeFileName;
        await session.save();

        // Summarize only if a model is explicitly chosen or if it is an AI session
        const shouldSummarize = !!model || session.type === "ai";

        if (shouldSummarize) {
            const axios = (await import("axios")).default;
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
            
            let summary = "Summary not generated.";
            try {
                const response = await axios.post(`${AI_SERVICE_URL}/resume/summarize`, {
                    resume_text: resumeText,
                    model: model || "grok"
                });
                summary = response.data.summary;
            } catch (aiErr) {
                console.error("Failed to query AI service for resume summary:", aiErr.message);
            }

            session.resumeSummary = summary;
            await session.save();
        } else {
            // Keep summary empty for now (interviewer will generate it later)
            session.resumeSummary = "";
            await session.save();
        }

        res.status(200).json({ message: "Resume processed successfully", session });
    } catch (error) {
        console.error("Error in uploadResume controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function changeQuestion(req, res) {
    try {
        const { id } = req.params;
        const { problem, customDescription, difficulty } = req.body;
        const userId = req.user._id;

        const session = await Session.findById(id);
        if (!session) return res.status(404).json({ message: "Session not found" });

        // Only host can change the question
        if (session.host.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Only the interviewer (host) can change the question" });
        }

        // Update question details
        session.problem = problem;
        session.customDescription = customDescription || "";
        session.difficulty = difficulty || "medium";
        
        // Reset code workspace for both candidate and host
        session.finalCode = "";
        await session.save();

        // Delete any existing code review for this session to clear review state
        const Review = (await import("../models/Review.js")).default;
        await Review.deleteOne({ session: session._id });

        res.status(200).json({ message: "Question updated successfully", session });
    } catch (error) {
        console.error("Error in changeQuestion controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function transcribeAudio(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No audio file uploaded" });
        }

        const groqApiKey = process.env.GROK_API_KEY;
        if (!groqApiKey) {
            return res.status(500).json({ message: "GROK_API_KEY is not configured on the backend" });
        }

        const groq = new Groq({ apiKey: groqApiKey });
        
        // Rename file to append .wav extension so Groq SDK/API can identify the format
        const oldPath = req.file.path;
        const newPath = `${oldPath}.wav`;
        fs.renameSync(oldPath, newPath);

        const fileStream = fs.createReadStream(newPath);

        const transcription = await groq.audio.transcriptions.create({
            file: fileStream,
            model: "whisper-large-v3",
            language: "en",
        });

        // Clean up uploaded temp file
        try {
            fs.unlinkSync(newPath);
        } catch (unlinkErr) {
            console.error("Failed to delete temp audio file:", unlinkErr.message);
        }

        res.status(200).json({ text: transcription.text });
    } catch (error) {
        console.error("Error in transcribeAudio:", error.message);
        // Clean up temp files in case of error
        if (req.file) {
            try {
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                const possibleWavPath = `${req.file.path}.wav`;
                if (fs.existsSync(possibleWavPath)) {
                    fs.unlinkSync(possibleWavPath);
                }
            } catch (e) {}
        }
        res.status(500).json({ message: "Failed to transcribe audio" });
    }
}

export async function generateSpeechProxy(req, res) {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ message: "Text is required" });
        }

        const axios = (await import("axios")).default;
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

        const response = await axios.post(`${AI_SERVICE_URL}/tts`, { text }, {
            responseType: "stream"
        });

        res.setHeader("Content-Type", "audio/mp3");
        response.data.pipe(res);
    } catch (err) {
        console.error("Error in generateSpeechProxy proxying:", err.message);
        res.status(500).json({ message: "Failed to proxy speech generation" });
    }
}