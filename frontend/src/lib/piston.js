// We are keeping the filename piston.js to avoid breaking your imports,
// but we are using the Judge0 API via RapidAPI behind the scenes.

// In Vite, environment variables are accessed using import.meta.env
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY;
const RAPIDAPI_HOST = "judge0-extra-ce1.p.rapidapi.com";
console.log("Key loaded:", import.meta.env.VITE_RAPIDAPI_KEY);

// Judge0 uses specific IDs for languages instead of versions
const LANGUAGE_IDS = {
    javascript: 93, // Node.js 18.15.0
    python: 71,     // Python 3.11.2
    java: 91,       // Java 17
    "c++": 54       // C++ (GCC 9.2.0)
};

/**
 * @param {string} language - programming language
 * @param {string} code - source code to executed
 * @returns {Promise<{success:boolean, output?:string, error?: string}>}
 */
export async function executeCode(language, code) {
    try {
        const languageId = LANGUAGE_IDS[language.toLowerCase()];

        if (!languageId) {
            return {
                success: false,
                error: `Unsupported language: ${language}`,
            };
        }

        // We use wait=true so the API returns the result immediately in one request
        const response = await fetch(`https://${RAPIDAPI_HOST}/submissions?base64_encoded=false&wait=true`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            },
            body: JSON.stringify({
                language_id: languageId,
                source_code: code
            })
        });

        if (response.status === 429) {
            return {
                success: false,
                error: "Too many requests! Please wait a moment before running your code again.",
            };
        }
        if (!response.ok) {
            return {
                success: false,
                error: `API Error! status: ${response.status}. Please check your API key in the .env file.`,
            };
        }

        const data = await response.json();

        // 1. Check for compilation errors (Java, C++)
        if (data.compile_output) {
            return {
                success: false,
                error: data.compile_output,
            };
        }

        // 2. Check for runtime errors (stderr) or time limit exceeded (status >= 6)
        if (data.stderr || (data.status && data.status.id >= 6)) {
            return {
                success: false,
                output: data.stdout || "",
                error: data.stderr || data.message || data.status?.description || "Execution failed",
            };
        }

        // 3. Success
        return {
            success: true,
            output: data.stdout || "No output",
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to execute code: ${error.message}`,
        };
    }
}