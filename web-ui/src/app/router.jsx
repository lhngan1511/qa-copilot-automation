import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout.jsx";
import DashboardPage from "../pages/DashboardPage.jsx";
import NewWorkflowPage from "../pages/NewWorkflowPage.jsx";
import WorkflowDetailPage from "../pages/WorkflowDetailPage.jsx";
import AutomationWorkspacePage from "../pages/AutomationWorkspacePage.jsx";
import CodeGenPage from "../pages/CodeGenPage.jsx";
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
                path: "automation/workspaces/new",
                element: <AutomationWorkspacePage />
            },
            {
                path: "codegen",
                element: <CodeGenPage />
            },
            {
                path: "*",
                element: <NotFoundPage />
            }
        ]
    }
]);
