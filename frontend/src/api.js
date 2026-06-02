// frontend/src/api.js

export const executeCandidateCode = async (language, code, input = "") => {
    try {
        // Change 5000 to whatever port your Node backend is running on!
        const response = await fetch('http://localhost:5000/api/run', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language, code, input })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Execution failed');
        }
        
        return data; 
    } catch (err) {
        console.error("Code Execution Error:", err);
        return { success: false, error: err.message };
    }
};