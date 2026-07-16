import { QRCodeSVG } from 'qrcode.react';
import axiosInstance from "../lib/axios";
import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useEndSession, useSessionById } from "../hooks/useSessions";
import { PROBLEMS } from "../data/problems";
import { executeCode } from "../lib/piston";
import Navbar from "../components/Navbar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getDifficultyBadgeClass } from "../lib/utils";
import { Loader2Icon, LogOutIcon, PhoneOffIcon, ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import CodeEditorPanel from "../components/CodeEditorPanel";
import OutputPanel from "../components/OutputPanel";
import { useUpdateSessionSettings } from "../hooks/useUpdateSession";

import useStreamClient from "../hooks/useStreamClient";
import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import VideoCallUI from "../components/VideoCallUI";

const PLAYGROUND_STARTER_CODES = {
    javascript: `// Write your JavaScript/TypeScript code here\nconsole.log("Hello, World!");\n`,
    python: `# Write your Python code here\nprint("Hello, World!")\n`,
    java: `// Write your Java code here\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`
};

function SessionPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useUser();
    const [compilerMode, setCompilerMode] = useState("problem");
    const [problemCode, setProblemCode] = useState("");
    const [playgroundCode, setPlaygroundCode] = useState(PLAYGROUND_STARTER_CODES.javascript);
    const [customInput, setCustomInput] = useState("");
    const [problemOutput, setProblemOutput] = useState(null);
    const [playgroundOutput, setPlaygroundOutput] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState("javascript");
    const [proctorPayload, setProctorPayload] = useState(null);
    const [fullscreenWarning, setFullscreenWarning] = useState(false);
    const [needsFullscreen, setNeedsFullscreen] = useState(false); // true = show enter-fullscreen prompt
    const [flags, setFlags] = useState([]);
    const [showFlags, setShowFlags] = useState(false);

    const { data: sessionData, isLoading: loadingSession } = useSessionById(id);
    const endSessionMutation = useEndSession();
    const updateSettingsMutation = useUpdateSessionSettings();

    const session = sessionData?.session;
    const isHost = session?.host?.clerkId === user?.id;
    const isParticipant = session?.participant?.clerkId === user?.id;

    // --- PROCTORING: flags state for host view ---
    // (state declared above at top of component)

    const { call, channel, chatClient, isInitializingCall, streamClient } = useStreamClient(
        session,
        loadingSession,
        isHost,
        isParticipant
    );

    // find the problem data based on session problem title
    const problemData = session?.problem
        ? Object.values(PROBLEMS).find((p) => p.title === session.problem)
        : null;

    // --- NEW PROCTORING LOGIC ---

    // Fetch the token using your built-in Axios configuration
    useEffect(() => {
        if (isParticipant && session?.status === "active" && session?.callId) {
            const fetchProctorToken = async () => {
                try {
                    const response = await axiosInstance.get('/sessions/proctor-token');
                    
                    const jsonPayload = JSON.stringify({
                        callId: session.callId, 
                        token: response.data.token
                    });
                    
                    setProctorPayload(jsonPayload);
                } catch (error) {
                    console.error("Failed to fetch proctor token:", error);
                }
            };
            fetchProctorToken();
        }
    }, [isParticipant, session?.status, session?.callId]);
    // ----------------------------

    // --- PROCTORING: fullscreen enforcement (participant only) ---

    // Step 1: Show "Enter Fullscreen" prompt when fullscreenRequired is true
    // We do NOT call requestFullscreen() automatically — browsers block it without a user gesture
    useEffect(() => {
        if (!isParticipant || !session?.fullscreenRequired || loadingSession) return;
        if (!document.fullscreenElement) {
            setNeedsFullscreen(true); // triggers the click-to-enter overlay
        }
    }, [isParticipant, session?.fullscreenRequired, loadingSession]);

    // Step 2: Detect violations and send flags
    useEffect(() => {
        if (!isParticipant || !session?.fullscreenRequired || loadingSession) return;

        // Debounce to avoid duplicate flags from rapid events
        let flagTimeout = null;
        const sendFlag = (reason) => {
            clearTimeout(flagTimeout);
            flagTimeout = setTimeout(async () => {
                try {
                    await axiosInstance.post('/flags', {
                        sessionId: session.sessionId,
                        reason,
                    });
                    console.log('Flag sent:', reason);
                } catch (err) {
                    console.error('Failed to send flag:', err);
                }
            }, 300);
        };

        // Fullscreen exit handler
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setFullscreenWarning(true);
                setNeedsFullscreen(false);
                sendFlag('Exited fullscreen');
            } else {
                // Entered fullscreen — clear both prompts
                setFullscreenWarning(false);
                setNeedsFullscreen(false);
            }
        };

        // Tab switch / window minimize handler (more reliable than blur)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                sendFlag('Switched tab or minimized window');
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(flagTimeout);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isParticipant, session?.fullscreenRequired, session?.sessionId, loadingSession]);
    // -----------------------------------------------------------



    // --- NEW SECURITY GATEKEEPER ---
    // If the room loads and the user is neither the host nor the pre-authorized participant, kick them out!
    useEffect(() => {
        if (!session || !user || loadingSession) return;
        
        if (!isHost && !isParticipant) {
            navigate("/dashboard");
        }
    }, [session, user, loadingSession, isHost, isParticipant, navigate]);
    // -------------------------------

    // redirect the "participant" when session ends — also exit fullscreen cleanly
    useEffect(() => {
        if (!session || loadingSession) return;

        if (session.status === "completed") {
            // Exit fullscreen before leaving the page
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            navigate("/dashboard");
        }
    }, [session, loadingSession, navigate]);


    // update code when problem loads or changes
    useEffect(() => {
        if (problemData?.starterCode?.[selectedLanguage]) {
            setProblemCode(problemData.starterCode[selectedLanguage]);
        }
    }, [problemData, selectedLanguage]);

    // --- HOST: poll flags from backend ---
    useEffect(() => {
        if (!isHost || !session?.sessionId || session?.status !== "active") return;
        const fetchFlags = async () => {
            try {
                const res = await axiosInstance.get(`/flags/${session.sessionId}`);
                setFlags(res.data.flags || []);
            } catch (err) {
                console.error("Failed to fetch flags:", err);
            }
        };
        fetchFlags();
        const interval = setInterval(fetchFlags, 8000);
        return () => clearInterval(interval);
    }, [isHost, session?.sessionId, session?.status]);

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        setSelectedLanguage(newLang);
        
        if (compilerMode === "problem") {
            const starterCode = problemData?.starterCode?.[newLang] || "";
            setProblemCode(starterCode);
            setProblemOutput(null);
        } else {
            setPlaygroundCode(PLAYGROUND_STARTER_CODES[newLang]);
            setPlaygroundOutput(null);
        }
    };

    const handleRunCode = async () => {
        setIsRunning(true);

        try {
            if (compilerMode === "problem") {
                setProblemOutput(null);
                const result = await executeCode(selectedLanguage, problemCode);
                setProblemOutput(result);
            } else {
                setPlaygroundOutput(null);
                const result = await executeCode(selectedLanguage, playgroundCode, customInput);
                setPlaygroundOutput(result);
            }
        } finally {
            setIsRunning(false);
        }
    };

    const handleEndSession = () => {
        if (confirm("Are you sure you want to end this session? All participants will be notified.")) {
            // this will navigate the HOST to dashboard
            endSessionMutation.mutate(id, { onSuccess: () => navigate("/dashboard") });
        }
    };

    return (
        <div className="h-screen bg-base-100 flex flex-col">
            <Navbar />

            {/* --- FULLSCREEN OVERLAY (participant only) --- */}
            {/* Shows on first load (needsFullscreen) OR after exiting (fullscreenWarning) */}
            {isParticipant && session?.fullscreenRequired && (needsFullscreen || fullscreenWarning) && (
                <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center">
                    <div className={`rounded-2xl p-8 max-w-md text-center shadow-2xl ${
                        fullscreenWarning
                            ? "bg-error text-error-content"
                            : "bg-base-100 text-base-content border border-primary/30"
                    }`}>
                        <div className="text-5xl mb-4">
                            {fullscreenWarning ? "⚠️" : "🔲"}
                        </div>
                        <h2 className="text-2xl font-bold mb-2">
                            {fullscreenWarning
                                ? "You Left Fullscreen!"
                                : "Fullscreen Required"}
                        </h2>
                        <p className="text-sm opacity-75 mb-6">
                            {fullscreenWarning
                                ? "A violation flag has been recorded. Please return to fullscreen immediately."
                                : "This interview requires fullscreen mode. Click below to begin."}
                        </p>
                        <button
                            id="enter-fullscreen-btn"
                            className={`btn btn-lg w-full ${
                                fullscreenWarning ? "btn-neutral" : "btn-primary"
                            }`}
                            onClick={async () => {
                                try {
                                    await document.documentElement.requestFullscreen();
                                    setNeedsFullscreen(false);
                                    setFullscreenWarning(false);
                                } catch (e) {
                                    console.warn("Could not enter fullscreen:", e);
                                }
                            }}
                        >
                            {fullscreenWarning ? "↩ Return to Fullscreen" : "▶ Enter Fullscreen to Start"}
                        </button>
                    </div>
                </div>
            )}
            {/* ----------------------------------------------- */}

            <div className="flex-1">
                <PanelGroup direction="horizontal">
                    {/* LEFT PANEL - CODE EDITOR & PROBLEM DETAILS */}
                    <Panel defaultSize={50} minSize={30}>
                        <PanelGroup direction="vertical">
                            {/* PROBLEM DSC PANEL */}
                            <Panel defaultSize={50} minSize={20}>
                                <div className="h-full overflow-y-auto bg-base-200">
                                    {/* HEADER SECTION */}
                                    <div className="p-6 bg-base-100 border-b border-base-300">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h1 className="text-3xl font-bold text-base-content">
                                                    {session?.problem || "Loading..."}
                                                </h1>

                                                {/* --- NEW: INTERVIEW CREDENTIALS BOX --- */}
                                                <div className="mt-4 mb-4 p-4 bg-base-200 border border-primary/20 rounded-xl inline-block shadow-sm">
                                                    <p className="text-xs text-base-content/60 uppercase tracking-wider font-bold mb-2">
                                                        Interview Credentials
                                                    </p>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-base-content/80">Room ID:</span>
                                                            <span className="bg-primary/10 text-primary px-2 py-1 rounded font-mono font-bold tracking-widest text-lg">
                                                                {session?.sessionId || "Generating..."}
                                                            </span>
                                                        </div>
                                                        {isHost && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-base-content/80">Password:</span>
                                                                <span className="bg-secondary/10 text-secondary px-2 py-1 rounded font-mono font-bold tracking-widest">
                                                                    {session?.password || "..."}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* -------------------------------------- */}

                                                {/* --- PROCTORING PANEL (Host only) --- */}
                                                {isHost && session?.status === "active" && (
                                                    <div className="mt-4 p-4 bg-base-200 border border-warning/30 rounded-xl space-y-3">
                                                        {/* Header row */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                {flags.length > 0 ? (
                                                                    <ShieldAlertIcon className="w-4 h-4 text-warning" />
                                                                ) : (
                                                                    <ShieldCheckIcon className="w-4 h-4 text-success" />
                                                                )}
                                                                <span className="text-sm font-bold text-base-content/80">
                                                                    Proctoring
                                                                </span>
                                                                {flags.length > 0 && (
                                                                    <span className="badge badge-warning badge-sm">
                                                                        {flags.length} flag{flags.length > 1 ? "s" : ""}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                className="btn btn-xs btn-ghost"
                                                                onClick={() => setShowFlags((v) => !v)}
                                                            >
                                                                {showFlags ? "Hide" : "View flags"}
                                                            </button>
                                                        </div>

                                                        {/* Fullscreen toggle */}
                                                        <label className="flex items-center gap-3 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="toggle toggle-warning toggle-sm"
                                                                checked={session?.fullscreenRequired || false}
                                                                onChange={(e) =>
                                                                    updateSettingsMutation.mutate({
                                                                        id: session._id,
                                                                        settings: { fullscreenRequired: e.target.checked },
                                                                    })
                                                                }
                                                                disabled={updateSettingsMutation.isPending}
                                                            />
                                                            <span className="text-xs text-base-content/70">
                                                                Force fullscreen on candidate
                                                            </span>
                                                        </label>

                                                        {/* Flag list */}
                                                        {showFlags && (
                                                            <div className="max-h-40 overflow-y-auto space-y-1">
                                                                {flags.length === 0 ? (
                                                                    <p className="text-xs text-base-content/50 italic">No violations detected.</p>
                                                                ) : (
                                                                    flags.map((f, i) => (
                                                                        <div key={f._id || i} className="flex items-center justify-between bg-base-100 rounded px-3 py-1.5 text-xs">
                                                                            <span className="text-warning font-semibold">⚑ {f.reason}</span>
                                                                            <span className="text-base-content/40">
                                                                                {new Date(f.createdAt).toLocaleTimeString()}
                                                                            </span>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {/* ------------------------------------------- */}


                                                {problemData?.category && (
                                                    <p className="text-base-content/60 mt-1">{problemData.category}</p>
                                                )}

                                                <p className="text-base-content/60 mt-2">
                                                    Host: {session?.host?.name || "Loading..."} •{" "}
                                                    {session?.participant ? 2 : 1}/2 participants
                                                </p>

                                                {/* PROCTORING QR CODE - Participant View Only */}
                                                {isParticipant && session?.status === "active" && proctorPayload && (
                                                    <div className="mt-4 p-4 bg-base-200 border border-primary/20 rounded-xl flex items-center gap-4 inline-flex">
                                                        <div className="bg-white p-2 rounded-lg shadow-sm">
                                                            <QRCodeSVG value={proctorPayload} size={128} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-sm text-primary mb-1">Secondary Camera Required</h3>
                                                            <p className="text-xs text-base-content/70 max-w-[150px]">
                                                                Scan with your mobile app to activate your proctoring feed.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`badge badge-lg ${getDifficultyBadgeClass(
                                                        session?.difficulty
                                                    )}`}
                                                >
                                                    {session?.difficulty.slice(0, 1).toUpperCase() +
                                                        session?.difficulty.slice(1) || "Easy"}
                                                </span>
                                                {isHost && session?.status === "active" && (
                                                    <button
                                                        onClick={handleEndSession}
                                                        disabled={endSessionMutation.isPending}
                                                        className="btn btn-error btn-sm gap-2"
                                                    >
                                                        {endSessionMutation.isPending ? (
                                                            <Loader2Icon className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <LogOutIcon className="w-4 h-4" />
                                                        )}
                                                        End Session
                                                    </button>
                                                )}
                                                {session?.status === "completed" && (
                                                    <span className="badge badge-ghost badge-lg">Completed</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* problem desc */}
                                        {problemData?.description && (
                                            <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                                                <h2 className="text-xl font-bold mb-4 text-base-content">Description</h2>
                                                <div className="space-y-3 text-base leading-relaxed">
                                                    <p className="text-base-content/90">{problemData.description.text}</p>
                                                    {problemData.description.notes?.map((note, idx) => (
                                                        <p key={idx} className="text-base-content/90">
                                                            {note}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* examples section */}
                                        {problemData?.examples && problemData.examples.length > 0 && (
                                            <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                                                <h2 className="text-xl font-bold mb-4 text-base-content">Examples</h2>

                                                <div className="space-y-4">
                                                    {problemData.examples.map((example, idx) => (
                                                        <div key={idx}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="badge badge-sm">{idx + 1}</span>
                                                                <p className="font-semibold text-base-content">Example {idx + 1}</p>
                                                            </div>
                                                            <div className="bg-base-200 rounded-lg p-4 font-mono text-sm space-y-1.5">
                                                                <div className="flex gap-2">
                                                                    <span className="text-primary font-bold min-w-[70px]">
                                                                        Input:
                                                                    </span>
                                                                    <span>{example.input}</span>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <span className="text-secondary font-bold min-w-[70px]">
                                                                        Output:
                                                                    </span>
                                                                    <span>{example.output}</span>
                                                                </div>
                                                                {example.explanation && (
                                                                    <div className="pt-2 border-t border-base-300 mt-2">
                                                                        <span className="text-base-content/60 font-sans text-xs">
                                                                            <span className="font-semibold">Explanation:</span>{" "}
                                                                            {example.explanation}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Constraints */}
                                        {problemData?.constraints && problemData.constraints.length > 0 && (
                                            <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                                                <h2 className="text-xl font-bold mb-4 text-base-content">Constraints</h2>
                                                <ul className="space-y-2 text-base-content/90">
                                                    {problemData.constraints.map((constraint, idx) => (
                                                        <li key={idx} className="flex gap-2">
                                                            <span className="text-primary">•</span>
                                                            <code className="text-sm">{constraint}</code>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Panel>

                            <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

                            <Panel defaultSize={50} minSize={20}>
                                <PanelGroup direction="vertical">
                                    <Panel defaultSize={70} minSize={30}>
                                        <CodeEditorPanel
                                            selectedLanguage={selectedLanguage}
                                            code={compilerMode === "problem" ? problemCode : playgroundCode}
                                            isRunning={isRunning}
                                            onLanguageChange={handleLanguageChange}
                                            onCodeChange={(value) => {
                                                if (compilerMode === "problem") {
                                                    setProblemCode(value);
                                                } else {
                                                    setPlaygroundCode(value);
                                                }
                                            }}
                                            onRunCode={handleRunCode}
                                            compilerMode={compilerMode}
                                            onCompilerModeChange={(mode) => setCompilerMode(mode)}
                                            problemTitle={session?.problem}
                                        />
                                    </Panel>

                                    <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

                                    <Panel defaultSize={30} minSize={15}>
                                        {compilerMode === "problem" ? (
                                            <OutputPanel output={problemOutput} />
                                        ) : (
                                            <div className="h-full bg-base-100 flex flex-col md:flex-row">
                                                {/* Left Half: Custom Input (stdin) */}
                                                <div className="flex-1 border-b md:border-b-0 md:border-r border-base-300 flex flex-col min-w-[200px]">
                                                    <div className="px-4 py-2 bg-base-200 border-b border-base-300 font-semibold text-sm flex items-center justify-between text-base-content/85">
                                                        <span>Custom Input (stdin)</span>
                                                        <span className="text-[10px] bg-base-300 px-1.5 py-0.5 rounded text-base-content/60 uppercase font-mono">stdin</span>
                                                    </div>
                                                    <textarea
                                                        value={customInput}
                                                        onChange={(e) => setCustomInput(e.target.value)}
                                                        placeholder="Provide custom input for execution here..."
                                                        className="flex-1 w-full p-4 bg-base-100 text-sm font-mono focus:outline-none resize-none text-base-content"
                                                    />
                                                </div>
                                                {/* Right Half: Output (stdout/stderr) */}
                                                <div className="flex-1 flex flex-col min-w-[200px]">
                                                    <OutputPanel output={playgroundOutput} />
                                                </div>
                                            </div>
                                        )}
                                    </Panel>
                                </PanelGroup>
                            </Panel>
                        </PanelGroup>
                    </Panel>

                    <PanelResizeHandle className="w-2 bg-base-300 hover:bg-primary transition-colors cursor-col-resize" />

                    {/* RIGHT PANEL - VIDEO CALLS & CHAT */}
                    <Panel defaultSize={50} minSize={30}>
                        <div className="h-full bg-base-200 p-4 overflow-auto">
                            {isInitializingCall ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                                        <p className="text-lg">Connecting to video call...</p>
                                    </div>
                                </div>
                            ) : !streamClient || !call ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="card bg-base-100 shadow-xl max-w-md">
                                        <div className="card-body items-center text-center">
                                            <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mb-4">
                                                <PhoneOffIcon className="w-12 h-12 text-error" />
                                            </div>
                                            <h2 className="card-title text-2xl">Connection Failed</h2>
                                            <p className="text-base-content/70">Unable to connect to the video call</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full">
                                    <StreamVideo client={streamClient}>
                                        <StreamCall call={call}>
                                            <VideoCallUI chatClient={chatClient} channel={channel} />
                                        </StreamCall>
                                    </StreamVideo>
                                </div>
                            )}
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
}

export default SessionPage;