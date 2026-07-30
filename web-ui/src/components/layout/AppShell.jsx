import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AppHeader from "../AppHeader.jsx";
import AppSidebar from "../AppSidebar.jsx";

const mobileSidebarQuery = "(max-width: 900px)";

export default function AppShell() {
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileSidebarQuery).matches);

    useEffect(() => {
        const media = window.matchMedia(mobileSidebarQuery);
        const handleChange = event => {
            setIsMobile(event.matches);
            if (!event.matches) setMobileSidebarOpen(false);
        };

        media.addEventListener("change", handleChange);
        return () => media.removeEventListener("change", handleChange);
    }, []);

    const toggleSidebar = () => {
        if (isMobile) {
            setMobileSidebarOpen(open => !open);
            return;
        }
        setDesktopSidebarCollapsed(collapsed => !collapsed);
    };

    const sidebarExpanded = isMobile ? mobileSidebarOpen : !desktopSidebarCollapsed;

    return (
        <div
            className={`app-shell ${
                desktopSidebarCollapsed ? "app-shell--sidebar-collapsed" : ""
            }`}
        >
            <AppHeader onToggleSidebar={toggleSidebar} sidebarExpanded={sidebarExpanded} />
            <AppSidebar
                mobileOpen={mobileSidebarOpen}
                onNavigate={() => setMobileSidebarOpen(false)}
            />
            {mobileSidebarOpen && (
                <button
                    className="app-shell__overlay"
                    type="button"
                    aria-label="Đóng menu"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
