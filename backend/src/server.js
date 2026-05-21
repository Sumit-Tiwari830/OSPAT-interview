import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { ENV } from './lib/env.js';
import { connectDB } from "./lib/db.js";
const app = express();

//console.log('PORT:', ENV.PORT);
//console.log('DB_URL:', ENV.DB_URL);
const __dirname = path.resolve();

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Hello World health!123' });
});
app.get('/books', (req, res) => {
    res.status(200).json({ message: 'Hello World!123 books' });
});
if (ENV.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    app.get("/{*any}", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
    });
}
const startServer = async () => {
    try {
        await connectDB();
        app.listen(ENV.PORT, () => console.log("Server is running on port:", ENV.PORT));
    } catch (error) {
        console.error("💥 Error starting the server", error);
    }
};
startServer();