import Editor from "@monaco-editor/react";
import { Loader2Icon, PlayIcon } from "lucide-react";

function CodeEditorPanel({
    // Accept ANY of the common variable names your parent page might be using
    language,           
    selectedLanguage,   
    
    // Accept ANY of the common function names your parent page might be using
    onLanguageChange,
    onChangeLanguage,
    setLanguage,

    code,
    isRunning,
    onCodeChange,
    onRunCode,
}) {
    // Grabs whichever state variable your parent page is actually passing down
    // Default changed to python since javascript is removed
    const currentLang = language || selectedLanguage || "python";

    const handleLanguageSelect = (e) => {
        const newLang = e.target.value;
        
        // Broadcasts the change to whichever wire the parent is actually listening to!
        // NOTE: This passes the string `newLang`, NOT the event!
        if (onLanguageChange) onLanguageChange(newLang);
        if (onChangeLanguage) onChangeLanguage(newLang);
        if (setLanguage) setLanguage(newLang);
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e]">
            {/* Header Toolbar */}
            <div className="flex justify-between items-center p-3 bg-gray-900 border-b border-gray-800">
                <select 
                    value={currentLang} 
                    onChange={handleLanguageSelect}
                    className="bg-gray-800 text-white rounded px-3 py-1 outline-none text-sm border border-gray-700 font-semibold cursor-pointer"
                >
                    {/* Removed JavaScript option */}
                    <option value="python">Python 3</option>
                    <option value="cpp">C++ (GCC)</option>
                    <option value="c">C (GCC)</option>
                    <option value="java">Java</option>
                </select>
                
                <button 
                    onClick={onRunCode} 
                    disabled={isRunning}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {isRunning ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <PlayIcon className="w-4 h-4" />}
                    {isRunning ? 'Running...' : 'Run Code'}
                </button>
            </div>
            
            {/* The Colorful Monaco Editor! */}
            <div className="flex-grow">
                <Editor
                    height="100%"
                    language={currentLang === 'cpp' || currentLang === 'c' ? 'cpp' : currentLang}
                    theme="vs-dark"
                    value={code}
                    onChange={(value) => {
                        if (onCodeChange) onCodeChange(value || '');
                    }}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        padding: { top: 16 }
                    }}
                />
            </div>
        </div>
    );
}

export default CodeEditorPanel;