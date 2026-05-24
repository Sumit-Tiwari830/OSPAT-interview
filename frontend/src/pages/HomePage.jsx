import { SignedIn, SignedOut, SignInButton, SignOutButton, UserButton } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";


function HomePage() {
    //await axiosInstance.get("/session/123")
    return (
        <div>
            <button className="btn btn-secondary" onClick={() => toast.success("This is a success toast!")}>Click me</button>

            <SignedOut>
                <SignInButton mode="modal">
                    <button>Login</button>
                </SignInButton>
            </SignedOut>

            <SignedIn>
                <SignOutButton />
            </SignedIn>

            <UserButton />
        </div>
    );
}

export default HomePage;