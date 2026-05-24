import { Link } from "react-router";
import Navbar from "../components/Navbar";
import { PROBLEMS } from "../data/problems";
import { ChevronRightIcon, Code2Icon } from "lucide-react";
import { getDifficultyBadgeClass } from "../lib/utils";

function ProblemsPage() {
    const problems = Object.values(PROBLEMS);

    const easyProblemsCount = problems.filter((p) => p.difficulty === "Easy").length;
    const mediumProblemsCount = problems.filter((p) => p.difficulty === "Medium").length;
    const hardProblemsCount = problems.filter((p) => p.difficulty === "Hard").length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-base-100 via-base-200 to-base-300">
            <Navbar />

            <div className="max-w-6xl mx-auto px-4 py-12">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">
                        <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                            Practice Problems
                        </span>
                    </h1>
                    <p className="text-base-content/70">
                        Sharpen your coding skills with these curated problems
                    </p>
                </div>

                <div className="mb-10 card bg-base-100/80 backdrop-blur-sm border border-primary/10 shadow-lg">
                    <div className="card-body p-4">
                        <div className="stats stats-vertical lg:stats-horizontal bg-transparent">
                            <div className="stat place-items-center">
                                <div className="stat-title">Total Problems</div>
                                <div className="stat-value text-primary drop-shadow-[0_0_8px_rgba(79,70,229,0.4)]">
                                    {problems.length}
                                </div>
                            </div>

                            <div className="stat place-items-center">
                                <div className="stat-title">Easy</div>
                                <div className="stat-value text-success drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">
                                    {easyProblemsCount}
                                </div>
                            </div>

                            <div className="stat place-items-center">
                                <div className="stat-title">Medium</div>
                                <div className="stat-value text-warning drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">
                                    {mediumProblemsCount}
                                </div>
                            </div>

                            <div className="stat place-items-center">
                                <div className="stat-title">Hard</div>
                                <div className="stat-value text-error drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                                    {hardProblemsCount}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {problems.map((problem) => (
                        <Link
                            key={problem.id}
                            to={`/problem/${problem.id}`}
                            className="card bg-base-100/80 backdrop-blur-md border border-base-300 hover:border-primary/40 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 group"
                        >
                            <div className="card-body p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-2">
                                            <div className="size-12 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center border border-primary/20 group-hover:from-primary/20 group-hover:to-secondary/20 transition-colors">
                                                <Code2Icon className="size-6 text-primary group-hover:scale-110 transition-transform" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h2 className="text-xl font-bold group-hover:text-primary transition-colors">
                                                        {problem.title}
                                                    </h2>
                                                    <span className={`badge border-none ${getDifficultyBadgeClass(problem.difficulty)}`}>
                                                        {problem.difficulty}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-base-content/50">
                                                    {problem.category}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-base-content/70 mt-3 line-clamp-2">
                                            {problem.description.text}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 text-primary opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                                        <span className="font-semibold text-sm tracking-wide">Solve</span>
                                        <ChevronRightIcon className="size-5" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
export default ProblemsPage;