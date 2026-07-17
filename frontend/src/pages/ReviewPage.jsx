// ─────────────────────────────────────────────────────────────────
// pages/ReviewPage.jsx
// Single Responsibility: ONLY renders the post-session AI review
// report. Polls until review is ready, then shows scorecard.
// ─────────────────────────────────────────────────────────────────

import { useParams, Link } from "react-router";
import { useUser } from "@clerk/clerk-react";
import { useCodeReview } from "../hooks/useCodeReview";
import { useConductorScorecard } from "../hooks/useConductor";
import { useSessionById } from "../hooks/useSessions";
import { useUpdateSessionSettings } from "../hooks/useUpdateSession";
import Navbar from "../components/Navbar";
import {
    CodeIcon, ZapIcon, DatabaseIcon, CheckCircleIcon,
    AlertTriangleIcon, LightbulbIcon, StarIcon, ArrowLeftIcon,
    BotMessageSquareIcon, TrendingUpIcon
} from "lucide-react";

// ─── Score Ring ───────────────────────────────────────────────────
function ScoreRing({ score, label, max = 10 }) {
    const pct = (score / max) * 100;
    const color = score >= 8 ? "text-success" : score >= 6 ? "text-warning" : "text-error";
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={`radial-progress ${color} font-bold text-lg`}
                style={{ "--value": pct, "--size": "5rem", "--thickness": "6px" }}
                role="progressbar">
                {score}<span className="text-xs">/{max}</span>
            </div>
            <span className="text-xs text-base-content/60 text-center">{label}</span>
        </div>
    );
}

// ─── Hiring Badge ─────────────────────────────────────────────────
const hiringBadgeClass = {
    "strong yes": "badge-success",
    "yes": "badge-success",
    "maybe": "badge-warning",
    "no": "badge-error",
};

// ─── Loading State ────────────────────────────────────────────────
function ReviewLoading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-base-content/60 font-medium">Grok is analyzing the code...</p>
            <p className="text-xs text-base-content/40">This usually takes 10–30 seconds</p>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────
export default function ReviewPage() {
    const { sessionId } = useParams();
    const { user } = useUser();
    const { data: sessionData, isLoading: sessionLoading } = useSessionById(sessionId);
    const { data: review, isLoading: reviewLoading, error: reviewError } = useCodeReview(sessionId);
    const { data: scorecard } = useConductorScorecard(sessionId, !!review);
    const updateSettingsMutation = useUpdateSessionSettings();

    const session = sessionData?.session;
    const isHost = session?.host?.clerkId === user?.id;
    const isAllowed = isHost;

    const isPending = !review || review.status === "pending";
    const isFailed = review?.status === "failed";

    return (
        <div className="min-h-screen bg-base-100">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Navigation links */}
                <div className="flex gap-2 mb-6">
                    <Link to="/dashboard" className="btn btn-ghost btn-sm gap-2">
                        <ArrowLeftIcon className="w-4 h-4" /> Back to Dashboard
                    </Link>
                    {!sessionLoading && session && isHost && (
                        <Link to={`/session/${sessionId}`} className="btn btn-primary btn-sm gap-2 text-white">
                            <CodeIcon className="w-4 h-4" /> Edit & Resubmit Code
                        </Link>
                    )}
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">Session Review</h1>
                        <p className="text-base-content/50">AI-powered analysis of the candidate's solution</p>
                    </div>
                </div>

                {/* ── Loading Session Data ── */}
                {sessionLoading && (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                        <span className="loading loading-spinner loading-lg text-primary" />
                        <p className="text-base-content/60">Verifying session host credentials...</p>
                    </div>
                )}

                {/* ── Access Denied ── */}
                {!sessionLoading && session && !isAllowed && (
                    <div className="alert alert-error shadow-lg max-w-md mx-auto text-center flex flex-col gap-3 py-6 mt-8 rounded-2xl border border-error/20">
                        <AlertTriangleIcon className="w-12 h-12 text-error animate-pulse" />
                        <div>
                            <h3 className="font-bold text-lg">Access Denied</h3>
                            <p className="text-sm opacity-90 mt-1">
                                Only the interviewer is authorized to view this code review and scorecard.
                            </p>
                        </div>
                        <Link to="/dashboard" className="btn btn-sm btn-outline mt-2">
                            Return to Dashboard
                        </Link>
                    </div>
                )}

                {/* ── Normal Review Content (Host or Allowed Student) ── */}
                {!sessionLoading && session && isAllowed && (
                    <>
                        {/* ── Loading Review ── */}
                        {(reviewLoading || isPending) && !isFailed && <ReviewLoading />}

                        {/* ── Failed ── */}
                        {isFailed && (
                    <div className="alert alert-error">
                        <AlertTriangleIcon className="w-5 h-5" />
                        <span>Review generation failed. Please check the code manually.</span>
                    </div>
                )}

                {/* ── Review Ready ── */}
                {review?.status === "completed" && (
                    <div className="space-y-6">

                        {/* ── Score Overview Card ── */}
                        <div className="card bg-base-200 border border-base-300 shadow-sm">
                            <div className="card-body">
                                <div className="flex items-center gap-3 mb-6">
                                    <StarIcon className="w-6 h-6 text-warning" />
                                    <h2 className="card-title text-xl">Code Review — Powered by Grok</h2>
                                    <div className={`badge badge-lg font-bold ml-auto ${
                                        review.score >= 8 ? "badge-success" :
                                        review.score >= 6 ? "badge-warning" : "badge-error"
                                    }`}>
                                        {review.score}/10
                                    </div>
                                </div>

                                {/* Complexity Row */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-base-100 rounded-xl p-4 flex items-center gap-3">
                                        <ZapIcon className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="text-xs text-base-content/50 uppercase tracking-wide">Time Complexity</p>
                                            <p className="font-mono font-bold text-lg">{review.timeComplexity}</p>
                                        </div>
                                    </div>
                                    <div className="bg-base-100 rounded-xl p-4 flex items-center gap-3">
                                        <DatabaseIcon className="w-5 h-5 text-secondary" />
                                        <div>
                                            <p className="text-xs text-base-content/50 uppercase tracking-wide">Space Complexity</p>
                                            <p className="font-mono font-bold text-lg">{review.spaceComplexity}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Correctness */}
                                <div className="bg-base-100 rounded-xl p-4 flex items-start gap-3 mb-4">
                                    <CheckCircleIcon className="w-5 h-5 text-success mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs text-base-content/50 uppercase tracking-wide mb-1">Correctness</p>
                                        <p className="text-sm">{review.correctness}</p>
                                    </div>
                                </div>

                                {/* Code Quality */}
                                <div className="bg-base-100 rounded-xl p-4 flex items-start gap-3 mb-4">
                                    <CodeIcon className="w-5 h-5 text-info mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs text-base-content/50 uppercase tracking-wide mb-1">Code Quality</p>
                                        <p className="text-sm">{review.codeQuality}</p>
                                    </div>
                                </div>

                                {/* Edge Cases Missed */}
                                {review.edgeCasesMissed?.length > 0 && (
                                    <div className="bg-error/10 border border-error/20 rounded-xl p-4 mb-4">
                                        <p className="text-xs text-error/80 uppercase tracking-wide mb-2 font-semibold flex items-center gap-1">
                                            <AlertTriangleIcon className="w-3.5 h-3.5" /> Edge Cases Missed
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {review.edgeCasesMissed.map((ec, i) => (
                                                <span key={i} className="badge badge-error badge-sm">{ec}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Suggestion */}
                                <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-4">
                                    <p className="text-xs text-warning/80 uppercase tracking-wide mb-1 font-semibold flex items-center gap-1">
                                        <LightbulbIcon className="w-3.5 h-3.5" /> Key Suggestion
                                    </p>
                                    <p className="text-sm">{review.suggestion}</p>
                                </div>

                                {/* Overall Feedback */}
                                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                                    <p className="text-xs text-primary/80 uppercase tracking-wide mb-1 font-semibold">Overall Feedback</p>
                                    <p className="text-sm leading-relaxed">{review.overallFeedback}</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Conductor Scorecard (Host only) ── */}
                        {isHost && scorecard && (
                            <div className="card bg-base-200 border border-base-300 shadow-sm">
                                <div className="card-body">
                                    <div className="flex items-center gap-3 mb-6">
                                        <BotMessageSquareIcon className="w-6 h-6 text-primary" />
                                        <h2 className="card-title text-xl">Interview Scorecard — Powered by Gemini</h2>
                                        <span className={`badge badge-lg font-bold ml-auto ${hiringBadgeClass[scorecard.hiringSuggestion] || "badge-ghost"}`}>
                                            {scorecard.hiringSuggestion?.toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Score rings */}
                                    <div className="flex justify-around mb-6">
                                        <ScoreRing score={scorecard.technicalScore} label="Technical" />
                                        <ScoreRing score={scorecard.communicationScore} label="Communication" />
                                        <ScoreRing score={scorecard.problemSolvingScore} label="Problem Solving" />
                                        <ScoreRing score={scorecard.overallScore} label="Overall" />
                                    </div>

                                    {/* Strengths + Improvements */}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-success/10 border border-success/20 rounded-xl p-4">
                                            <p className="text-xs font-semibold text-success/80 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                <TrendingUpIcon className="w-3.5 h-3.5" /> Strengths
                                            </p>
                                            <ul className="space-y-1">
                                                {(scorecard.strengths || []).map((s, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-2">
                                                        <CheckCircleIcon className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                                                        {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                                            <p className="text-xs font-semibold text-warning/80 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                <LightbulbIcon className="w-3.5 h-3.5" /> Areas to Improve
                                            </p>
                                            <ul className="space-y-1">
                                                {(scorecard.improvements || []).map((im, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-2">
                                                        <AlertTriangleIcon className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                                                        {im}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Interviewer Note */}
                                    {scorecard.interviewerNote && (
                                        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
                                            <p className="text-xs text-base-content/50 uppercase tracking-wide mb-1 font-semibold">Private Note (Interviewer Only)</p>
                                            <p className="text-sm italic text-base-content/70">{scorecard.interviewerNote}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                    </>
                )}
            </div>
        </div>
    );
}
