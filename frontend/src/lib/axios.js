import axios from "axios";

// Determine API URL dynamically based on environment
const getBaseURL = () => {
    // In production, always resolve relative to the browser's active domain
    if (import.meta.env.PROD && typeof window !== "undefined") {
        return `${window.location.origin}/api`;
    }
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.trim();
    }
    return "http://localhost:3000/api";
};

const axiosInstance = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
});

export default axiosInstance;