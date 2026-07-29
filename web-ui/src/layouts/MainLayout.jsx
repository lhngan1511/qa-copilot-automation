import { NavLink, Outlet } from "react-router-dom";
import AppHeader from "../components/AppHeader.jsx";

export default function MainLayout() {
    return (
        <div className="app-shell">
            <AppHeader />
            <aside className="sidebar" aria-label="Điều hướng chính">
                <div className="sidebar-brand" aria-hidden="true">
                    QC
                </div>
                <nav className="navigation">
                    <p className="navigation-label">Workspace</p>
                    <NavLink
                        className={({ isActive }) =>
                            `navigation-item ${isActive ? "navigation-item--active" : ""}`
                        }
                        to="/"
                        end
                    >
                        <span className="navigation-icon" aria-hidden="true">
                            W
                        </span>
                        <span>
                            <strong>Workflows</strong>
                            <small>Theo dõi tiến trình</small>
                        </span>
                    </NavLink>
                    <div className="navigation-item navigation-item--disabled" aria-disabled="true">
                        <span className="navigation-icon" aria-hidden="true">
                            A
                        </span>
                        <span>
                            <strong>Automation Intelligence</strong>
                            <small>Coming later</small>
                        </span>
                    </div>
                </nav>
                <div className="sidebar-note">
                    <span className="sidebar-note__mark">i</span>
                    <p>Chỉ dữ liệu public workflow được hiển thị trong workspace này.</p>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
