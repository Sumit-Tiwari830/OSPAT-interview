export const getDifficultyBadgeClass = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
        case "easy":
            return "bg-success/10 text-success border border-success/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]";
        case "medium":
            return "bg-warning/10 text-warning border border-warning/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]";
        case "hard":
            return "bg-error/10 text-error border border-error/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]";
        default:
            return "bg-base-200 text-base-content/60 border border-base-300";
    }
};