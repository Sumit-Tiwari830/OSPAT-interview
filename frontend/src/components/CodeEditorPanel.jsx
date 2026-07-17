import Editor from "@monaco-editor/react";
import { Loader2Icon, PlayIcon, BookOpenIcon, TerminalIcon, CopyIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { LANGUAGE_CONFIG } from "../data/problems";

function CodeEditorPanel({
    selectedLanguage,
    code,
    isRunning,
    onLanguageChange,
    onCodeChange,
    onRunCode,
    compilerMode,
    onCompilerModeChange,
    problemTitle,
    readOnly = false,
}) {
    const handleCopy = () => {
        navigator.clipboard.writeText(code || "");
        toast.success("Code copied to clipboard!");
    };
    return (
        <div className="h-full bg-base-300 flex flex-col">
            {/* TABS HEADER */}
            <div className="flex border-b border-base-300 bg-base-200/50">
                <button
                    onClick={() => onCompilerModeChange("problem")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        compilerMode === "problem"
                            ? "border-primary text-primary bg-base-100"
                            : "border-transparent text-base-content/60 hover:text-base-content hover:bg-base-200/30"
                    }`}
                >
                    <BookOpenIcon className="size-4" />
                    <span>Problem: {problemTitle || "Active Problem"}</span>
                </button>
                <button
                    onClick={() => onCompilerModeChange("playground")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        compilerMode === "playground"
                            ? "border-primary text-primary bg-base-100"
                            : "border-transparent text-base-content/60 hover:text-base-content hover:bg-base-200/30"
                    }`}
                >
                    <TerminalIcon className="size-4" />
                    <span>Free Playground</span>
                </button>
            </div>

            {/* TOOLBAR */}
            <div className="flex items-center justify-between px-4 py-3 bg-base-100 border-b border-base-300">
                <div className="flex items-center gap-3">
                    <img
                        src={LANGUAGE_CONFIG[selectedLanguage].icon}
                        alt={LANGUAGE_CONFIG[selectedLanguage].name}
                        className="size-6"
                    />
                    <select className="select select-sm" value={selectedLanguage} onChange={onLanguageChange} disabled={readOnly}>
                        {Object.entries(LANGUAGE_CONFIG).map(([key, lang]) => (
                            <option key={key} value={key}>
                                {lang.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        className="btn btn-ghost btn-sm border border-base-300 gap-1.5" 
                        onClick={handleCopy}
                        title="Copy entire editor contents to clipboard"
                    >
                        <CopyIcon className="size-3.5" />
                        <span>Copy Code</span>
                    </button>
                    <button className="btn btn-primary btn-sm gap-2" disabled={isRunning || readOnly} onClick={onRunCode}>
                        {isRunning ? (
                            <>
                                <Loader2Icon className="size-4 animate-spin" />
                                Running...
                            </>
                        ) : (
                            <>
                                <PlayIcon className="size-4" />
                                Run Code
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* EDITOR */}
            <div className="flex-1">
                <Editor
                    height={"100%"}
                    language={LANGUAGE_CONFIG[selectedLanguage].monacoLang}
                    value={code}
                    onChange={onCodeChange}
                    theme="vs-dark"
                    options={{
                        fontSize: 16,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        minimap: { enabled: false },
                        readOnly: readOnly,
                    }}
                />
            </div>
        </div>
    );
}
export default CodeEditorPanel;