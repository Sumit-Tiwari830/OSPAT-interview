import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const ENV = {
    PORT: process.env.PORT,
    DB_URL: process.env.DB_URL,
    NODE_ENV: process.env.NODE_ENV,
    CLIENT_URL: process.env.CLIENT_URL,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    STREAM_API_KEY: process.env.STREAM_API_KEY,
    STREAM_API_SECRET: process.env.STREAM_API_SECRET,
    ONLINECOMPILER_KEY: process.env.ONLINECOMPILER_KEY,
    GROK_API_KEY: process.env.GROK_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:8000",
};