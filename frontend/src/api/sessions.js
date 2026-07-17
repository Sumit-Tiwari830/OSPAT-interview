import axiosInstance from "../lib/axios";

export const sessionApi = {
    createSession: async (data) => {
        const response = await axiosInstance.post("/sessions", data);
        return response.data;
    },

    getActiveSessions: async () => {
        const response = await axiosInstance.get("/sessions/active");
        return response.data;
    },
    getMyRecentSessions: async () => {
        const response = await axiosInstance.get("/sessions/my-recent");
        return response.data;
    },

    getSessionById: async (id) => {
        const response = await axiosInstance.get(`/sessions/${id}`);
        return response.data;
    },

    joinSession: async (id) => {
        const response = await axiosInstance.post(`/sessions/${id}/join`);
        return response.data;
    },
    endSession: async ({ id, finalCode, finalLanguage }) => {
        const response = await axiosInstance.post(`/sessions/${id}/end`, { finalCode, finalLanguage });
        return response.data;
    },
    getStreamToken: async () => {
        const response = await axiosInstance.get(`/chat/token`);
        return response.data;
    },
    submitCode: async ({ id, code, language }) => {
        const response = await axiosInstance.post(`/sessions/${id}/submit-code`, { code, language });
        return response.data;
    },
    uploadResume: async ({ id, resumeText, resumeFileUrl, resumeFileName, model }) => {
        const response = await axiosInstance.post(`/sessions/${id}/resume`, { resumeText, resumeFileUrl, resumeFileName, model });
        return response.data;
    },
    transcribeAudio: async ({ id, audioBlob }) => {
        const formData = new FormData();
        formData.append("file", audioBlob, "candidate_answer.wav");
        const response = await axiosInstance.post(`/sessions/${id}/transcribe`, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    },
    generateSpeech: async ({ id, text }) => {
        const response = await axiosInstance.post(`/sessions/${id}/tts`, { text }, {
            responseType: "blob"
        });
        return response.data;
    },
    changeQuestion: async ({ id, problem, customDescription, difficulty }) => {
        const response = await axiosInstance.patch(`/sessions/${id}/question`, { problem, customDescription, difficulty });
        return response.data;
    },
};