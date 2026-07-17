// ─────────────────────────────────────────────────────────────────
// models/ConductorMessage.js
// Single Responsibility: ONLY defines the MongoDB schema for
// messages sent by the AI Conductor during a session.
// ─────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const conductorMessageSchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Session",
        required: true,
    },
    phase: {
        type: String,
        enum: ["intro", "coding", "wrapup", "done"],
        required: true,
    },
    sender: {
        type: String,
        enum: ["bot", "candidate"],
        default: "bot",
    },
    message: { type: String, required: true },
    scorecard: { type: mongoose.Schema.Types.Mixed, default: null }, // filled only on final message
}, { timestamps: true });

export default mongoose.model("ConductorMessage", conductorMessageSchema);
