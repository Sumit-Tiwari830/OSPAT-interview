# OSPAT Workspace Rules & Customizations

This file outlines the architecture, integrations, and coding standards for the OSPAT repository. Any AI assistant working on this project must follow these rules.

---

## 1. Code Execution (Compiler) Architecture
*   **Provider**: Code execution is powered by **OnlineCompiler.io**.
*   **Supported Compilers**:
    *   **Python**: `python-3.14`
    *   **JavaScript / TypeScript**: `typescript-deno`
    *   **Java**: `openjdk-25`
    *   **C++**: `g++-15`
*   **Security (No Direct Client Calls)**: 
    *   Never call the OnlineCompiler API directly from the frontend (browser). Direct calls will be blocked by **CORS** and expose the private `ONLINECOMPILER_KEY` in client bundles.
    *   Always route execution requests from [piston.js](file:///wsl.localhost/Ubuntu/home/kirantiwari/ospat-interview/frontend/src/lib/piston.js) to the authenticated backend proxy endpoint `POST /api/sessions/run-code`.

---

## 2. Database & Models
*   **User Schema**: The user profile image field is `profileImage` (defined in [User.js](file:///wsl.localhost/Ubuntu/home/kirantiwari/ospat-interview/backend/src/models/User.js)). Do not use `image` or other property names.

---

## 3. Background Jobs
*   **Auto-Expiration**: Active sessions are auto-expired after **24 hours**. This cleanup is handled by the Inngest cron job `autoExpireSessions` in [inngest.js](file:///wsl.localhost/Ubuntu/home/kirantiwari/ospat-interview/backend/src/lib/inngest.js) which runs every 30 minutes.

---

## 4. UI Layout Rules
*   **Playground Split View**: In Playground mode, the session editor bottom panel splits into **Custom Input (stdin)** on the left and **Output Panel** on the right. In Problem mode, the Output Panel remains full-width.
