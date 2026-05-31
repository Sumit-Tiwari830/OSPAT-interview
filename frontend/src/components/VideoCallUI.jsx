import {
    CallControls,
    CallingState,
    SpeakerLayout,
    useCallStateHooks,
    ParticipantView, // <-- Added this to render specific video tiles
} from "@stream-io/video-react-sdk";
import { Loader2Icon, MessageSquareIcon, UsersIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Channel, Chat, MessageInput, MessageList, Thread, Window } from "stream-chat-react";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

function VideoCallUI({ chatClient, channel }) {
    const navigate = useNavigate();
    
    // We pulled in useParticipants to see exactly who is in the room
    const { useCallCallingState, useParticipantCount, useParticipants } = useCallStateHooks();
    
    const callingState = useCallCallingState();
    const participantCount = useParticipantCount();
    const participants = useParticipants(); 
    
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Isolate the Mobile Proctor Feed from the human participants
    const proctorCamera = participants.find(p => p.userId === 'proctor_camera_01');
    
   // 2. Filter out the proctor to get ONLY the humans
    const humanParticipants = participants.filter(p => p.userId !== 'proctor_camera_01');

    // 3. THE FIX: Use a JavaScript 'Set' to count only UNIQUE human IDs.
    // Even if you have 3 "Ghost" connections from hot-reloading, it will only count you once!
    const humanCount = new Set(humanParticipants.map(p => p.userId)).size;
    if (callingState === CallingState.JOINING) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                    <p className="text-lg">Joining call...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex gap-3 relative str-video">
            <div className="flex-1 flex flex-col gap-3">
                {/* Participants count badge and Chat Toggle */}
                <div className="flex items-center justify-between gap-2 bg-base-100 p-3 rounded-lg shadow">
                    <div className="flex items-center gap-2">
                        <UsersIcon className="w-5 h-5 text-primary" />
                        <span className="font-semibold">
                            {humanCount} {humanCount === 1 ? "participant" : "participants"}
                        </span>
                    </div>
                    {chatClient && channel && (
                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className={`btn btn-sm gap-2 ${isChatOpen ? "btn-primary" : "btn-ghost"}`}
                            title={isChatOpen ? "Hide chat" : "Show chat"}
                        >
                            <MessageSquareIcon className="size-4" />
                            Chat
                        </button>
                    )}
                </div>

                {/* VIDEO LAYOUT AREA */}
                <div className="flex-1 bg-base-300 rounded-lg overflow-hidden relative">
                    {/* The main grid for the Host and Candidate */}
                    <SpeakerLayout />

                    {/* NEW: THE PROCTOR SECURITY CAMERA OVERLAY */}
                    {proctorCamera && (
                        <div className="absolute top-4 right-4 w-48 sm:w-64 aspect-video bg-black border-2 border-error/80 rounded-lg shadow-2xl overflow-hidden z-50 transition-all">
                            {/* The specific video feed from the Flutter app */}
                            <ParticipantView 
                                participant={proctorCamera} 
                                trackType="videoTrack" 
                            />
                            
                            {/* "REC" style CCTV Badge */}
                            <div className="absolute top-0 left-0 w-full bg-error/90 text-white text-[10px] sm:text-xs font-bold px-2 py-1 uppercase tracking-wider flex items-center gap-2 backdrop-blur-sm">
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                Proctor Feed
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-base-100 p-3 rounded-lg shadow flex justify-center">
                    <CallControls onLeave={() => navigate("/dashboard")} />
                </div>
            </div>

            {/* CHAT SECTION */}
            {chatClient && channel && (
                <div
                    className={`flex flex-col rounded-lg shadow overflow-hidden bg-[#272a30] transition-all duration-300 ease-in-out ${isChatOpen ? "w-80 opacity-100" : "w-0 opacity-0"
                        }`}
                >
                    {isChatOpen && (
                        <>
                            <div className="bg-[#1c1e22] p-3 border-b border-[#3a3d44] flex items-center justify-between">
                                <h3 className="font-semibold text-white">Session Chat</h3>
                                <button
                                    onClick={() => setIsChatOpen(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                    title="Close chat"
                                >
                                    <XIcon className="size-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden stream-chat-dark">
                                <Chat client={chatClient} theme="str-chat__theme-dark">
                                    <Channel channel={channel}>
                                        <Window>
                                            <MessageList />
                                            <MessageInput />
                                        </Window>
                                        <Thread />
                                     </Channel>
                                </Chat>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default VideoCallUI;