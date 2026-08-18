import { requireAuth, clerkClient } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
    requireAuth(),
    async (req, res, next) => {
        try {
            const clerkId = req.auth().userId;

            if (!clerkId) return res.status(401).json({ message: "Unauthorized - invalid token" });

            // find user in db by clerk ID
            let user = await User.findOne({ clerkId });

            if (!user) {
                try {
                    const clerkUser = await clerkClient.users.getUser(clerkId);
                    const email = clerkUser.emailAddresses?.[0]?.emailAddress || "";
                    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || email || clerkId;
                    const profileImage = clerkUser.imageUrl || "";

                    user = await User.create({
                        clerkId,
                        email,
                        name,
                        profileImage,
                    });
                    console.log("Auto-created user in MongoDB:", clerkId);
                } catch (createErr) {
                    console.error("Failed to auto-create user in protectRoute:", createErr.message);
                    return res.status(404).json({ message: "User not found" });
                }
            }

            // attach user to req
            req.user = user;

            next();
        } catch (error) {
            console.error("Error in protectRoute middleware", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
];