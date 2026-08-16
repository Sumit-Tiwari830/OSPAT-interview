// ─────────────────────────────────────────────────────────────────
// components/CreateSessionModal.jsx
// Single Responsibility: UI modal for configuring and creating a new session.
// ─────────────────────────────────────────────────────────────────

import { Code2Icon, LoaderIcon, PlusIcon } from "lucide-react";
import { PROBLEMS } from "../data/problems";

function CreateSessionModal({
    isOpen,
    onClose,
    roomConfig,
    setRoomConfig,
    onCreateRoom,
    isCreating,
}) {
    const problems = Object.values(PROBLEMS);

    if (!isOpen) return null;

    const isAiMode = roomConfig.type === "ai";
    const isCustomMode = roomConfig.problemType === "custom";

    // Question title is mandatory
    const canCreate = !!roomConfig.problem;

    const handleTypeChange = (type) => {
        setRoomConfig({
            ...roomConfig,
            type,
            password: type === "ai" ? "ai-session" : roomConfig.password || "",
            fullscreenRequired: type === "ai" ? false : roomConfig.fullscreenRequired,
        });
    };

    const handleProblemTypeChange = (problemType) => {
        setRoomConfig({
            ...roomConfig,
            problemType,
            problem: "",
            customDescription: "",
            difficulty: "medium",
        });
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl bg-base-100 border border-base-300 shadow-xl rounded-2xl">
                <h3 className="font-bold text-2xl mb-6">Create New Session</h3>

                <div className="space-y-6">
                    {/* SESSION TYPE SELECTION */}
                    <div className="space-y-2">
                        <label className="label">
                            <span className="label-text font-semibold">Interview Type</span>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                className={`btn py-6 h-auto flex flex-col items-center gap-1 border-2 rounded-xl transition-all ${
                                    roomConfig.type !== "ai"
                                        ? "btn-primary border-primary text-white"
                                        : "btn-ghost border-base-300"
                                }`}
                                onClick={() => handleTypeChange("personal")}
                            >
                                <span className="font-bold text-sm">Personal Interview</span>
                                <span className="text-xs opacity-70 font-normal">Video call with human interviewer</span>
                            </button>
                            <button
                                type="button"
                                className={`btn py-6 h-auto flex flex-col items-center gap-1 border-2 rounded-xl transition-all ${
                                    roomConfig.type === "ai"
                                        ? "btn-primary border-primary text-white"
                                        : "btn-ghost border-base-300"
                                }`}
                                onClick={() => handleTypeChange("ai")}
                            >
                                <span className="font-bold text-sm">AI Practice Session</span>
                                <span className="text-xs opacity-70 font-normal">Solo session guided by AI Conductor</span>
                            </button>
                        </div>
                    </div>

                    {/* QUESTION TYPE SELECTION */}
                    <div className="space-y-2">
                        <label className="label">
                            <span className="label-text font-semibold">Question Type</span>
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="problemType"
                                    className="radio radio-primary"
                                    checked={!isCustomMode}
                                    onChange={() => handleProblemTypeChange("preset")}
                                />
                                <span className="text-sm font-medium">Choose Predefined Problem</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="problemType"
                                    className="radio radio-primary"
                                    checked={isCustomMode}
                                    onChange={() => handleProblemTypeChange("custom")}
                                />
                                <span className="text-sm font-medium">Create Custom Question</span>
                            </label>
                        </div>
                    </div>

                    {/* PRESET PROBLEM SELECTION */}
                    {!isCustomMode ? (
                        <div className="space-y-2">
                            <label className="label">
                                <span className="label-text font-semibold">Select Predefined Problem</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <select
                                className="select w-full"
                                value={roomConfig.problem}
                                onChange={(e) => {
                                    const selectedProblem = problems.find((p) => p.title === e.target.value);
                                    setRoomConfig({
                                        ...roomConfig,
                                        difficulty: selectedProblem.difficulty,
                                        problem: e.target.value,
                                    });
                                }}
                            >
                                <option value="" disabled>Choose a coding problem...</option>
                                {problems.map((problem) => (
                                    <option key={problem.id} value={problem.title}>
                                        {problem.title} ({problem.difficulty})
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        /* CUSTOM PROBLEM INPUTS */
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="label">
                                    <span className="label-text font-semibold">Custom Question Title</span>
                                    <span className="label-text-alt text-error">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Reverse a Doubly Linked List"
                                    className="input input-bordered w-full"
                                    value={roomConfig.problem || ""}
                                    onChange={(e) => setRoomConfig({ ...roomConfig, problem: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="label">
                                    <span className="label-text font-semibold">Question Description & Instructions</span>
                                    <span className="label-text-alt text-error">*</span>
                                </label>
                                <textarea
                                    placeholder="Type the coding question instructions, parameters, constraints, and examples here..."
                                    className="textarea textarea-bordered w-full h-32"
                                    value={roomConfig.customDescription || ""}
                                    onChange={(e) => setRoomConfig({ ...roomConfig, customDescription: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="label">
                                    <span className="label-text font-semibold">Difficulty Level</span>
                                </label>
                                <select
                                    className="select w-full select-bordered"
                                    value={roomConfig.difficulty || "medium"}
                                    onChange={(e) => setRoomConfig({ ...roomConfig, difficulty: e.target.value })}
                                >
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* PASSWORD INPUT (Personal Only) */}
                    {!isAiMode && (
                        <div className="space-y-2">
                            <label className="label">
                                <span className="label-text font-semibold">Interview Password</span>
                                <span className="label-text-alt text-base-content/40">(Optional — auto-generated if empty)</span>
                            </label>
                            <input 
                                type="text" 
                                placeholder="Auto-generated if left blank..." 
                                className="input input-bordered w-full"
                                value={roomConfig.password || ""}
                                onChange={(e) => setRoomConfig({ ...roomConfig, password: e.target.value })}
                            />
                        </div>
                    )}

                    {/* FULLSCREEN PROCTORING TOGGLE (Personal Only) */}
                    {!isAiMode && (
                        <div className="form-control">
                            <label className="label cursor-pointer justify-start gap-4">
                                <input
                                    type="checkbox"
                                    className="toggle toggle-primary"
                                    checked={roomConfig.fullscreenRequired || false}
                                    onChange={(e) =>
                                        setRoomConfig({ ...roomConfig, fullscreenRequired: e.target.checked })
                                    }
                                />
                                <div>
                                    <span className="label-text font-semibold">Require Fullscreen</span>
                                    <p className="text-xs text-base-content/60 mt-0.5">
                                        If enabled, candidate must stay fullscreen. Exiting triggers a flag on your side.
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* INTERVIEW DURATION (AI practice only) */}
                    {isAiMode && (
                        <div className="space-y-2">
                            <label className="label">
                                <span className="label-text font-semibold">Interview Duration Limit</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <select
                                className="select w-full select-bordered"
                                value={roomConfig.duration || 30}
                                onChange={(e) => setRoomConfig({ ...roomConfig, duration: parseInt(e.target.value) })}
                            >
                                <option value={10}>10 minutes</option>
                                <option value={15}>15 minutes</option>
                                <option value={20}>20 minutes</option>
                                <option value={25}>25 minutes</option>
                                <option value={30}>30 minutes</option>
                                <option value={35}>35 minutes</option>
                                <option value={40}>40 minutes</option>
                                <option value={45}>45 minutes</option>
                            </select>
                            <span className="text-xs text-base-content/50 block mt-1">
                                Maximum duration for the AI coding slot (not exceeding 45 minutes).
                            </span>
                        </div>
                    )}

                    {/* TARGET JOB DESCRIPTION (AI practice only) */}
                    {isAiMode && (
                        <div className="space-y-2">
                            <label className="label">
                                <span className="label-text font-semibold">Target Job Description (JD)</span>
                                <span className="label-text-alt text-base-content/40">(Optional)</span>
                            </label>
                            <textarea
                                placeholder="Paste job role details or target qualifications here to tailor the AI Conductor..."
                                className="textarea textarea-bordered w-full h-24"
                                value={roomConfig.jobDescription || ""}
                                onChange={(e) => setRoomConfig({ ...roomConfig, jobDescription: e.target.value })}
                            />
                        </div>
                    )}

                    {/* ROOM SUMMARY */}
                    {roomConfig.problem && (
                        <div className="alert alert-success">
                            <Code2Icon className="size-5" />
                            <div>
                                <p className="font-semibold">Room Summary:</p>
                                <p>Type: <span className="font-medium capitalize">{roomConfig.type || "Personal"}</span></p>
                                <p>Problem: <span className="font-medium">{roomConfig.problem}</span></p>
                                <p>Difficulty: <span className="font-medium capitalize">{roomConfig.difficulty || "medium"}</span></p>
                                {!isAiMode && (
                                    <p>Password: <span className="font-medium text-emerald-800">
                                        {roomConfig.password ? roomConfig.password : "Will be auto-generated"}
                                    </span></p>
                                )}
                                {!isAiMode && roomConfig.fullscreenRequired && (
                                    <p>Proctoring: <span className="font-medium text-emerald-800">Fullscreen enforced</span></p>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                <div className="modal-action flex justify-between items-center w-full">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <div className="flex gap-2">
                        <button
                            className="btn btn-outline gap-2"
                            onClick={() => onCreateRoom(false)}
                            disabled={isCreating || !canCreate}
                        >
                            Create Slot
                        </button>
                        <button
                            className="btn btn-primary gap-2 text-white"
                            onClick={() => onCreateRoom(true)}
                            disabled={isCreating || !canCreate}
                        >
                            {isCreating ? <LoaderIcon className="size-5 animate-spin" /> : <PlusIcon className="size-5" />}
                            Create & Join
                        </button>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}
export default CreateSessionModal;