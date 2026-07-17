// ─────────────────────────────────────────────────────────────────
// components/ConductorPanel.jsx
// Single Responsibility: ONLY renders the AI Conductor message feed
// and handles chat input for AI practice sessions.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useTranscribeAudio } from "../hooks/useSessions";
import { sessionApi } from "../api/sessions";
import { BotMessageSquareIcon, ClockIcon, SendIcon, UserIcon, Volume2Icon, VolumeXIcon, MicIcon, MicOffIcon } from "lucide-react";

const phaseLabel = {
    intro: "Introduction",
    coding: "Monitoring",
    wrapup: "Wrap Up",
    done: "Completed",
};

const phaseBadgeClass = {
    intro: "badge-primary",
    coding: "badge-success",
    wrapup: "badge-warning",
    done: "badge-neutral",
};

function ConductorMessage({ message }) {
    const isBot = message.sender !== "candidate";

    return (
        <div className={`flex gap-3 items-start animate-fade-in ${isBot ? "" : "flex-row-reverse"}`}>
            {/* Avatar */}
            {isBot ? (
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0 mt-0.5">
                    <BotMessageSquareIcon className="w-4 h-4 text-primary" />
                </div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-secondary/20 border border-secondary/40 flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4 text-secondary" />
                </div>
            )}

            {/* Bubble */}
            <div className={`flex-1 max-w-[80%] ${isBot ? "" : "text-right"}`}>
                <div className={`flex items-center gap-2 mb-1 ${isBot ? "" : "justify-end"}`}>
                    <span className={`text-xs font-bold ${isBot ? "text-primary" : "text-secondary"}`}>
                        {isBot ? "AI Conductor" : "You"}
                    </span>
                    {isBot && (
                        <span className={`badge badge-xs ${phaseBadgeClass[message.phase] || "badge-ghost"}`}>
                            {phaseLabel[message.phase] || message.phase}
                        </span>
                    )}
                    <span className="text-xs text-base-content/40 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
                <div className={`rounded-xl px-4 py-3 text-left ${
                    isBot 
                        ? "bg-primary/10 border border-primary/20 rounded-tl-none text-base-content" 
                        : "bg-secondary/15 border border-secondary/25 rounded-tr-none text-base-content"
                }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>
                </div>
            </div>
        </div>
    );
}

export default function ConductorPanel({ sessionId, messages = [], isLoading, showInput = false, onSendMessage }) {
    const bottomRef = useRef(null);
    const [inputValue, setInputValue] = useState("");
    const [isMuted, setIsMuted] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isHandsFree, setIsHandsFree] = useState(false);
    const [isTtsPlaying, setIsTtsPlaying] = useState(false);
    const [showTextInput, setShowTextInput] = useState(false);

    const transcribeMutation = useTranscribeAudio();
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioPlayerRef = useRef(new Audio());

    const isHandsFreeRef = useRef(isHandsFree);
    useEffect(() => {
        isHandsFreeRef.current = isHandsFree;
    }, [isHandsFree]);

    // Auto-scroll to latest message (with layout delay to prevent cutting short)
    useEffect(() => {
        const timer = setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return () => clearTimeout(timer);
    }, [messages]);

    // Audio capture STT (Speech-to-Text) using MediaRecorder API and Whisper
    const startRecording = async () => {
        try {
            audioPlayerRef.current.pause(); // Pause any AI speech playing
            setIsTtsPlaying(false);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
                setIsListening(false);

                // Stop the mic hardware track stream
                stream.getTracks().forEach((track) => track.stop());

                // Call the backend Whisper transcribe route
                transcribeMutation.mutate(
                    { id: sessionId, audioBlob },
                    {
                        onSuccess: (data) => {
                            if (data.text && data.text.trim()) {
                                if (isHandsFreeRef.current) {
                                    onSendMessage?.(data.text.trim());
                                } else {
                                    setInputValue((prev) => (prev ? prev + " " + data.text : data.text));
                                    setShowTextInput(true); // Automatically expand text box to review
                                }
                            }
                        },
                    }
                );
            };

            recorder.start();
            setIsListening(true);

            // Auto-detect silence in Hands-Free mode to automatically submit
            if (isHandsFreeRef.current) {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioCtx.createMediaStreamSource(stream);
                const analyserNode = audioCtx.createAnalyser();
                analyserNode.fftSize = 512;
                source.connect(analyserNode);

                const bufferLength = analyserNode.fftSize;
                const dataArray = new Uint8Array(bufferLength);
                let silenceStart = null;

                const checkVolume = () => {
                    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
                        try { audioCtx.close(); } catch (e) {}
                        return;
                    }
                    analyserNode.getByteTimeDomainData(dataArray);

                    let sumSquares = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        const normalized = (dataArray[i] - 128) / 128;
                        sumSquares += normalized * normalized;
                    }
                    const rms = Math.sqrt(sumSquares / bufferLength);

                    // Threshold: if RMS volume is below 0.015, count as silence
                    if (rms < 0.015) {
                        if (!silenceStart) {
                            silenceStart = Date.now();
                        } else if (Date.now() - silenceStart > 1800) {
                            // 1.8 seconds of silence: auto-stop recording
                            stopRecording();
                            try { audioCtx.close(); } catch (e) {}
                            return;
                        }
                    } else {
                        silenceStart = null; // reset if they make noise
                    }

                    requestAnimationFrame(checkVolume);
                };

                requestAnimationFrame(checkVolume);
            }
        } catch (err) {
            console.error("Failed to start audio recording:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
    };

    // Text-to-Speech (TTS): play generated audio response from server
    const playVoiceResponse = async (text) => {
        try {
            audioPlayerRef.current.pause();
            setIsTtsPlaying(false);
            stopRecording();

            const audioBlob = await sessionApi.generateSpeech({ id: sessionId, text });
            const audioUrl = URL.createObjectURL(audioBlob);

            audioPlayerRef.current.src = audioUrl;
            audioPlayerRef.current.onplay = () => {
                audioPlayerRef.current.playbackRate = 1.16;
            };
            audioPlayerRef.current.onended = () => {
                setIsTtsPlaying(false);
                // Auto-start recording in hands-free mode when AI finishes speaking
                if (isHandsFreeRef.current) {
                    setTimeout(() => {
                        startRecording();
                    }, 400);
                }
            };
            setIsTtsPlaying(true);
            await audioPlayerRef.current.play();
        } catch (err) {
            setIsTtsPlaying(false);
            console.error("Failed to play TTS audio:", err.message);
        }
    };

    // Autoplay voice output for incoming AI Conductor messages
    useEffect(() => {
        if (messages.length === 0 || isMuted) return;
        const latestMessage = messages[messages.length - 1];
        const isBot = latestMessage.sender !== "candidate";

        if (isBot && latestMessage.message) {
            playVoiceResponse(latestMessage.message);
        }

        return () => {
            audioPlayerRef.current.pause();
            setIsTtsPlaying(false);
        };
    }, [messages.length, isMuted]);

    const toggleListening = (e) => {
        e.preventDefault();
        if (isListening) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        audioPlayerRef.current.pause();
        setIsTtsPlaying(false);
        onSendMessage?.(inputValue.trim());
        setInputValue("");
    };

    return (
        <div className="flex flex-col h-full bg-base-100 border-l border-base-300">
            {/* Header */}
            <div className="px-4 py-3 border-b border-base-300 bg-base-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BotMessageSquareIcon className="w-5 h-5 text-primary" />
                    <div>
                        <h3 className="text-sm font-bold text-base-content">AI Conductor</h3>
                        {isListening ? (
                            <p className="text-[10px] text-error font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
                                🎙️ LISTENING...
                            </p>
                        ) : isTtsPlaying ? (
                            <p className="text-[10px] text-primary font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                                🔊 AI SPEAKING...
                            </p>
                        ) : transcribeMutation.isPending ? (
                            <p className="text-[10px] text-warning font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-ping" />
                                ⏳ TRANSCRIBING...
                            </p>
                        ) : (
                            <p className="text-[10px] text-success font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                🟢 ACTIVE / STANDBY
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Hands-Free Voice Interview Toggle */}
                    <div className="flex items-center gap-1.5 bg-base-100 px-2 py-0.5 rounded-lg border border-base-300 no-print">
                        <span className="text-[10px] uppercase font-bold text-base-content/60">Hands-Free</span>
                        <input
                            type="checkbox"
                            className="toggle toggle-xs toggle-primary"
                            checked={isHandsFree}
                            onChange={(e) => {
                                const checked = e.target.checked;
                                setIsHandsFree(checked);
                                if (checked) {
                                    setIsMuted(false);
                                    // Trigger immediate voice kickoff if AI has already greeted
                                    if (messages.length > 0) {
                                        const latestMessage = messages[messages.length - 1];
                                        if (latestMessage.sender !== "candidate") {
                                            playVoiceResponse(latestMessage.message);
                                        }
                                    }
                                } else {
                                    audioPlayerRef.current.pause();
                                    setIsTtsPlaying(false);
                                    stopRecording();
                                }
                            }}
                        />
                    </div>

                    <button
                        onClick={() => {
                            setIsMuted((m) => {
                                const nextM = !m;
                                if (nextM) {
                                    audioPlayerRef.current.pause();
                                    setIsTtsPlaying(false);
                                    stopRecording();
                                }
                                return nextM;
                            });
                        }}
                        className={`btn btn-xs btn-circle ${isMuted ? 'btn-ghost text-base-content/40' : 'btn-primary text-white shadow-sm'}`}
                        title={isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
                    >
                        {isMuted ? <VolumeXIcon className="w-3.5 h-3.5" /> : <Volume2Icon className="w-3.5 h-3.5" />}
                    </button>
                    {(isLoading || transcribeMutation.isPending) && (
                        <span className="loading loading-dots loading-xs text-primary" />
                    )}
                </div>
            </div>

            {/* Soundwave Visualizer Bar */}
            <div className="px-4 py-2 bg-base-200/50 border-b border-base-300 flex items-center justify-between no-print">
                <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider">Audio Feed</span>
                <div className="flex items-end gap-1 h-4">
                    {(isListening || isTtsPlaying) ? (
                        <>
                            <span className="w-1 bg-primary rounded-full animate-pulse h-3" style={{ animationDelay: '0.1s' }} />
                            <span className="w-1 bg-secondary rounded-full animate-pulse h-2" style={{ animationDelay: '0.3s' }} />
                            <span className="w-1 bg-primary rounded-full animate-pulse h-4" style={{ animationDelay: '0.2s' }} />
                            <span className="w-1 bg-secondary rounded-full animate-pulse h-1.5" style={{ animationDelay: '0.4s' }} />
                            <span className="w-1 bg-primary rounded-full animate-pulse h-3" style={{ animationDelay: '0.5s' }} />
                        </>
                    ) : (
                        <div className="w-8 h-[2px] bg-base-content/20 rounded-full" />
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                        <BotMessageSquareIcon className="w-10 h-10 mb-2 text-base-content/30" />
                        <p className="text-xs text-base-content/50">
                            The AI Conductor will greet you once the session begins.
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <ConductorMessage key={msg._id} message={msg} />
                    ))
                )}
                <div ref={bottomRef} />
            </div>

            {/* Voice-First Chat Controls (AI Mode only) */}
            {showInput && (
                <div className="p-4 border-t border-base-300 bg-base-200 flex flex-col gap-3 items-center no-print">
                    
                    {/* Primary Option: Voice Button */}
                    <div className="flex flex-col items-center w-full gap-2">
                        <button
                            onClick={toggleListening}
                            disabled={isLoading || transcribeMutation.isPending}
                            className={`btn btn-lg btn-circle transition-all duration-300 shadow-lg ${
                                isListening
                                    ? "btn-error text-white scale-110 animate-pulse border-4 border-red-200"
                                    : "btn-primary text-white"
                            }`}
                            title={isListening ? "Click to finish speaking" : "Click to speak your answer"}
                        >
                            {isListening ? (
                                <MicIcon className="w-8 h-8" />
                            ) : (
                                <MicOffIcon className="w-8 h-8" />
                            )}
                        </button>
                        <span className="text-xs font-bold text-base-content/60 uppercase tracking-wide">
                            {isListening ? "Listening... Click to send" : "First Option: Speak your answer"}
                        </span>
                    </div>

                    {/* Secondary Option: Write Accordion Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowTextInput((s) => !s)}
                        className="text-xs font-bold text-primary hover:underline transition-all mt-1"
                    >
                        {showTextInput ? "⌨️ Hide typing option" : "⌨️ Or type your answer instead"}
                    </button>

                    {/* Collapsible Text Input form */}
                    {showTextInput && (
                        <form onSubmit={handleSubmit} className="w-full flex gap-2 items-center mt-1 animate-fade-in">
                            <input
                                type="text"
                                placeholder="Type your answer here..."
                                className="input input-sm input-bordered flex-1 focus:outline-none focus:ring-1 focus:ring-primary rounded-xl"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isLoading || transcribeMutation.isPending}
                            />
                            <button
                                type="submit"
                                className="btn btn-sm btn-primary btn-square rounded-xl"
                                disabled={!inputValue.trim() || isLoading || transcribeMutation.isPending}
                            >
                                <SendIcon className="w-4 h-4" />
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
