import { RouterProvider } from "react-router-dom";
import { router } from "./router.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import LoginPage from "../pages/LoginPage.jsx";

export default function App() {
    const { user, loading } = useAuth();
    if (loading) return null;
    return user ? <RouterProvider router={router} /> : <LoginPage />;
}
