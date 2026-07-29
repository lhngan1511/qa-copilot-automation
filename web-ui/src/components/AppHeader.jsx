import useBackendHealth from "../hooks/useBackendHealth.js";

export default function AppHeader() {
    const health = useBackendHealth();
    const connected = health.isSuccess && health.data?.status === "ok";
    const label = health.isPending ? "Đang kết nối" : connected ? "Connected" : "Unavailable";

    return (
        <header className="app-header">
            <div>
                <p className="eyebrow">Quality workspace</p>
                <h1>QA Copilot</h1>
            </div>
            <div className="header-meta">
                <span className="environment-label">Development</span>
                <button
                    className={`connection-indicator ${
                        connected ? "connection-indicator--online" : ""
                    }`}
                    type="button"
                    onClick={() => health.refetch()}
                    aria-label={`${label}. Bấm để kiểm tra lại kết nối backend.`}
                >
                    <span className="connection-dot" aria-hidden="true" />
                    {label}
                </button>
            </div>
        </header>
    );
}
