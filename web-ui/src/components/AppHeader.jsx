import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import cuscSoftwareLogo from "../assets/cusc-software-logo.png";
import ProjectSwitcher from "./ProjectSwitcher.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useRunner } from "../contexts/RunnerContext.jsx";
import { listRunnerDevices, revokeRunnerDevice } from "../api/runnerDeviceApi.js";
import AccountManagerModal from "./AccountManagerModal.jsx";

export default function AppHeader({ onToggleSidebar, sidebarExpanded }) {
    const { user, logout } = useAuth();
    const isAdmin = user?.role === "ADMIN";
    const navigate = useNavigate();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [runnerDevices, setRunnerDevices] = useState([]);
    const [accountManagerOpen, setAccountManagerOpen] = useState(false);
    // Chọn Runner 1 lần, dùng chung cho CodeGen/Kiểm thử biên/Automation V3 (Ngân yêu cầu
    // 2026-09-07) — xem RunnerContext.jsx.
    const { runnerAgentId, setRunnerAgentId, runnerAgents } = useRunner();

    useEffect(() => {
        let cancelled = false;
        listRunnerDevices().then(devices => {
            if (!cancelled) setRunnerDevices(Array.isArray(devices) ? devices : []);
        }).catch(() => {
            if (!cancelled) setRunnerDevices([]);
        });
        return () => { cancelled = true; };
    }, [user?.userId]);

    const openRunnerRegistration = () => {
        setUserMenuOpen(false);
        window.sessionStorage.setItem("qa-copilot.openRunnerRegistration", "1");
        navigate("/automation");
        window.dispatchEvent(new CustomEvent("qa-copilot:register-runner"));
    };
    const revokeRunner = async device => {
        const confirmed = window.confirm(`Thu hồi máy chạy \"${device.machineName}\"? Máy này sẽ không thể nhận job nữa.`);
        if (!confirmed) return;
        try {
            await revokeRunnerDevice(device.runnerId);
            setRunnerDevices(devices => devices.filter(item => item.runnerId !== device.runnerId));
        } catch (error) {
            window.alert(error.message || "Không thể thu hồi máy chạy.");
        }
    };
    return (
        <header className="app-header">
            <div className="app-header__brand">
                <img className="product-logo" src={cuscSoftwareLogo} alt="CUSC Software" />
                <span className="app-header__brand-copy">
                    <strong>QA Copilot</strong>
                    <small className="app-header__brand-subtitle">Testing &amp; Automation Workspace</small>
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

            <ProjectSwitcher />

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

                <div className="app-header__user-menu">
                    <button className="app-header__user" type="button" aria-expanded={userMenuOpen} aria-haspopup="menu" aria-label={`Mở menu ${user?.displayName ?? ""}`} onClick={() => {
                        if (!userMenuOpen) {
                            listRunnerDevices().then(devices => setRunnerDevices(Array.isArray(devices) ? devices : [])).catch(() => setRunnerDevices([]));
                        }
                        setUserMenuOpen(open => !open);
                    }}>
                        <span className="app-header__avatar" aria-hidden="true">
                            {String(user?.displayName ?? "T").slice(0, 2).toUpperCase()}
                        </span>
                        <span className="app-header__user-copy">
                            <strong>{user?.displayName ?? "Tester"}</strong>
                            <small>QA Workspace</small>
                        </span>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m8 10 4 4 4-4" />
                        </svg>
                    </button>
                    {userMenuOpen ? (
                        <div className="app-header__user-popover" role="menu">
                            <span className="app-header__user-menu-title">Runner đang dùng</span>
                            <select
                                className="app-header__runner-select"
                                value={runnerAgentId}
                                onChange={event => setRunnerAgentId(event.target.value)}
                                onClick={event => event.stopPropagation()}
                                aria-label="Chọn máy Runner áp dụng cho CodeGen/Kiểm thử biên/Automation"
                            >
                                <option value="">Chạy trên máy chủ</option>
                                {runnerAgents.filter(agent => agent.status === "ONLINE" || agent.status === "BUSY").map(agent => (
                                    <option value={agent.agentId} key={agent.agentId} disabled={agent.status !== "ONLINE"}>
                                        {agent.machineName} · {agent.status === "ONLINE" ? "Online" : "Đang chạy"}{agent.runnerVersion ? ` · v${agent.runnerVersion}` : ""}
                                    </option>
                                ))}
                            </select>
                            <div className="app-header__user-menu-divider" />
                            <span className="app-header__user-menu-title">Máy chạy Automation</span>
                            {runnerDevices.filter(device => device.status !== "REVOKED").length > 0 ? runnerDevices.filter(device => device.status !== "REVOKED").map(device => (
                                <div className="app-header__runner-device" key={device.runnerId}>
                                    <span>{device.machineName} · {device.status === "ONLINE" ? "Online" : "Offline"}</span>
                                    <button type="button" className="app-header__runner-revoke" onClick={() => revokeRunner(device)} aria-label={`Thu hồi máy chạy ${device.machineName}`}>Thu hồi</button>
                                </div>
                            )) : <span className="app-header__runner-device">Chưa đăng ký máy chạy</span>}
                            <div className="app-header__user-menu-divider" />
                            <button type="button" role="menuitem" onClick={openRunnerRegistration}>Kết nối máy chạy này</button>
                            {isAdmin ? (
                                <button type="button" role="menuitem" onClick={() => { setUserMenuOpen(false); setAccountManagerOpen(true); }}>Quản lý tài khoản</button>
                            ) : null}
                            <div className="app-header__user-menu-divider" />
                            <button type="button" role="menuitem" onClick={() => { setUserMenuOpen(false); logout(); }}>Đăng xuất</button>
                        </div>
                    ) : null}
                </div>
            </div>
            {accountManagerOpen ? <AccountManagerModal onClose={() => setAccountManagerOpen(false)} /> : null}
        </header>
    );
}
