// ─────────────────────────────────────────────────────────────────
// hooks/useConductor.js
// Single Responsibility: ONLY manages conductor messages —
// starting the conductor, pushing code, and polling messages.
// ─────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

/** Fetch all conductor messages for a session (polled every 8s) */
export const useConductorMessages = (sessionId) => {
    return useQuery({
        queryKey: ["conductorMessages", sessionId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/ai/conductor/${sessionId}/messages`);
            return res.data.messages;
        },
        enabled: !!sessionId,
        refetchInterval: 8000, // poll every 8s
    });
};

/** Start the conductor (called once when session becomes active) */
export const useStartConductor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sessionId, problemTitle }) =>
            axiosInstance.post("/ai/conductor/start", { sessionId, problemTitle }).then(r => r.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["conductorMessages", variables.sessionId] });
        },
    });
};

/** Push latest code to conductor (called on interval during session) */
export const usePushCode = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sessionId, code, language, timeElapsedMinutes }) =>
            axiosInstance.post(`/ai/conductor/${sessionId}/code`, { code, language, timeElapsedMinutes }).then(r => r.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["conductorMessages", variables.sessionId] });
        },
    });
};

/** Fetch the final scorecard */
export const useConductorScorecard = (sessionId, enabled) => {
    return useQuery({
        queryKey: ["conductorScorecard", sessionId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/ai/conductor/${sessionId}/scorecard`);
            return res.data.scorecard;
        },
        enabled: !!sessionId && !!enabled,
        retry: false,
    });
};

/** Send message to AI Conductor from candidate */
export const useSendConductorMessage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sessionId, message, code, language }) =>
            axiosInstance.post(`/ai/conductor/${sessionId}/chat`, { message, code, language }).then(r => r.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["conductorMessages", variables.sessionId] });
        },
    });
};

/** Wrap up code & start Q&A phase */
export const useWrapUpConductor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sessionId, finalCode }) =>
            axiosInstance.post(`/ai/conductor/${sessionId}/wrapup`, { finalCode }).then(r => r.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["conductorMessages", variables.sessionId] });
            queryClient.invalidateQueries({ queryKey: ["session", variables.sessionId] });
        },
    });
};
