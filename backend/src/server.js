import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { serve } from "inngest/express";
import { clerkMiddleware } from '@clerk/express'

import { ENV } from './lib/env.js';
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";
//import { protectRoute } from "./middleware/protectRoute.js";
import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";
import codeRoutes from './routes/codeRoutes.js';
import flagRoutes from "./routes/flagRoute.js";
import aiRoutes from "./routes/aiRoute.js";

const app = express();

const __dirname = path.resolve();
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));
// Allow CORS from local dev + Vercel deployments
const allowedOrigins = [
    ENV.CLIENT_URL,                        // e.g. http://localhost:5173 or https://your-app.vercel.app
    /^https:\/\/.*\.vercel\.app$/,         // any Vercel preview/prod URL
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // allow server-to-server
        const allowed = allowedOrigins.some(o =>
            typeof o === "string" ? o === origin : o.test(origin)
        );
        callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
    },
    credentials: true
}));
app.use(clerkMiddleware());

app.use("/api/inngest", serve({ client: inngest, functions }))
app.use("/api/chat", chatRoutes);

app.use('/api/code', codeRoutes);

app.use("/api/sessions", sessionRoutes);
app.use("/api/flags", flagRoutes);
app.use("/api/ai", aiRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Hello World health!123' });
});
app.get('/books', (req, res) => {
    res.status(200).json({ message: 'Hello World!123 books' });
});
app.get('/video-calls', (req, res) => {
    res.status(200).json({ message: 'Hello World!123 video calls' });
});

const frontendIndex = path.join(__dirname, "../frontend/dist/index.html");
if (fs.existsSync(frontendIndex)) {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));
    app.get("/{*any}", (req, res) => {
        res.sendFile(frontendIndex);
    });
} else {
    app.get("/", (req, res) => {
        res.status(200).json({ status: "ok", message: "OSPAT Backend API is running" });
    });
}

const startServer = async () => {
    try {
        if (!ENV.DB_URL) {
            throw new Error("DB_URL is not defined in environment variables");
        }
        await connectDB();
        app.listen(ENV.PORT, () => console.log("Server is running on port:", ENV.PORT));
    } catch (error) {
        console.error("💥 Error starting the server", error);
        process.exit(1);
    }
};
startServer();