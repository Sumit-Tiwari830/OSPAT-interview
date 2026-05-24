import { Link, useLocation } from "react-router";
import { BookOpenIcon, LayoutDashboardIcon, SparklesIcon } from "lucide-react";
import { UserButton } from "@clerk/clerk-react";

function Navbar() {
    const location = useLocation();
    console.log(location);
    const isActive = (path) => location.pathname === path;

    return (
        <nav className="bg-base-100/90 backdrop-blur-lg border-b border-white/5 sticky top-0 z-50 shadow-2xl">
            <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
                <Link
                    to="/"
                    className="group flex items-center gap-3 hover:scale-105 transition-transform duration-300"
                >
                    <div className="size-10 rounded-xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.3)] group-hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] transition-shadow">
                        <SparklesIcon className="size-6 text-white" />
                    </div>

                    <div className="flex flex-col">
                        <span className="font-black text-xl bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent font-mono tracking-wider">
                            OSPAT
                        </span>
                        <span className="text-xs text-base-content/60 font-medium -mt-1 tracking-wide">
                            Code Together
                        </span>
                    </div>
                </Link>

                <div className="flex items-center gap-2">
                    <Link
                        to={"/problems"}
                        className={`px-4 py-2.5 rounded-xl transition-all duration-300 border ${isActive("/problems")
                            ? "bg-primary/10 text-primary border-primary/20 shadow-[0_0_15px_rgba(79,70,229,0.15)]"
                            : "border-transparent hover:bg-base-200/60 text-base-content/60 hover:text-primary"
                            }`}
                    >
                        <div className="flex items-center gap-x-2.5">
                            <BookOpenIcon className={`size-4 ${isActive("/problems") ? "text-primary" : ""}`} />
                            <span className="font-medium hidden sm:inline tracking-wide">Problems</span>
                        </div>
                    </Link>

                    <Link
                        to={"/dashboard"}
                        className={`px-4 py-2.5 rounded-xl transition-all duration-300 border ${isActive("/dashboard")
                            ? "bg-primary/10 text-primary border-primary/20 shadow-[0_0_15px_rgba(79,70,229,0.15)]"
                            : "border-transparent hover:bg-base-200/60 text-base-content/60 hover:text-primary"
                            }`}
                    >
                        <div className="flex items-center gap-x-2.5">
                            <LayoutDashboardIcon className={`size-4 ${isActive("/dashboard") ? "text-primary" : ""}`} />
                            <span className="font-medium hidden sm:inline tracking-wide">Dashboard</span>
                        </div>
                    </Link>

                    <div className="ml-3 pl-4 border-l border-base-300 flex items-center justify-center h-8">
                        <div className="hover:scale-105 transition-transform duration-200 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] rounded-full">
                            <UserButton />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;