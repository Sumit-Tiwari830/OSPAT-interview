import axios from './axios'; 

export const executeCode = async (language, code, input = "") => {
    try {
        const response = await axios.post('/api/code/run', {
            language,
            code,
            input
        });
        
        return response.data;
    } catch (error) {
        console.error("Failed to run code:", error);
        return {
            success: false,
            error: error.response?.data?.error || error.message || "An unknown error occurred."
        };
    }
};