import cuscSoftwareLogo from "../assets/cusc-software-logo.png";

export default function AppHeader({ onToggleSidebar, sidebarExpanded }) {
    return (
        <header className="app-header">
            <div className="app-header__brand">
                <img className="product-logo" src={cuscSoftwareLogo} alt="CUSC Software" />
                <span>
                    <strong>QC Intelligence</strong>
                    <small>AI-powered Software Testing Platform</small>
                </span>
            </div>

            <button
                className="app-header__icon-button app-header__menu-button"
                type="button"
                aria-label={sidebarExpanded ? "Thu gọn menu" : "Mở menu"}
                aria-controls="app-sidebar"
                aria-expanded={sidebarExpanded}
                onClick={onToggleSidebar}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
            </button>

            <div className="app-header__actions">
                <button
                    className="app-header__icon-button app-header__notification"
                    type="button"
                    aria-label="Thông báo"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                    </svg>
                </button>

                <div className="app-header__divider" aria-hidden="true" />

                <button className="app-header__user" type="button" aria-label="Menu Tester Admin">
                    <span className="app-header__avatar" aria-hidden="true">
                        TA
                    </span>
                    <span className="app-header__user-copy">
                        <strong>Tester Admin</strong>
                        <small>QA Workspace</small>
                    </span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m8 10 4 4 4-4" />
                    </svg>
                </button>
            </div>
        </header>
    );
}
