export const executeCode = async (req, res) => {
    const { language, code, input = "" } = req.body;

    if (!language || !code) {
        return res.status(400).json({ error: "Language and code are required." });
    }

    const languageMap = {
        "python": "python-3.14",
        "c": "gcc-15",
        "c++": "g++-15",
        "cpp": "g++-15",
        "java": "java-25",
        "javascript": "deno",
    };

    const compiler = languageMap[language.toLowerCase()];
    
    if (!compiler) {
        return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    try {
        const response = await fetch('https://api.onlinecompiler.io/api/run-code-sync/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': process.env.ONLINE_COMPILER_API_KEY 
            },
            body: JSON.stringify({ compiler, code, input })
        });

        if (!response.ok) {
            throw new Error(`Compiler API returned status: ${response.status}`);
        }

        const data = await response.json();

        return res.status(200).json({
            success: data.exit_code === 0,
            output: data.output || "",
            error: data.error || "",
            executionTime: data.time,
            memory: data.memory
        });
    } catch (error) {
        console.error("Execution Service Error:", error);
        return res.status(500).json({ error: "Failed to execute code on the server." });
        }
};