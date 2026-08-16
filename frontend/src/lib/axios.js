import axios from "axios";

// Determine API URL dynamically based on environment
const getBaseURL = () => {
    // If an explicit API URL is set (production on Vercel pointing to Render),
    // always use it regardless of PROD/DEV mode
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.trim();
    }
    // Local development fallback
    return "http://localhost:3000/api";
};

const axiosInstance = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
});

export default axiosInstance;