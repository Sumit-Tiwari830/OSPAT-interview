// ─────────────────────────────────────────────────────────────────
// controllers/aiController.js
// Single Responsibility: Gateway controller that proxies AI
// requests to the Python AI service (port 8000) and saves results.
// ─────────────────────────────────────────────────────────────────

import axios from "axios";
import Review from "../models/Review.js";
import Session from "../models/Session.js";
import ConductorMessage from "../models/ConductorMessage.js";
import { PROBLEMS } from "../data/problems.js";
import { ENV } from "../lib/env.js";

// Python AI service base URL
const AI_SERVICE_URL = ENV.AI_SERVICE_URL || process.env.AI_SERVICE_URL || "http://localhost:8000";

// ─── Code Review ──────────────────────────────────────────────────

/**
 * GET /api/ai/review/:sessionId
 * Returns the AI code review for a completed session.
 */
export const getReview = async (req, res) => {
    try {
        const review = await Review.findOne({ session: req.params.sessionId });
        if (!review) {
            return res.status(404).json({ message: "Review not found or not yet generated." });
        }
        res.json({ review });
    } catch (err) {
        console.error("[AIController] getReview error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// ─── Conductor ────────────────────────────────────────────────────

/**
 * POST /api/ai/conductor/start
 * Starts the AI Conductor and sends the greeting message.
 */
export const startConductorHandler = async (req, res) => {
    try {
        const { sessionId, problemTitle } = req.body;
        if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });

        const problemData = Object.values(PROBLEMS).find(p => p.title === problemTitle);
        const description = problemData?.description?.text || "";
        const constraints = problemData?.constraints || [];

        // 1. Setup initial state
        const initialState = {
            session_id: sessionId.toString(),
            problem_title: problemTitle,
            difficulty: session.difficulty,
            language: "javascript",
            current_code: "",
            final_code: "",
            hints_given: 0,
            time_elapsed_minutes: 0,
            phase: "intro",
            last_message: "",
            scorecard: null,
            should_end: false,
            candidate_resume_text: session.candidateResumeText || "",
            job_description: session.jobDescription || "",
            duration_minutes: session.duration || 30,
        };

        // 2. Call Python service
        const response = await axios.post(`${AI_SERVICE_URL}/conductor/step`, initialState);
        const newState = response.data.state;

        // 3. Persist state in Session
        session.conductorState = {
            hintsGiven: newState.hints_given,
            phase: newState.phase,
            lastMessage: newState.last_message,
            scorecard: newState.scorecard,
        };
        await session.save();

        // 4. Save greeting message to DB
        const message = await ConductorMessage.create({
            session: sessionId,
            phase: newState.phase,
            message: newState.last_message,
        });

        res.status(201).json({ message });
    } catch (err) {
        console.error("[AIController] startConductor error:", err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * POST /api/ai/conductor/:sessionId/code
 * Pushes latest code and gets the conductor's next message.
 */
export const pushCodeHandler = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { code, language, timeElapsedMinutes } = req.body;

        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });
        if (session.conductorState.phase === "done") {
            return res.json({ done: true, message: null });
        }

        // 1. Prepare current state from DB + body
        const currentState = {
            session_id: sessionId.toString(),
            problem_title: session.problem,
            difficulty: session.difficulty,
            language: language || "javascript",
            current_code: code || "",
            final_code: "",
            hints_given: session.conductorState.hintsGiven || 0,
            time_elapsed_minutes: timeElapsedMinutes || 0,
            phase: session.conductorState.phase || "coding",
            last_message: session.conductorState.lastMessage || "",
            scorecard: null,
            should_end: false,
            candidate_resume_text: session.candidateResumeText || "",
            job_description: session.jobDescription || "",
            qna_count: session.conductorState.qnaCount || 0,
            duration_minutes: session.duration || 30,
        };

        // 2. Call Python service
        const response = await axios.post(`${AI_SERVICE_URL}/conductor/step`, currentState);
        const newState = response.data.state;

        // 3. Persist state in Session
        session.conductorState = {
            hintsGiven: newState.hints_given,
            qnaCount: newState.qna_count,
            phase: newState.phase,
            lastMessage: newState.last_message,
            scorecard: newState.scorecard,
        };
        await session.save();

        // 4. Save message to DB
        const message = await ConductorMessage.create({
            session: sessionId,
            phase: newState.phase,
            message: newState.last_message,
            scorecard: newState.scorecard || null,
        });

        res.json({ message });
    } catch (err) {
        console.error("[AIController] pushCode error:", err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * POST /api/ai/conductor/:sessionId/wrapup
 * Triggers wrapup and generates the final scorecard.
 */
export const wrapUpHandler = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { finalCode } = req.body;

        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });

        session.finalCode = finalCode || "";
        session.finalLanguage = session.finalLanguage || "javascript";

        const currentState = {
            session_id: sessionId.toString(),
            problem_title: session.problem,
            difficulty: session.difficulty,
            language: session.finalLanguage,
            current_code: finalCode || "",
            final_code: finalCode || "",
            hints_given: session.conductorState.hintsGiven || 0,
            time_elapsed_minutes: 0,
            phase: "qna",
            last_message: session.conductorState.lastMessage || "",
            scorecard: null,
            should_end: false,
            candidate_resume_text: session.candidateResumeText || "",
            job_description: session.jobDescription || "",
            qna_count: 0,
            duration_minutes: session.duration || 30,
        };

        const response = await axios.post(`${AI_SERVICE_URL}/conductor/step`, currentState);
        const newState = response.data.state;

        session.conductorState = {
            hintsGiven: newState.hints_given,
            qnaCount: newState.qna_count,
            phase: newState.phase,
            lastMessage: newState.last_message,
            scorecard: newState.scorecard,
        };
        await session.save();

        const message = await ConductorMessage.create({
            session: sessionId,
            phase: newState.phase,
            message: newState.last_message,
            scorecard: null,
        });

        res.json({ message });
    } catch (err) {
        console.error("[AIController] wrapUp error:", err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * GET /api/ai/conductor/:sessionId/messages
 * Returns all conductor messages for a session.
 */
export const getMessagesHandler = async (req, res) => {
    try {
        const messages = await ConductorMessage.find({ session: req.params.sessionId }).sort({ createdAt: 1 });
        res.json({ messages });
    } catch (err) {
        console.error("[AIController] getMessages error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

/**
 * GET /api/ai/conductor/:sessionId/scorecard
 * Returns the final AI scorecard for a session.
 */
export const getScorecardHandler = async (req, res) => {
    try {
        const msg = await ConductorMessage.findOne({
            session: req.params.sessionId,
            phase: "done",
            scorecard: { $ne: null }
        });
        if (!msg || !msg.scorecard) return res.status(404).json({ message: "Scorecard not yet generated." });
        res.json({ scorecard: msg.scorecard });
    } catch (err) {
        console.error("[AIController] getScorecard error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

/**
 * POST /api/ai/conductor/:sessionId/chat
 * Body: { message, code, language }
 * Processes an interactive chat message sent by the candidate to the AI Conductor.
 */
export const chatHandler = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { message: candidateMsg, code, language } = req.body;

        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });

        // 1. Save candidate's message
        await ConductorMessage.create({
            session: sessionId,
            phase: session.conductorState.phase || "coding",
            sender: "candidate",
            message: candidateMsg,
        });

        // 2. Query FastAPI python service
        const response = await axios.post(`${AI_SERVICE_URL}/conductor/chat`, {
            session_id: sessionId.toString(),
            candidate_message: candidateMsg,
            current_code: code || session.finalCode || "",
            language: language || session.finalLanguage || "javascript",
            problem_title: session.problem,
            difficulty: session.difficulty,
            phase: session.conductorState.phase || "coding",
            candidate_resume_text: session.candidateResumeText || "",
            job_description: session.jobDescription || "",
            qna_count: session.conductorState.qnaCount || 0,
            duration_minutes: session.duration || 30,
        });

        const { message: reply, phase: newPhase, qna_count: newQnaCount } = response.data;

        // 3. Save AI's response message
        const botMessage = await ConductorMessage.create({
            session: sessionId,
            phase: session.conductorState.phase || "coding",
            sender: "bot",
            message: reply,
        });

        // 4. Update session conductorState
        session.conductorState.phase = newPhase;
        session.conductorState.qnaCount = newQnaCount;
        session.conductorState.lastMessage = reply;
        await session.save();

        // 5. If transitioning to "wrapup", automatically run scorecard generation step
        if (newPhase === "wrapup") {
            const wrapupState = {
                session_id: sessionId.toString(),
                problem_title: session.problem,
                difficulty: session.difficulty,
                language: language || session.finalLanguage || "javascript",
                current_code: code || session.finalCode || "",
                final_code: code || session.finalCode || "",
                hints_given: session.conductorState.hintsGiven || 0,
                time_elapsed_minutes: 0,
                phase: "wrapup",
                last_message: reply,
                scorecard: null,
                should_end: false,
                candidate_resume_text: session.candidateResumeText || "",
                job_description: session.jobDescription || "",
                qna_count: newQnaCount,
                duration_minutes: session.duration || 30,
            };

            const wrapupRes = await axios.post(`${AI_SERVICE_URL}/conductor/step`, wrapupState);
            const finalState = wrapupRes.data.state;

            session.conductorState = {
                hintsGiven: finalState.hints_given,
                qnaCount: finalState.qna_count,
                phase: finalState.phase,
                lastMessage: finalState.last_message,
                scorecard: finalState.scorecard,
            };
            session.status = "completed"; // formally complete the session
            await session.save();

            // Save final scorecard message
            await ConductorMessage.create({
                session: sessionId,
                phase: "done",
                message: finalState.last_message,
                scorecard: finalState.scorecard || null,
            });
        }

        res.status(201).json({ message: botMessage });
    } catch (err) {
        console.error("[AIController] chat error:", err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * POST /api/ai/ats/analyze
 * Body: { resumeText, jobDescription, companyName, model }
 */
export const analyzeAtsHandler = async (req, res) => {
    try {
        const { resumeText, jobDescription, companyName, model } = req.body;
        if (!resumeText || !jobDescription) {
            return res.status(400).json({ message: "Resume and Job Description are required" });
        }

        const response = await axios.post(`${AI_SERVICE_URL}/ats/analyze`, {
            resume_text: resumeText,
            job_description: jobDescription,
            company_name: companyName || "",
            model: model || "gemini",
        });

        res.json(response.data);
    } catch (err) {
        console.error("[AIController] analyzeAts error:", err.message);
        res.status(500).json({ message: err.response?.data?.detail || err.message });
    }
};

/**
 * POST /api/ai/ats/chat
 * Body: { resumeText, jobDescription, userMessage, chatHistory, model }
 */
export const chatAtsHandler = async (req, res) => {
    try {
        const { resumeText, jobDescription, userMessage, chatHistory, model } = req.body;
        if (!resumeText || !jobDescription || !userMessage) {
            return res.status(400).json({ message: "Resume, Job Description, and userMessage are required" });
        }

        const response = await axios.post(`${AI_SERVICE_URL}/ats/chat`, {
            resume_text: resumeText,
            job_description: jobDescription,
            user_message: userMessage,
            chat_history: chatHistory || [],
            model: model || "gemini",
        });

        res.json(response.data);
    } catch (err) {
        console.error("[AIController] chatAts error:", err.message);
        res.status(500).json({ message: err.response?.data?.detail || err.message });
    }
};

