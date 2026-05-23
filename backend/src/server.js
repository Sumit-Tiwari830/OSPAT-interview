import express from 'express';
import path from 'path';
import cors from 'cors';
import { serve } from "inngest/express";
import { clerkMiddleware } from '@clerk/express'

import { ENV } from './lib/env.js';
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";
//import { protectRoute } from "./middleware/protectRoute.js";
import chatRoutes from "./routes/chatRoutes.js";
const app = express();

//console.log('PORT:', ENV.PORT);
//console.log('DB_URL:', ENV.DB_URL);
const __dirname = path.resolve();
app.use(express.json());
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware());

app.use("/api/inngest", serve({ client: inngest, functions }))
app.use("/api/chat", chatRoutes)
app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Hello World health!123' });
});
app.get('/books', (req, res) => {
    res.status(200).json({ message: 'Hello World!123 books' });
});
app.get('/video-calls', (req, res) => {
    res.status(200).json({ message: 'Hello World!123 video calls' });
});

if (ENV.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    app.get("/{*any}", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
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