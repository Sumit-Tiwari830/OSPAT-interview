import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        problem: {
            type: String,
            required: true,
        },
        customDescription: {
            type: String,
            default: "",
        },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "medium",
            required: false,
        },
        host: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        participant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        status: {
            type: String,
            enum: ["active", "completed"],
            default: "active",
        },
        fullscreenRequired: { type: Boolean, default: false },
        callId: {
            type: String,
            default: "",
        },
        sessionId: {
            type: String,
            unique: true,
            required: true
        },
        type: {
            type: String,
            enum: ["personal", "ai"],
            default: "personal",
        },
        password: {
            type: String,
            required: false,
        },
        allowStudentReview: { type: Boolean, default: false },
        duration: { type: Number, default: 30 }, // in minutes
        jobDescription: { type: String, default: "" },
        candidateResumeText: { type: String, default: "" },
        resumeSummary: { type: String, default: "" },
        candidateResumeFileUrl: { type: String, default: "" },
        candidateResumeFileName: { type: String, default: "" },
        // Saved when session ends — used by AI code reviewer
        finalCode: { type: String, default: "" },
        finalLanguage: { type: String, default: "javascript" },
        // Conductor State
        conductorState: {
            hintsGiven: { type: Number, default: 0 },
            qnaCount: { type: Number, default: 0 },
            phase: { type: String, default: "intro" },
            lastMessage: { type: String, default: "" },
            scorecard: { type: mongoose.Schema.Types.Mixed, default: null },
        },
    },
    { timestamps: true }
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;