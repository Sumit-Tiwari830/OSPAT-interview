import { useNavigate } from "react-router";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { useActiveSessions, useCreateSession, useMyRecentSessions } from "../hooks/useSessions";
import axiosInstance from "../lib/axios";

import Navbar from "../components/Navbar";
import WelcomeSection from "../components/WelcomeSection";
import StatsCards from "../components/StatsCards";
import ActiveSessions from "../components/ActiveSessions";
import RecentSessions from "../components/RecentSessions";
import CreateSessionModal from "../components/CreateSessionModal";

function DashboardPage() {
    const navigate = useNavigate();
    const { user } = useUser();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [roomConfig, setRoomConfig] = useState({ problem: "", difficulty: "", password: "" });

    // Join Form State
    const [joinCode, setJoinCode] = useState("");
    const [joinPassword, setJoinPassword] = useState("");
    const [joinError, setJoinError] = useState("");
    const [isJoining, setIsJoining] = useState(false);

    const createSessionMutation = useCreateSession();
    const { data: activeSessionsData, isLoading: loadingActiveSessions } = useActiveSessions();
    const { data: recentSessionsData, isLoading: loadingRecentSessions } = useMyRecentSessions();

    const handleCreateRoom = () => {
        if (!roomConfig.problem || !roomConfig.difficulty || !roomConfig.password) return;

        createSessionMutation.mutate(
            {
                problem: roomConfig.problem,
                difficulty: roomConfig.difficulty.toLowerCase(),
                password: roomConfig.password,
            },
            {
                onSuccess: (data) => {
                    setShowCreateModal(false);
                    setRoomConfig({ problem: "", difficulty: "", password: "" }); // Reset
                    navigate(`/session/${data.session._id}`);
                },
            }
        );
    };

    const handleJoinSession = async (e) => {
        e.preventDefault();
        setJoinError("");
        setIsJoining(true);

        try {
            const response = await axiosInstance.post("/sessions/verify-join", {
                sessionId: joinCode,
                password: joinPassword
            });

            if (response.data.success) {
                // Navigate into the room using the Mongo _id returned by the server
                navigate(`/session/${response.data.roomObjectId}`);
            }
        } catch (error) {
            setJoinError(error.response?.data?.message || "Failed to join session.");
        } finally {
            setIsJoining(false);
        }
    };

    const activeSessions = activeSessionsData?.sessions || [];
    const recentSessions = recentSessionsData?.sessions || [];

    const isUserInSession = (session) => {
        if (!user?.id) return false;
        return session.host?.clerkId === user.id || session.participant?.clerkId === user.id;
    };

    return (
        <>
            <div className="min-h-screen bg-base-300">
                <Navbar />
                <WelcomeSection onCreateSession={() => setShowCreateModal(true)} />

                <div className="container mx-auto px-6 pb-16">
                    
                    {/* JOIN SESSION PANEL */}
                    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 mb-8 max-w-3xl mx-auto">
                        <h2 className="text-xl font-bold mb-4">Join an Interview</h2>
                        <form onSubmit={handleJoinSession} className="flex flex-col sm:flex-row gap-4 items-start">
                            <div className="flex-1 w-full">
                                <input 
                                    type="text" 
                                    placeholder="6-Digit Session ID (e.g. 482910)" 
                                    className="input input-bordered w-full"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex-1 w-full">
                                <input 
                                    id="join-password-input"
                                    type="password" 
                                    placeholder="Interview Password" 
                                    className="input input-bordered w-full"
                                    value={joinPassword}
                                    onChange={(e) => setJoinPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={isJoining}>
                                {isJoining ? "Verifying..." : "Join"}
                            </button>
                        </form>
                        {joinError && <p className="text-error text-sm mt-2">{joinError}</p>}
                    </div>

                    {/* Grid layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <StatsCards
                            activeSessionsCount={activeSessions.length}
                            recentSessionsCount={recentSessions.length}
                        />
                        
                        {/* --- THIS IS THE FIX --- */}
                        {/* We are passing the onRowClick function down to the ActiveSessions component! */}
                        <ActiveSessions
                            sessions={activeSessions}
                            isLoading={loadingActiveSessions}
                            isUserInSession={isUserInSession}
                            onRowClick={(clickedSession) => {
                                if (isUserInSession(clickedSession)) {
                                    // Let the host or pre-authorized participant straight in
                                    navigate(`/session/${clickedSession._id}`);
                                } else {
                                    // New student: Autofill ID, scroll up, and focus the password box
                                    setJoinCode(clickedSession.sessionId);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                    setTimeout(() => {
                                        document.getElementById('join-password-input')?.focus();
                                    }, 300);
                                }
                            }}
                        />
                        {/* ------------------------- */}
                    </div>

                    <RecentSessions sessions={recentSessions} isLoading={loadingRecentSessions} />
                </div>
            </div>

            <CreateSessionModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                roomConfig={roomConfig}
                setRoomConfig={setRoomConfig}
                onCreateRoom={handleCreateRoom}
                isCreating={createSessionMutation.isPending}
            />
        </>
    );
}

export default DashboardPage;