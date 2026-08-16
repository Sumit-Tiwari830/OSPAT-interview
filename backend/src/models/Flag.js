import mongoose from "mongoose";

const flagSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Flag", flagSchema);
