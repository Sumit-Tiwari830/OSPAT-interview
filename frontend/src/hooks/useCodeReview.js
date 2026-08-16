// ─────────────────────────────────────────────────────────────────
// hooks/useCodeReview.js
// Single Responsibility: ONLY fetches and polls the AI code review
// for a session. Returns status + review data.
// ─────────────────────────────────────────────────────────────────

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

/**
 * Polls the AI code review for a session until it's completed.
 * @param {string} sessionId - MongoDB ObjectId
 */
export const useCodeReview = (sessionId) => {
    return useQuery({
        queryKey: ["codeReview", sessionId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/ai/review/${sessionId}`);
            return res.data.review;
        },
        enabled: !!sessionId,
        // Poll every 5s while review is still pending
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            if (status === "completed" || status === "failed") return false;
            return 5000;
        },
        retry: false,
    });
};
