// ─────────────────────────────────────────────────────────────────
// models/Review.js
// Single Responsibility: ONLY defines the MongoDB schema for
// AI-generated code review reports.
// ─────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Session",
        required: true,
        unique: true, // one review per session
    },
    language: { type: String, required: true },
    code: { type: String, required: true },

    // Structured review from Grok
    score: { type: Number, min: 1, max: 10 },
    timeComplexity: { type: String },
    spaceComplexity: { type: String },
    correctness: { type: String },
    edgeCasesMissed: [{ type: String }],
    codeQuality: { type: String },
    suggestion: { type: String },
    overallFeedback: { type: String },

    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
    },
}, { timestamps: true });

export default mongoose.model("Review", reviewSchema);
