import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./app/App.jsx";
import { queryClient } from "./app/queryClient.js";
import "./styles/global.css";
import "./styles/automation.css";
import "./styles/automationV3.css";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </StrictMode>
);
