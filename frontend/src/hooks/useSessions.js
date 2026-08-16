import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { sessionApi } from "../api/sessions";

export const useCreateSession = () => {
    const result = useMutation({
        mutationKey: ["createSession"],
        mutationFn: sessionApi.createSession,
        onSuccess: () => toast.success("Session created successfully!"),
        onError: (error) => toast.error(error.response?.data?.message || "Failed to create room"),
    });

    return result;
};

export const useActiveSessions = () => {
    const result = useQuery({
        queryKey: ["activeSessions"],
        queryFn: sessionApi.getActiveSessions,
    });

    return result;
};

export const useMyRecentSessions = () => {
    const result = useQuery({
        queryKey: ["myRecentSessions"],
        queryFn: sessionApi.getMyRecentSessions,
    });

    return result;
};

export const useSessionById = (id) => {
    const result = useQuery({
        queryKey: ["session", id],
        queryFn: () => sessionApi.getSessionById(id),
        enabled: !!id,
        refetchInterval: (query) => {
            const session = query.state.data;
            // Stop polling if session has ended
            if (session?.status === "ended" || session?.status === "completed") {
                return false;
            }
            return 5000; // poll every 5 seconds while active
        },
    });

    return result;
};

export const useJoinSession = () => {
    const result = useMutation({
        mutationKey: ["joinSession"],
        mutationFn: sessionApi.joinSession,
        onSuccess: () => toast.success("Joined session successfully!"),
        onError: (error) => toast.error(error.response?.data?.message || "Failed to join session"),
    });

    return result;
};

export const useEndSession = () => {
    const result = useMutation({
        mutationKey: ["endSession"],
        mutationFn: sessionApi.endSession,
        onSuccess: () => toast.success("Session ended successfully!"),
        onError: (error) => toast.error(error.response?.data?.message || "Failed to end session"),
    });

    return result;
};

export const useSubmitCode = () => {
    const result = useMutation({
        mutationKey: ["submitCode"],
        mutationFn: ({ id, code, language }) => sessionApi.submitCode({ id, code, language }),
        onSuccess: () => toast.success("Solution submitted successfully!"),
        onError: (error) => toast.error(error.response?.data?.message || "Failed to submit solution"),
    });

    return result;
};

export const useUploadResume = () => {
    const result = useMutation({
        mutationKey: ["uploadResume"],
        mutationFn: ({ id, resumeText, resumeFileUrl, resumeFileName, model }) => 
            sessionApi.uploadResume({ id, resumeText, resumeFileUrl, resumeFileName, model }),
        onSuccess: () => toast.success("Resume uploaded and summarized successfully!"),
        onError: (error) => toast.error(error.response?.data?.message || "Failed to upload resume"),
    });

    return result;
};

export const useChangeQuestion = () => {
    const result = useMutation({
        mutationKey: ["changeQuestion"],
        mutationFn: ({ id, problem, customDescription, difficulty }) =>
            sessionApi.changeQuestion({ id, problem, customDescription, difficulty }),
        onSuccess: () => toast.success("Question updated successfully! Workspace cleared."),
        onError: (error) => toast.error(error.response?.data?.message || "Failed to update question"),
    });

    return result;
};

export const useTranscribeAudio = () => {
    const result = useMutation({
        mutationKey: ["transcribeAudio"],
        mutationFn: ({ id, audioBlob }) => sessionApi.transcribeAudio({ id, audioBlob }),
        onError: (error) => toast.error(error.response?.data?.message || "Failed to transcribe audio"),
    });

    return result;
};