import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./app/App.jsx";
import { queryClient } from "./app/queryClient.js";
import "./styles/global.css";
import "./styles/automation.css";
import "./styles/automationV3.css";
import { ProjectProvider } from "./contexts/ProjectContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { RunnerProvider } from "./contexts/RunnerContext.jsx";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <AuthProvider><ProjectProvider><RunnerProvider><App /></RunnerProvider></ProjectProvider></AuthProvider>
        </QueryClientProvider>
    </StrictMode>
);
