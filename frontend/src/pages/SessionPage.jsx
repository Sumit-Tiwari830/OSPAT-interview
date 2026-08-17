import { QRCodeSVG } from 'qrcode.react';
import axiosInstance from "../lib/axios";
import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useEndSession, useSessionById, useSubmitCode, useUploadResume, useChangeQuestion } from "../hooks/useSessions";
import { useCodeReview } from "../hooks/useCodeReview";
import { PROBLEMS } from "../data/problems";
import { executeCode } from "../lib/piston";
import { extractTextFromPdf } from "../lib/pdfParser";
import Navbar from "../components/Navbar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getDifficultyBadgeClass } from "../lib/utils";
import { Loader2Icon, LogOutIcon, PhoneOffIcon, ShieldAlertIcon, ShieldCheckIcon, PlusIcon, AlertTriangleIcon, CopyIcon, UploadIcon, SparklesIcon } from "lucide-react";
import CodeEditorPanel from "../components/CodeEditorPanel";
import OutputPanel from "../components/OutputPanel";
import { useUpdateSessionSettings } from "../hooks/useUpdateSession";
import ConductorPanel from "../components/ConductorPanel";
import { useConductorMessages, useStartConductor, usePushCode, useSendConductorMessage } from "../hooks/useConductor";

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

    // Resume uploader state
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [resumeText, setResumeText] = useState("");
    const [showRawResumeModal, setShowRawResumeModal] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfFileName, setPdfFileName] = useState("");
    const [model, setModel] = useState("gemini");
    const [selectedSummaryModel, setSelectedSummaryModel] = useState("gemini");
    const [timeLeft, setTimeLeft] = useState(null);
    const [resumeFileUrl, setResumeFileUrl] = useState("");

    // Change question state
    const [showChangeQuestionModal, setShowChangeQuestionModal] = useState(false);
    const [changeQuestionConfig, setChangeQuestionConfig] = useState({
        problem: "",
        customDescription: "",
        difficulty: "medium",
        problemType: "preset",
    });

    const [activeLeftTab, setActiveLeftTab] = useState("question");

    const { data: sessionData, isLoading: loadingSession } = useSessionById(id);
    
    // Derived values
    const session = sessionData?.session;
    const isHost = session?.host?.clerkId === user?.id;
    const isParticipant = session?.participant?.clerkId === user?.id;

    // Fetch live code review for the interviewer in real-time
    const { data: review, isLoading: reviewLoading } = useCodeReview(isHost && id ? id : null);

    const endSessionMutation = useEndSession();
    const submitCodeMutation = useSubmitCode();
    const uploadResumeMutation = useUploadResume();
    const changeQuestionMutation = useChangeQuestion();
    const updateSettingsMutation = useUpdateSessionSettings();

    // Conductor hooks — must come AFTER session/isHost are defined
    const startConductorMutation = useStartConductor();
    const pushCodeMutation = usePushCode();
    const sendConductorMsgMutation = useSendConductorMessage();
    const { data: conductorMessages = [], isLoading: conductorLoading } = useConductorMessages(
        session?.type === "ai" && session?.status === "active" ? id : null
    );

    // Initialize Stream video and chat ONLY for personal interviews
    const shouldInitStream = session?.type === "personal" && !loadingSession;
    const { call, channel, chatClient, isInitializingCall, streamClient } = useStreamClient(
        shouldInitStream ? session : null,
        loadingSession,
        isHost,
        isParticipant
    );

    // find the problem data based on session problem title
    const problemData = session?.problem
        ? Object.values(PROBLEMS).find((p) => p.title === session.problem)
        : null;

    const handleCopyCode = () => {
        navigator.clipboard.writeText(session?.finalCode || "");
        toast.success("Submitted code copied to clipboard!");
    };

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
                sendFlag('Re-entered fullscreen');
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
        if (!session || loadingSession || isHost) return; // Host stays on page or goes to review

        if (session.status === "completed") {
            // Exit fullscreen before leaving the page
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            navigate("/dashboard");
        }
    }, [session, loadingSession, isHost, navigate]);

    // Load candidate's submitted/saved code when session mounts
    const [hasLoadedSubmittedCode, setHasLoadedSubmittedCode] = useState(false);
    useEffect(() => {
        if (session?.finalCode && !hasLoadedSubmittedCode) {
            setProblemCode(session.finalCode);
            if (session.finalLanguage) {
                setSelectedLanguage(session.finalLanguage);
            }
            setHasLoadedSubmittedCode(true);
        }
    }, [session?.finalCode, hasLoadedSubmittedCode]);

    // Reset editor workspace whenever the problem title changes
    useEffect(() => {
        if (session?.problem) {
            setHasLoadedSubmittedCode(false);
            const starterCode = problemData?.starterCode?.[selectedLanguage] || "";
            setProblemCode(starterCode);
            setProblemOutput(null);
        }
    }, [session?.problem, problemData, selectedLanguage]);

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

    // --- Start AI conductor once when session becomes active (AI sessions only - after resume uploaded) ---
    useEffect(() => {
        if (session?.type !== "ai" || !session?._id || session?.status !== "active" || !problemData) return;
        // Resume is mandatory for AI interview
        if (!session?.candidateResumeText) return;

        // Only start once — if no messages yet
        if (conductorMessages.length === 0 && !startConductorMutation.isPending) {
            startConductorMutation.mutate({
                sessionId: session._id,
                problemTitle: session.problem,
            });
        }
    }, [session?.type, session?._id, session?.status, problemData, session?.candidateResumeText]);

    // --- Push code to conductor every 60s (AI sessions only) ---
    useEffect(() => {
        if (session?.type !== "ai" || session?.status !== "active") return;
        const startTime = Date.now();
        const interval = setInterval(() => {
            const code = compilerMode === "problem" ? problemCode : playgroundCode;
            const elapsed = Math.floor((Date.now() - startTime) / 60000);
            pushCodeMutation.mutate({
                sessionId: id,
                code,
                language: selectedLanguage,
                timeElapsedMinutes: elapsed,
            });
        }, 60000); // every 60 seconds
        return () => clearInterval(interval);
    }, [session?.type, session?.status, compilerMode, problemCode, playgroundCode, selectedLanguage, id]);

    // --- Active session timer countdown effect ---
    useEffect(() => {
        if (!session || session.status !== "active" || session.type !== "ai") return;

        const durationSeconds = (session.duration || 30) * 60;
        const createdTime = new Date(session.createdAt).getTime();

        const updateTimer = () => {
            const elapsedSeconds = Math.floor((Date.now() - createdTime) / 1000);
            const remaining = durationSeconds - elapsedSeconds;
            if (remaining <= 0) {
                setTimeLeft(0);
                // Auto end session when time runs out
                if (session.type === "ai") {
                    endSessionMutation.mutate({ id });
                }
            } else {
                setTimeLeft(remaining);
            }
        };

        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);
        return () => clearInterval(timerInterval);
    }, [session?.status, session?.duration, session?.createdAt, id]);

    const formatTime = (seconds) => {
        if (seconds === null || seconds < 0) return "--:--";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

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
            endSessionMutation.mutate(
                { id },
                { onSuccess: () => navigate(`/review/${id}`) } // redirect host to review
            );
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
                                                                    <span className="badge badge-warning badge-sm whitespace-nowrap">
                                                                        {flags.length} flag{flags.length > 1 ? "s" : ""}
                                                                    </span>
                                                                )}
                                                                {/* --- LIVE STUDENT FULLSCREEN INDICATOR --- */}
                                                                {(() => {
                                                                    const lastFlag = flags.length > 0 ? flags[flags.length - 1] : null;
                                                                    const isExited = lastFlag && (lastFlag.reason === "Exited fullscreen" || lastFlag.reason === "Switched tab or minimized window");
                                                                    return (
                                                                        <span className={`badge badge-sm font-semibold gap-1 whitespace-nowrap ${isExited ? "badge-error animate-pulse text-white" : "badge-success text-white"}`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${isExited ? "bg-red-100" : "bg-green-100"}`}></span>
                                                                            {isExited ? "Student: Exited Fullscreen 🔴" : "Student: In Fullscreen 🟢"}
                                                                        </span>
                                                                    );
                                                                })()}
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

                                                {/* --- NEW: AI RESUME SUMMARY (Host only) --- */}
                                                {isHost && (
                                                    <div className="mt-4 p-4 bg-base-200 border border-primary/20 rounded-xl space-y-2">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <span className="text-xs text-base-content/60 uppercase tracking-wider font-bold block">
                                                                Candidate Resume Analysis
                                                            </span>
                                                            {session?.candidateResumeText && (
                                                                <button 
                                                                    onClick={() => setShowRawResumeModal(true)}
                                                                    className="btn btn-xs btn-outline btn-primary font-bold whitespace-nowrap"
                                                                >
                                                                    View Actual Resume
                                                                </button>
                                                            )}
                                                        </div>
                                                        {session?.candidateResumeText ? (
                                                            session?.resumeSummary ? (
                                                                <div className="text-sm prose prose-sm text-base-content/85 whitespace-pre-wrap">
                                                                    {session.resumeSummary}
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-3">
                                                                    <p className="text-xs text-base-content/65">
                                                                        Resume uploaded by candidate! Choose an AI model to generate a summary:
                                                                    </p>
                                                                    <div className="flex items-center gap-2">
                                                                        <select 
                                                                            value={selectedSummaryModel} 
                                                                            onChange={(e) => setSelectedSummaryModel(e.target.value)}
                                                                            className="select select-xs select-bordered focus:outline-none"
                                                                            disabled={uploadResumeMutation.isPending}
                                                                        >
                                                                            <option value="gemini">Gemini</option>
                                                                            <option value="grok">Grok (Groq)</option>
                                                                        </select>
                                                                        <button
                                                                            onClick={() => {
                                                                                uploadResumeMutation.mutate({
                                                                                    id,
                                                                                    resumeText: session.candidateResumeText,
                                                                                    resumeFileUrl: session.candidateResumeFileUrl,
                                                                                    resumeFileName: session.candidateResumeFileName,
                                                                                    model: selectedSummaryModel
                                                                                });
                                                                            }}
                                                                            disabled={uploadResumeMutation.isPending}
                                                                            className="btn btn-xs btn-primary text-white"
                                                                        >
                                                                            {uploadResumeMutation.isPending && <span className="loading loading-spinner loading-xs" />}
                                                                            Generate Summary
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        ) : (
                                                            <p className="text-xs text-base-content/50 italic">
                                                                No resume uploaded by candidate yet.
                                                                {session?.type === "ai" && " (Candidate must upload a resume before starting)"}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* --- NEW: JOB DESCRIPTION (AI practice / Host reference) --- */}
                                                {session?.jobDescription && (
                                                    <div className="mt-4 p-4 bg-base-200 border border-primary/20 rounded-xl space-y-2">
                                                        <span className="text-xs text-base-content/60 uppercase tracking-wider font-bold block">
                                                            Target Job Role & JD
                                                        </span>
                                                        <p className="text-xs text-base-content/80 whitespace-pre-wrap">
                                                            {session.jobDescription}
                                                        </p>
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
                                                 {/* Running Timer */}
                                                 {session?.status === "active" && session?.type === "ai" && timeLeft !== null && (
                                                     <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-black border transition-all ${
                                                         timeLeft < 300 
                                                             ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse" 
                                                             : "bg-primary/10 border-primary/20 text-primary"
                                                     }`}>
                                                         <span className="text-xs">⏱</span>
                                                         <span>{formatTime(timeLeft)}</span>
                                                     </div>
                                                 )}
                                                <span
                                                    className={`badge badge-lg ${getDifficultyBadgeClass(
                                                        session?.difficulty
                                                    )}`}
                                                >
                                                    {session?.difficulty.slice(0, 1).toUpperCase() +
                                                        session?.difficulty.slice(1) || "Easy"}
                                                </span>
                                                {/* Host view: Code submission status indicator */}
                                                {isHost && session?.status === "active" && session?.finalCode && (
                                                    <span className="badge badge-success gap-1 text-xs text-white whitespace-nowrap">
                                                        ✓ Code Submitted
                                                    </span>
                                                )}

                                                {/* Candidate view: Resume Status / Upload Button */}
                                                {isParticipant && session?.status === "active" && (
                                                    session?.candidateResumeText ? (
                                                        <span className="badge badge-success gap-1 text-xs text-white whitespace-nowrap">
                                                            ✓ Resume Uploaded
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowResumeModal(true)}
                                                            className="btn btn-outline btn-primary btn-sm gap-2"
                                                        >
                                                            Upload Resume
                                                        </button>
                                                    )
                                                )}

                                                {/* Candidate view: Submit Solution button */}
                                                {isParticipant && session?.status === "active" && (
                                                    <button
                                                        onClick={() => {
                                                            if (submitCodeMutation.isPending) return;
                                                            const code = compilerMode === "problem" ? problemCode : playgroundCode;
                                                            submitCodeMutation.mutate({
                                                                id,
                                                                code,
                                                                language: selectedLanguage,
                                                            });
                                                        }}
                                                        disabled={submitCodeMutation.isPending}
                                                        className="btn btn-success text-white btn-sm gap-2"
                                                    >
                                                        {submitCodeMutation.isPending ? (
                                                            <Loader2Icon className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <ShieldCheckIcon className="w-4 h-4" />
                                                        )}
                                                        Submit Solution
                                                    </button>
                                                )}

                                                {/* Host view: Change/Add Question button */}
                                                {isHost && session?.status === "active" && (
                                                    <button
                                                        onClick={() => {
                                                            setChangeQuestionConfig({
                                                                problem: session.problem || "",
                                                                customDescription: session.customDescription || "",
                                                                difficulty: session.difficulty || "medium",
                                                                problemType: session.customDescription ? "custom" : "preset",
                                                            });
                                                            setShowChangeQuestionModal(true);
                                                        }}
                                                        className="btn btn-outline btn-sm gap-2"
                                                    >
                                                        <PlusIcon className="w-4 h-4" />
                                                        Add/Change Question
                                                    </button>
                                                )}

                                                {/* Host view: End Session button */}
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

                                                {/* Host view: Resubmit & Review button (active or completed) */}
                                                {isHost && (
                                                    <button
                                                        onClick={() => {
                                                            if (submitCodeMutation.isPending) return;
                                                            const code = compilerMode === "problem" ? problemCode : playgroundCode;
                                                            submitCodeMutation.mutate(
                                                                { id, code, language: selectedLanguage },
                                                                {
                                                                    onSuccess: () => {
                                                                        if (session?.status === "completed") {
                                                                            navigate(`/review/${id}`);
                                                                        } else {
                                                                            toast.success("Review triggered! You can view it in the AI Review tab.");
                                                                        }
                                                                    }
                                                                }
                                                            );
                                                        }}
                                                        disabled={submitCodeMutation.isPending}
                                                        className="btn btn-primary btn-sm gap-2"
                                                    >
                                                        {submitCodeMutation.isPending ? (
                                                            <Loader2Icon className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <ShieldCheckIcon className="w-4 h-4" />
                                                        )}
                                                        {session?.status === "active" ? "Evaluate Candidate Code" : "Resubmit & Review"}
                                                    </button>
                                                )}

                                                {session?.status === "completed" && (
                                                    <span className="badge badge-ghost badge-sm">Session Completed</span>
                                                )}
                                            </div>
                                        </div>
                                        {isHost && (
                                            <div className="flex border-b border-base-300 bg-base-100 px-6 gap-6 shadow-sm">
                                                <button 
                                                    onClick={() => setActiveLeftTab("question")}
                                                    className={`py-3 text-sm font-bold border-b-2 transition-all ${
                                                        activeLeftTab === "question" 
                                                            ? "border-primary text-primary" 
                                                            : "border-transparent text-base-content/60 hover:text-base-content"
                                                    }`}
                                                >
                                                    Question Description
                                                </button>
                                                <button 
                                                    onClick={() => setActiveLeftTab("review")}
                                                    className={`py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                                                        activeLeftTab === "review" 
                                                            ? "border-primary text-primary" 
                                                            : "border-transparent text-base-content/60 hover:text-base-content"
                                                    }`}
                                                >
                                                    AI Code Review
                                                    {review?.status === "pending" && (
                                                        <span className="loading loading-spinner loading-xs text-primary" />
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        <div className="p-6 space-y-6">
                                            {(!isHost || activeLeftTab === "question") ? (
                                                <>
                                                    {/* Custom Question Description or Predefined Problem Description */}
                                                    {session?.customDescription ? (
                                                        <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                                                            <h2 className="text-xl font-bold mb-4 text-base-content">Description</h2>
                                                            <div className="space-y-3 text-base leading-relaxed whitespace-pre-wrap text-base-content/90">
                                                                {session.customDescription}
                                                            </div>
                                                        </div>
                                                    ) : problemData?.description ? (
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
                                                    ) : null}

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
                                                </>
                                            ) : (
                                                /* AI REVIEW PANEL (Host Only) */
                                                <div className="space-y-5">
                                                    {!session?.finalCode ? (
                                                        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                                                            <ShieldAlertIcon className="w-12 h-12 text-base-content/30 mb-3 animate-pulse" />
                                                            <h3 className="font-bold text-lg">No Submission Yet</h3>
                                                            <p className="text-xs text-base-content/50 max-w-sm mt-1">
                                                                Review triggers when the candidate submits their code, or when you click "Evaluate Candidate Code" above.
                                                            </p>
                                                        </div>
                                                    ) : (reviewLoading || !review || review.status === "pending") ? (
                                                        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px] gap-3">
                                                            <span className="loading loading-spinner loading-lg text-primary" />
                                                            <h3 className="font-bold text-lg">Generating AI Review...</h3>
                                                            <p className="text-xs text-base-content/50">Calling Grok to evaluate correctness, quality, and complexity...</p>
                                                        </div>
                                                    ) : review.status === "failed" ? (
                                                        <div className="alert alert-error">
                                                            <AlertTriangleIcon className="w-5 h-5" />
                                                            <span>Review generation failed. Please evaluate the code manually.</span>
                                                        </div>
                                                    ) : (
                                                        /* REVIEW CONTENTS READY */
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between bg-base-100 p-4 rounded-xl border border-base-300 shadow-sm">
                                                                <div>
                                                                    <h3 className="font-bold text-lg">Grok Review Score</h3>
                                                                    <p className="text-xs text-base-content/50">Overall candidate code quality</p>
                                                                </div>
                                                                <div className={`badge badge-lg py-4 px-4 font-bold text-lg ${
                                                                    review.score >= 8 ? "badge-success text-white" :
                                                                    review.score >= 6 ? "badge-warning text-white" : "badge-error text-white"
                                                                }`}>
                                                                    {review.score}/10
                                                                </div>
                                                            </div>

                                                            {/* Complexity indicators */}
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="bg-base-100 border border-base-300 p-3 rounded-xl">
                                                                    <p className="text-[10px] text-base-content/50 uppercase tracking-wider font-bold">Time Complexity</p>
                                                                    <p className="font-mono text-sm font-bold mt-1 text-primary">{review.timeComplexity}</p>
                                                                </div>
                                                                <div className="bg-base-100 border border-base-300 p-3 rounded-xl">
                                                                    <p className="text-[10px] text-base-content/50 uppercase tracking-wider font-bold">Space Complexity</p>
                                                                    <p className="font-mono text-sm font-bold mt-1 text-secondary">{review.spaceComplexity}</p>
                                                                </div>
                                                            </div>

                                                             {/* Submitted Candidate Code display with Copy Code button */}
                                                             {session?.finalCode && (
                                                                 <div className="bg-base-100 border border-base-300 p-4 rounded-xl space-y-2">
                                                                     <div className="flex items-center justify-between">
                                                                         <p className="text-xs font-bold text-base-content/60">Submitted Candidate Code</p>
                                                                         <button 
                                                                             onClick={handleCopyCode}
                                                                             className="btn btn-xs btn-outline btn-primary gap-1"
                                                                         >
                                                                             <CopyIcon className="w-3 h-3" />
                                                                             Copy Code
                                                                         </button>
                                                                     </div>
                                                                     <pre className="bg-base-200 p-3 rounded-lg font-mono text-xs overflow-x-auto max-h-40 whitespace-pre scrollbar-thin scrollbar-thumb-base-content/10">
                                                                         {session.finalCode}
                                                                     </pre>
                                                                 </div>
                                                             )}

                                                            {/* Correctness */}
                                                            <div className="bg-base-100 border border-base-300 p-4 rounded-xl">
                                                                <p className="text-xs font-bold text-base-content/60 mb-1">Correctness</p>
                                                                <p className="text-sm text-base-content/85">{review.correctness}</p>
                                                            </div>

                                                            {/* Code Quality */}
                                                            <div className="bg-base-100 border border-base-300 p-4 rounded-xl">
                                                                <p className="text-xs font-bold text-base-content/60 mb-1">Code Quality</p>
                                                                <p className="text-sm text-base-content/85">{review.codeQuality}</p>
                                                            </div>

                                                            {/* Suggestions */}
                                                            <div className="bg-warning/10 border border-warning/20 p-4 rounded-xl">
                                                                <p className="text-xs font-bold text-warning-content/80 mb-1">Key Suggestion</p>
                                                                <p className="text-sm text-base-content/85">{review.suggestion}</p>
                                                            </div>

                                                            {/* Feedback */}
                                                            <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
                                                                <p className="text-xs font-bold text-primary-content/80 mb-1">Overall Feedback</p>
                                                                <p className="text-sm leading-relaxed text-base-content/85">{review.overallFeedback}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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

                    {/* RIGHT PANEL - VIDEO CALLS OR AI CONDUCTOR CHAT */}
                    <Panel defaultSize={50} minSize={30}>
                        <div className="h-full bg-base-200 flex flex-col overflow-hidden">
                            {session?.type === "ai" ? (
                                /* AI Mode: 100% height Conductor Panel with Chat Input */
                                <div className="flex-1 h-full flex flex-col overflow-hidden">
                                    <ConductorPanel
                                        sessionId={id}
                                        messages={conductorMessages}
                                        isLoading={conductorLoading || sendConductorMsgMutation.isPending}
                                        showInput={session?.status === "active"}
                                        onSendMessage={(message) => {
                                            const code = compilerMode === "problem" ? problemCode : playgroundCode;
                                            sendConductorMsgMutation.mutate({
                                                sessionId: id,
                                                message,
                                                code,
                                                language: selectedLanguage,
                                            });
                                        }}
                                    />
                                </div>
                            ) : (
                                /* Personal Mode: Video Call Only (No Conductor) */
                                <div className="flex-1 overflow-auto p-4">
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
                            )}
                        </div>

                    </Panel>
                </PanelGroup>
            </div>

            {/* --- AI MODE: MANDATORY RESUME UPLOAD OVERLAY --- */}
            {session?.type === "ai" && !session?.candidateResumeText && session?.status === "active" && isParticipant && (
                <div className="fixed inset-0 bg-base-300/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="card bg-base-100 max-w-xl w-full border border-base-300 shadow-2xl rounded-2xl">
                        <div className="card-body">
                            <h2 className="card-title text-2xl mb-1 text-primary">Resume Upload Required</h2>
                            <p className="text-sm text-base-content/75 mb-6">
                                To tailor your practice interview, the AI Conductor requires you to submit your resume first.
                            </p>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-base-content/60">Upload Resume (PDF or TXT)</label>
                                    <div className="flex items-center gap-3">
                                        <label className="btn btn-sm btn-outline btn-primary rounded-xl gap-2 cursor-pointer">
                                            {pdfLoading ? (
                                                <Loader2Icon className="size-4 animate-spin" />
                                            ) : (
                                                <UploadIcon className="size-4" />
                                            )}
                                            {pdfLoading ? "Parsing..." : "Upload PDF/TXT"}
                                            <input 
                                                type="file" 
                                                accept=".pdf,.txt" 
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;

                                                    // Read as Data URL (base64)
                                                    const urlReader = new FileReader();
                                                    urlReader.onload = (urlEvt) => {
                                                        setResumeFileUrl(urlEvt.target.result);
                                                    };
                                                    urlReader.readAsDataURL(file);

                                                    if (file.name.endsWith(".pdf")) {
                                                        setPdfLoading(true);
                                                        try {
                                                            const text = await extractTextFromPdf(file);
                                                            setResumeText(text);
                                                            setPdfFileName(file.name);
                                                        } catch {
                                                            setResumeText("");
                                                            setPdfFileName("");
                                                        } finally {
                                                            setPdfLoading(false);
                                                        }
                                                    } else {
                                                        const reader = new FileReader();
                                                        reader.onload = (evt) => {
                                                            setResumeText(evt.target.result);
                                                            setPdfFileName(file.name);
                                                        };
                                                        reader.readAsText(file);
                                                    }
                                                    e.target.value = "";
                                                }}
                                            />
                                        </label>
                                        {pdfFileName && (
                                            <span className="text-xs text-success font-medium truncate max-w-[200px]">
                                                ✓ {pdfFileName.toLowerCase().endsWith(".pdf") ? "PDF" : "TXT"}: {pdfFileName}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-base-content/60">Or Paste Resume Text Below</label>
                                    <textarea
                                        placeholder="Paste your skills, experience, and education..."
                                        className="textarea textarea-bordered w-full h-48 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        value={resumeText}
                                        onChange={(e) => setResumeText(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-base-content/60">AI Model Provider</label>
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-base-200/50 rounded-xl border border-base-300/30">
                                        <button
                                            type="button"
                                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                                                model === "gemini"
                                                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                                                    : "hover:bg-base-300/50 text-base-content/70"
                                            }`}
                                            onClick={() => setModel("gemini")}
                                        >
                                            <SparklesIcon className="size-4" />
                                            Gemini
                                        </button>
                                        <button
                                            type="button"
                                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                                                model === "grok"
                                                    ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md"
                                                    : "hover:bg-base-300/50 text-base-content/70"
                                            }`}
                                            onClick={() => setModel("grok")}
                                        >
                                            <SparklesIcon className="size-4" />
                                            Grok (Groq)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="card-actions justify-end mt-6">
                                <button
                                    onClick={() => {
                                    if (resumeText.trim()) {
                                        uploadResumeMutation.mutate({ 
                                            id, 
                                            resumeText, 
                                            resumeFileUrl, 
                                            resumeFileName: pdfFileName, 
                                            model 
                                        });
                                    }
                                    }}
                                    disabled={uploadResumeMutation.isPending || !resumeText.trim()}
                                    className="btn btn-primary text-white w-full gap-2"
                                >
                                    {uploadResumeMutation.isPending && <span className="loading loading-spinner loading-xs" />}
                                    Start AI Interview
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PERSONAL MODE: OPTIONAL RESUME UPLOAD MODAL --- */}
            {showResumeModal && (
                <div className="modal modal-open z-50">
                    <div className="modal-box bg-base-100 max-w-xl border border-base-300 shadow-2xl rounded-2xl">
                        <h3 className="font-bold text-xl text-primary mb-2">Upload Resume</h3>
                        <p className="text-sm text-base-content/75 mb-6">
                            Upload or paste your resume. The AI will summarize it for your interviewer.
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-base-content/60">Upload Resume (PDF or TXT)</label>
                                <div className="flex items-center gap-3">
                                    <label className="btn btn-sm btn-outline btn-primary rounded-xl gap-2 cursor-pointer">
                                        {pdfLoading ? (
                                            <Loader2Icon className="size-4 animate-spin" />
                                        ) : (
                                            <UploadIcon className="size-4" />
                                        )}
                                        {pdfLoading ? "Parsing..." : "Upload PDF/TXT"}
                                        <input 
                                            type="file" 
                                            accept=".pdf,.txt" 
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;

                                                // Read as Data URL (base64)
                                                const urlReader = new FileReader();
                                                urlReader.onload = (urlEvt) => {
                                                    setResumeFileUrl(urlEvt.target.result);
                                                };
                                                urlReader.readAsDataURL(file);

                                                if (file.name.endsWith(".pdf")) {
                                                    setPdfLoading(true);
                                                    try {
                                                        const text = await extractTextFromPdf(file);
                                                        setResumeText(text);
                                                        setPdfFileName(file.name);
                                                    } catch {
                                                        setResumeText("");
                                                        setPdfFileName("");
                                                    } finally {
                                                        setPdfLoading(false);
                                                    }
                                                } else {
                                                    const reader = new FileReader();
                                                    reader.onload = (evt) => {
                                                        setResumeText(evt.target.result);
                                                        setPdfFileName(file.name);
                                                    };
                                                    reader.readAsText(file);
                                                }
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>
                                    {pdfFileName && (
                                        <span className="text-xs text-success font-medium truncate max-w-[200px]">
                                            ✓ {pdfFileName.toLowerCase().endsWith(".pdf") ? "PDF" : "TXT"}: {pdfFileName}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-base-content/60">Or Paste Resume Text Below</label>
                                <textarea
                                    placeholder="Paste your skills, experience, and education..."
                                    className="textarea textarea-bordered w-full h-48 text-sm focus:outline-none"
                                    value={resumeText}
                                    onChange={(e) => setResumeText(e.target.value)}
                                />
                            </div>

                        </div>
 
                        <div className="modal-action mt-6">
                            <button className="btn btn-ghost" onClick={() => setShowResumeModal(false)}>Cancel</button>
                            <button
                                onClick={() => {
                                    if (resumeText.trim()) {
                                        uploadResumeMutation.mutate(
                                            { 
                                                id, 
                                                resumeText, 
                                                resumeFileUrl, 
                                                resumeFileName: pdfFileName, 
                                                model: undefined 
                                            },
                                            { onSuccess: () => setShowResumeModal(false) }
                                        );
                                    }
                                }}
                                disabled={uploadResumeMutation.isPending || !resumeText.trim()}
                                className="btn btn-primary text-white gap-2"
                            >
                                {uploadResumeMutation.isPending && <span className="loading loading-spinner loading-xs" />}
                                Submit Resume
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setShowResumeModal(false)}></div>
                </div>
            )}
            {/* --- HOST: CHANGE/ADD QUESTION MODAL --- */}
            {showChangeQuestionModal && (
                <div className="modal modal-open z-50">
                    <div className="modal-box bg-base-100 max-w-xl border border-base-300 shadow-2xl rounded-2xl">
                        <h3 className="font-bold text-xl text-primary mb-2">Change/Add Interview Question</h3>
                        <p className="text-sm text-base-content/75 mb-6">
                            Update the live question. The candidate's editor workspace and code will reset for the new question.
                        </p>

                        <div className="space-y-4">
                            {/* Question type toggle */}
                            <div className="flex gap-4 mb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="modalProblemType"
                                        className="radio radio-primary radio-sm"
                                        checked={changeQuestionConfig.problemType === "preset"}
                                        onChange={() => setChangeQuestionConfig({
                                            ...changeQuestionConfig,
                                            problemType: "preset",
                                            problem: "",
                                            customDescription: ""
                                        })}
                                    />
                                    <span className="text-xs font-semibold">Predefined Problem</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="modalProblemType"
                                        className="radio radio-primary radio-sm"
                                        checked={changeQuestionConfig.problemType === "custom"}
                                        onChange={() => setChangeQuestionConfig({
                                            ...changeQuestionConfig,
                                            problemType: "custom",
                                            problem: "",
                                            customDescription: ""
                                        })}
                                    />
                                    <span className="text-xs font-semibold">Custom Question</span>
                                </label>
                            </div>

                            {/* Preset Problem Selection */}
                            {changeQuestionConfig.problemType === "preset" ? (
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-base-content/60">Select Predefined Problem</label>
                                    <select
                                        className="select select-bordered select-sm w-full"
                                        value={changeQuestionConfig.problem}
                                        onChange={(e) => {
                                            const preset = Object.values(PROBLEMS).find(p => p.title === e.target.value);
                                            setChangeQuestionConfig({
                                                ...changeQuestionConfig,
                                                problem: e.target.value,
                                                difficulty: preset?.difficulty || "medium",
                                            });
                                        }}
                                    >
                                        <option value="" disabled>Choose a problem...</option>
                                        {Object.values(PROBLEMS).map((p) => (
                                            <option key={p.id} value={p.title}>{p.title} ({p.difficulty})</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                /* Custom Question Fields */
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-base-content/60">Custom Question Title</label>
                                        <input
                                            type="text"
                                            className="input input-bordered input-sm w-full"
                                            placeholder="e.g. Reverse a String"
                                            value={changeQuestionConfig.problem}
                                            onChange={(e) => setChangeQuestionConfig({ ...changeQuestionConfig, problem: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-base-content/60">Question Description & Instructions</label>
                                        <textarea
                                            className="textarea textarea-bordered w-full h-24 text-sm"
                                            placeholder="Type constraints and instruction text here..."
                                            value={changeQuestionConfig.customDescription}
                                            onChange={(e) => setChangeQuestionConfig({ ...changeQuestionConfig, customDescription: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Difficulty select */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-base-content/60">Difficulty Level</label>
                                <select
                                    className="select select-bordered select-sm w-full"
                                    value={changeQuestionConfig.difficulty}
                                    onChange={(e) => setChangeQuestionConfig({ ...changeQuestionConfig, difficulty: e.target.value })}
                                >
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                        </div>

                        <div className="modal-action mt-6">
                            <button className="btn btn-ghost" onClick={() => setShowChangeQuestionModal(false)}>Cancel</button>
                            <button
                                onClick={() => {
                                    if (changeQuestionConfig.problem.trim()) {
                                        changeQuestionMutation.mutate(
                                            {
                                                id,
                                                problem: changeQuestionConfig.problem,
                                                customDescription: changeQuestionConfig.customDescription,
                                                difficulty: changeQuestionConfig.difficulty,
                                            },
                                            { onSuccess: () => setShowChangeQuestionModal(false) }
                                        );
                                    }
                                }}
                                disabled={changeQuestionMutation.isPending || !changeQuestionConfig.problem.trim()}
                                className="btn btn-primary text-white gap-2"
                            >
                                {changeQuestionMutation.isPending && <span className="loading loading-spinner loading-xs" />}
                                Update Question
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setShowChangeQuestionModal(false)}></div>
                </div>
            )}

            {/* --- HOST: VIEW RAW RESUME MODAL --- */}
            {showRawResumeModal && (
                <div className="modal modal-open z-50">
                    <div className="modal-box bg-base-100 max-w-3xl border border-base-300 shadow-2xl rounded-2xl">
                        <h3 className="font-bold text-xl text-primary mb-2">Candidate Resume Details</h3>
                        <p className="text-xs text-base-content/50 mb-6">
                            Showing the candidate's original uploaded resume and its AI summary.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <span className="text-xs text-base-content/60 uppercase tracking-wider font-bold block mb-2">
                                    Original Resume Document {session?.candidateResumeFileName ? `(${session.candidateResumeFileName})` : ""}
                                </span>
                                {session?.candidateResumeFileUrl && (session.candidateResumeFileUrl.startsWith("data:application/pdf") || session.candidateResumeFileName?.toLowerCase().endsWith(".pdf")) ? (
                                    <div className="w-full rounded-xl overflow-hidden border border-base-300 bg-base-200">
                                        <object
                                            data={session.candidateResumeFileUrl}
                                            type="application/pdf"
                                            className="w-full h-[50vh]"
                                        >
                                            <iframe
                                                src={session.candidateResumeFileUrl}
                                                className="w-full h-[50vh] border-none"
                                                title="Candidate Resume PDF"
                                            />
                                        </object>
                                    </div>
                                ) : (
                                    <div className="bg-base-200 border border-base-300 rounded-xl p-5 max-h-[35vh] overflow-y-auto font-sans text-sm leading-relaxed whitespace-pre-wrap text-base-content/90">
                                        {session?.candidateResumeText || "No resume text found."}
                                    </div>
                                )}
                            </div>

                            {session?.resumeSummary && (
                                <div>
                                    <span className="text-xs text-base-content/60 uppercase tracking-wider font-bold block mb-1">
                                        AI Summary
                                    </span>
                                    <div className="bg-base-200 border border-primary/20 rounded-xl p-5 max-h-[25vh] overflow-y-auto font-sans text-sm leading-relaxed whitespace-pre-wrap text-base-content/90">
                                        {session.resumeSummary}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-action mt-6">
                            <button className="btn btn-primary text-white gap-2 px-6" onClick={() => setShowRawResumeModal(false)}>
                                Done Viewing
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setShowRawResumeModal(false)}></div>
                </div>
            )}
        </div>
    );
}

export default SessionPage;