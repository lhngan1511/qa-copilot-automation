import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout.jsx";
import DashboardPage from "../pages/DashboardPage.jsx";
import NewWorkflowPage from "../pages/NewWorkflowPage.jsx";
import WorkflowDetailPage from "../pages/WorkflowDetailPage.jsx";
import AutomationPage from "../pages/AutomationPage.jsx";
import AIAutomationPage from "../pages/AIAutomationPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <MainLayout />,
        children: [
            {
                index: true,
                element: <DashboardPage />
            },
            {
                path: "workflows/new",
                element: <NewWorkflowPage />
            },
            {
                path: "workflows/:workflowId",
                element: <WorkflowDetailPage />
            },
            {
                path: "automation",
                element: <AutomationPage />
            },
            {
                path: "automation/ai",
                element: <AIAutomationPage />
            },
            {
                path: "*",
                element: <NotFoundPage />
            }
        ]
    }
]);
