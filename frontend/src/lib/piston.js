import axiosInstance from "./axios";

/**
 * @param {string} language - programming language
 * @param {string} code - source code to execute
 * @param {string} input - optional standard input (stdin)
 * @returns {Promise<{success:boolean, output?:string, error?: string}>}
 */
export async function executeCode(language, code, input = "") {
    try {
        const response = await axiosInstance.post("/sessions/run-code", {
            language,
            code,
            input
        });

        const data = response.data;

        if (data.status === "error" || data.exit_code !== 0) {
            return {
                success: false,
                output: data.output || "",
                error: data.error || "Execution failed",
            };
        }

        return {
            success: true,
            output: data.output || "No output",
        };
    } catch (error) {
        console.error("Error executing code via backend proxy:", error);
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
        return {
            success: false,
            error: `Failed to execute code: ${errorMessage}`,
        };
    }
}