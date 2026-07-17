import { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import axiosInstance from "../lib/axios";
import { extractTextFromPdf } from "../lib/pdfParser";
import {
  FileSearchIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  SendIcon,
  Loader2Icon,
  TrashIcon,
  MessageSquareIcon,
  TargetIcon,
  AlertTriangleIcon,
  LightbulbIcon,
  UploadIcon,
} from "lucide-react";

/* ──────────────────────── Score Gauge ──────────────────────── */
function ScoreGauge({ score }) {
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score <= 40
      ? "#ef4444"
      : score <= 70
      ? "#f59e0b"
      : "#22c55e";

  const label =
    score <= 40 ? "Needs Work" : score <= 70 ? "Good" : "Excellent";

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={radius * 2} height={radius * 2} className="drop-shadow-lg">
        {/* background track */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-base-300/40"
        />
        {/* score arc */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)",
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
          }}
        />
        {/* score text */}
        <text
          x="50%"
          y="46%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-base-content font-black"
          style={{ fontSize: "2.4rem" }}
        >
          {score}
        </text>
        <text
          x="50%"
          y="64%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-base-content/50 font-medium"
          style={{ fontSize: ".85rem" }}
        >
          / 100
        </text>
      </svg>
      <span
        className="badge badge-lg font-bold tracking-wide"
        style={{ backgroundColor: color + "22", color, borderColor: color }}
      >
        {label}
      </span>
    </div>
  );
}

/* ──────────────────────── Main Page ──────────────────────── */
function AtsPage() {
  /* ── form state ── */
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [model, setModel] = useState("gemini");

  /* ── analysis state ── */
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  /* ── chat state ── */
  const [chatHistory, setChatHistory] = useState([]);
  const [userMessage, setUserMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfFileName, setPdfFileName] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  /* ── handlers ── */
  const handleAnalyze = async () => {
    if (!resumeText.trim() || !jobDescription.trim()) {
      setAnalyzeError("Please provide both a resume and a job description.");
      return;
    }
    setAnalyzeError("");
    setAnalyzing(true);
    setAnalysisResult(null);
    setChatHistory([]);
    try {
      const { data } = await axiosInstance.post("/ai/ats/analyze", {
        resumeText,
        jobDescription,
        companyName,
        model,
      });
      setAnalysisResult(data);
    } catch (err) {
      setAnalyzeError(
        err?.response?.data?.message || "Analysis failed. Please try again."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    setResumeText("");
    setJobDescription("");
    setCompanyName("");
    setAnalysisResult(null);
    setChatHistory([]);
    setAnalyzeError("");
    setPdfFileName("");
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!userMessage.trim()) return;
    const msg = userMessage.trim();
    setUserMessage("");
    setChatHistory((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    try {
      const { data } = await axiosInstance.post("/ai/ats/chat", {
        resumeText,
        jobDescription,
        userMessage: msg,
        chatHistory,
        model,
      });
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || data.message },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />

      {/* ── Decorative blobs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-40 w-[30rem] h-[30rem] rounded-full bg-secondary/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 rounded-full bg-accent/10 blur-3xl animate-pulse" />
      </div>

      {/* ── Hero ── */}
      <section className="relative pt-12 pb-6 text-center px-4">
        <div className="max-w-3xl mx-auto bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl p-8 md:p-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-5 border border-primary/20">
            <TargetIcon className="size-4" />
            AI-Powered Analysis
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              ATS Resume Scanner
            </span>
          </h1>
          <p className="mt-3 text-base-content/60 max-w-xl mx-auto text-lg">
            Instantly compare your resume against any job description. Get a match score, find missing keywords, and receive actionable tips — powered by AI.
          </p>
        </div>
      </section>

      {/* ── Main Grid ── */}
      <main className="relative max-w-7xl mx-auto px-4 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: Input Panel ── */}
        <div className="bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl p-6 flex flex-col gap-5 h-fit">
          <div className="flex items-center gap-2 text-lg font-bold">
            <FileSearchIcon className="size-5 text-primary" />
            Input Details
          </div>

          {/* AI Model Provider */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-base-content/50 uppercase tracking-widest">AI Model Provider</span>
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

          {/* Resume */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-base-content/70 tracking-wide">Resume</span>
            {/* PDF / TXT Upload */}
            <div className="flex items-center gap-3">
              <label className="btn btn-sm btn-outline btn-primary rounded-xl gap-2 cursor-pointer flex-shrink-0">
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
                    if (file.name.endsWith(".pdf")) {
                      setPdfLoading(true);
                      try {
                        const text = await extractTextFromPdf(file);
                        setResumeText(text);
                        setPdfFileName(file.name);
                      } catch {
                        setAnalyzeError("Failed to parse PDF. Please try pasting the text instead.");
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
            <textarea
              className="textarea textarea-bordered bg-base-200/50 min-h-[180px] text-sm leading-relaxed focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
              placeholder="Or paste your resume text here..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
          </label>

          {/* Job Description */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-base-content/70 tracking-wide">Job Description</span>
            <textarea
              className="textarea textarea-bordered bg-base-200/50 min-h-[180px] text-sm leading-relaxed focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
              placeholder="Paste the target job description..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </label>

          {/* Company Name */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-base-content/70 tracking-wide">Company Name</span>
            <input
              type="text"
              className="input input-bordered bg-base-200/50 text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
              placeholder="Company name (optional)"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </label>

          {/* Error */}
          {analyzeError && (
            <div className="alert alert-error text-sm shadow-md rounded-xl">
              <AlertTriangleIcon className="size-4" />
              <span>{analyzeError}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              className="btn btn-primary flex-1 rounded-xl gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2Icon className="size-5 animate-spin" />
              ) : (
                <SparklesIcon className="size-5" />
              )}
              {analyzing ? "Analyzing..." : "Analyze Resume"}
            </button>
            <button
              className="btn btn-ghost rounded-xl gap-2 border border-base-300/50"
              onClick={handleClear}
            >
              <TrashIcon className="size-4" />
              Clear
            </button>
          </div>
        </div>

        {/* ── RIGHT: Results Panel ── */}
        <div className="flex flex-col gap-6">
          {!analysisResult && !analyzing && (
            <div className="bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl p-10 flex flex-col items-center justify-center text-center min-h-[400px] gap-4">
              <div className="size-20 rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
                <FileSearchIcon className="size-10 text-primary/50" />
              </div>
              <p className="text-base-content/40 text-lg font-medium max-w-xs">
                Paste your resume &amp; job description, then hit <span className="text-primary font-bold">Analyze</span> to see your results here.
              </p>
            </div>
          )}

          {analyzing && (
            <div className="bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl p-10 flex flex-col items-center justify-center min-h-[400px] gap-4">
              <Loader2Icon className="size-12 text-primary animate-spin" />
              <p className="text-base-content/60 font-medium text-lg">Analyzing your resume…</p>
              <div className="w-48 h-1.5 rounded-full bg-base-300/50 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary via-secondary to-accent rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {analysisResult && (
            <>
              {/* Score */}
              <div className="bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl p-6 flex flex-col items-center gap-2">
                <h3 className="text-sm font-bold tracking-widest uppercase text-base-content/50 mb-2">
                  ATS Match Score
                </h3>
                <ScoreGauge score={analysisResult.score ?? 0} />
              </div>

              {/* Matched Keywords */}
              {analysisResult.matchedKeywords?.length > 0 && (
                <div className="bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircleIcon className="size-5 text-success" />
                    <h3 className="font-bold">Matched Keywords</h3>
                    <span className="badge badge-success badge-sm ml-auto font-semibold">
                      {analysisResult.matchedKeywords.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.matchedKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="badge badge-success badge-outline gap-1 font-medium py-3 px-3"
                      >
                        <CheckCircleIcon className="size-3" />
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Keywords */}
              {analysisResult.missingKeywords?.length > 0 && (
                <div className="bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircleIcon className="size-5 text-error" />
                    <h3 className="font-bold">Missing Keywords</h3>
                    <span className="badge badge-error badge-sm ml-auto font-semibold">
                      {analysisResult.missingKeywords.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.missingKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="badge badge-error badge-outline gap-1 font-medium py-3 px-3"
                      >
                        <XCircleIcon className="size-3" />
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysisResult.recommendations?.length > 0 && (
                <div className="bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <LightbulbIcon className="size-5 text-warning" />
                    <h3 className="font-bold">Recommendations</h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    {analysisResult.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 bg-base-200/50 rounded-xl p-4 border border-base-300/30 hover:border-primary/30 transition-colors"
                      >
                        <span className="flex-shrink-0 size-7 rounded-lg bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-sm font-bold shadow">
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-base-content/80">
                          {rec}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              {analysisResult.feedback && (
                <div className="alert bg-info/10 border border-info/20 shadow-lg rounded-2xl">
                  <MessageSquareIcon className="size-5 text-info" />
                  <p className="text-sm leading-relaxed">{analysisResult.feedback}</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── Follow-up Chat ── */}
      {analysisResult && (
        <section className="relative max-w-7xl mx-auto px-4 pb-16">
          <div className="bg-base-100/80 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-xl overflow-hidden">
            {/* header */}
            <div className="px-6 py-4 border-b border-base-300/40 flex items-center gap-2">
              <MessageSquareIcon className="size-5 text-secondary" />
              <h3 className="font-bold text-lg">Follow-up Chat</h3>
              <span className="text-xs text-base-content/40 ml-2">Ask anything about your resume analysis</span>
            </div>

            {/* messages */}
            <div className="p-6 max-h-96 overflow-y-auto flex flex-col gap-4 scroll-smooth">
              {chatHistory.length === 0 && (
                <p className="text-center text-base-content/30 text-sm py-8">
                  No messages yet — ask a question about your resume or the analysis results.
                </p>
              )}
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`chat ${msg.role === "user" ? "chat-end" : "chat-start"}`}
                >
                  <div className="chat-image avatar placeholder">
                    <div
                      className={`size-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-primary to-secondary"
                          : "bg-gradient-to-br from-accent to-secondary"
                      }`}
                    >
                      {msg.role === "user" ? "You" : "AI"}
                    </div>
                  </div>
                  <div
                    className={`chat-bubble text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "chat-bubble-primary"
                        : "bg-base-200 text-base-content"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="chat chat-start">
                  <div className="chat-image avatar placeholder">
                    <div className="size-9 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center text-white text-xs font-bold">
                      AI
                    </div>
                  </div>
                  <div className="chat-bubble bg-base-200 text-base-content">
                    <span className="loading loading-dots loading-sm" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* input */}
            <form
              onSubmit={handleChat}
              className="px-6 py-4 border-t border-base-300/40 flex gap-3"
            >
              <input
                type="text"
                className="input input-bordered flex-1 bg-base-200/50 rounded-xl text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Ask a follow-up question..."
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                disabled={chatLoading}
              />
              <button
                type="submit"
                className="btn btn-primary rounded-xl gap-2 shadow-lg shadow-primary/20"
                disabled={chatLoading || !userMessage.trim()}
              >
                {chatLoading ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SendIcon className="size-4" />
                )}
                Send
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

export default AtsPage;
