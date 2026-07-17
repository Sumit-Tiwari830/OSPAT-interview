import axios from "axios";

// Determine API URL dynamically based on environment
const getBaseURL = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    // If running in browser and deployed in a single-container (sharing same origin)
    if (typeof window !== "undefined") {
        return `${window.location.origin}/api`;
    }
    return "http://localhost:3000/api";
};

const axiosInstance = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
});

export default axiosInstance;