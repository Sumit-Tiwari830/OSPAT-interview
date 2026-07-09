import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { deleteStreamUser, upsertStreamUser, streamClient, chatClient } from "./stream.js";

export const inngest = new Inngest({ id: "ospat" });

const syncUser = inngest.createFunction(
    { id: "sync-user" },
    { event: "clerk/user.created" },
    async ({ event }) => {
        await connectDB();

        const { id, email_addresses, first_name, last_name, image_url } = event.data;

        const newUser = {
            clerkId: id,
            email: email_addresses[0]?.email_address,
            name: `${first_name || ""} ${last_name || ""}`,
            profileImage: image_url,
        };

        await User.create(newUser);
        await upsertStreamUser({
            id: newUser.clerkId.toString(),
            name: newUser.name,
            image: newUser.profileImage,
        });
        // in future we can add welocme email
    }
);

const deleteUserFromDB = inngest.createFunction(
    { id: "delete-user-from-db" },
    { event: "clerk/user.deleted" },
    async ({ event }) => {
        await connectDB();

        const { id } = event.data;
        await User.deleteOne({ clerkId: id });
        await deleteStreamUser(id.toString());

    }
);

const autoExpireSessions = inngest.createFunction(
    { id: "auto-expire-sessions" },
    { cron: "*/30 * * * *" }, // Run every 30 minutes
    async ({ step }) => {
        await connectDB();

        // Cutoff is 24 hours ago
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Find all active sessions older than 24 hours
        const expiredSessions = await Session.find({
            status: "active",
            createdAt: { $lt: cutoffTime }
        });

        if (expiredSessions.length === 0) {
            console.log("[Auto-Expire] No expired active sessions found.");
            return;
        }

        console.log(`[Auto-Expire] Found ${expiredSessions.length} expired active sessions.`);

        await step.run("expire-active-sessions", async () => {
            for (const session of expiredSessions) {
                try {
                    // 1. Delete stream video call
                    if (session.callId) {
                        const call = streamClient.video.call("default", session.callId);
                        await call.delete({ hard: true });
                    }
                } catch (err) {
                    console.error(`Error deleting Stream call for session ${session._id}:`, err.message);
                }

                try {
                    // 2. Delete stream chat channel
                    if (session.callId) {
                        const channel = chatClient.channel("messaging", session.callId);
                        await channel.delete();
                    }
                } catch (err) {
                    console.error(`Error deleting Stream chat channel for session ${session._id}:`, err.message);
                }

                // 3. Mark session as completed
                session.status = "completed";
                await session.save();
                console.log(`[Auto-Expire] Session ${session._id} successfully auto-expired.`);
            }
        });
    }
);

export const functions = [syncUser, deleteUserFromDB, autoExpireSessions];