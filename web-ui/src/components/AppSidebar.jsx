import { Link, useLocation } from "react-router-dom";
import { navigationGroups } from "../config/navigation.js";

const iconPaths = {
    home: (
        <>
            <path d="m3 11 9-8 9 8" />
            <path d="M5 10v10h14V10M9 20v-6h6v6" />
        </>
    ),
    sparkles: (
        <>
            <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
            <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
            <path d="M5 15v4M3 17h4" />
        </>
    ),
    automation: (
        <>
            <rect x="5" y="7" width="14" height="11" rx="3" />
            <path d="M9 11h.01M15 11h.01M9 15h6M12 7V4m-2 0h4M5 12H3m18 0h-2" />
        </>
    ),
    code: (
        <>
            <path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14" />
        </>
    ),
    reports: (
        <>
            <path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18" />
        </>
    )
};

function NavigationIcon({ name }) {
    return (
        <span className="app-sidebar__item-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
                {iconPaths[name]}
            </svg>
        </span>
    );
}

export default function AppSidebar({ mobileOpen = false, onNavigate }) {
    const location = useLocation();

    return (
        <aside
            id="app-sidebar"
            className={`app-sidebar ${mobileOpen ? "app-sidebar--open" : ""}`}
            aria-label="Điều hướng chính"
        >
            <nav className="app-sidebar__navigation">
                {navigationGroups.map(group => (
                    <section className="app-sidebar__group" key={group.label}>
                        <h2>{group.label}</h2>
                        <div className="app-sidebar__items">
                            {group.items.map(item => {
                                const active = item.activePrefix
                                    ? location.pathname.startsWith(item.activePrefix)
                                    : item.end
                                      ? location.pathname === item.to
                                      : false;

                                return item.to ? (
                                    <Link
                                        className={`app-sidebar__item ${
                                            active ? "app-sidebar__item--active" : ""
                                        }`}
                                        to={item.to}
                                        key={item.label}
                                        aria-current={active ? "page" : undefined}
                                        onClick={onNavigate}
                                    >
                                        <NavigationIcon name={item.icon} />
                                        <span className="app-sidebar__item-copy">
                                            <strong>{item.label}</strong>
                                            <small>{item.description}</small>
                                        </span>
                                    </Link>
                                ) : (
                                    <div
                                        className="app-sidebar__item app-sidebar__item--disabled"
                                        aria-disabled="true"
                                        key={item.label}
                                    >
                                        <NavigationIcon name={item.icon} />
                                        <span className="app-sidebar__item-copy">
                                            <span className="app-sidebar__item-title">
                                                <strong>{item.label}</strong>
                                                {item.soon && (
                                                    <span className="app-sidebar__soon">Soon</span>
                                                )}
                                            </span>
                                            <small>{item.description}</small>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </nav>

            <aside className="app-sidebar__principle">
                <span aria-hidden="true">✦</span>
                <p>AI hỗ trợ phân tích. Tester là người review và xác nhận kết quả cuối cùng.</p>
            </aside>
        </aside>
    );
}
