function ProductMark() {
    return (
        <svg className="product-mark" viewBox="0 0 40 40" role="img" aria-label="CUSC QC">
            <path d="M20 2 36 11v18L20 38 4 29V11L20 2Z" fill="currentColor" opacity=".16" />
            <path d="M20 6.5 32 13v14L20 33.5 8 27V13L20 6.5Z" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M20 13 26 16.5v7L20 27l-6-3.5v-7L20 13Z" fill="currentColor" />
        </svg>
    );
}

export default function AppHeader({ onToggleSidebar, sidebarExpanded }) {
    return (
        <header className="app-header">
            <div className="app-header__brand">
                <ProductMark />
                <span>
                    <strong>CUSC QC Intelligence</strong>
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
