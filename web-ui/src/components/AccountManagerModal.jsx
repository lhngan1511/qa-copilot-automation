import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { listUsers, resetUserPassword } from "../api/authApi.js";

export default function AccountManagerModal({ onClose }) {
    const [accounts, setAccounts] = useState(null);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        listUsers().then(setAccounts).catch(e => { setError(e.message || "Không tải được danh sách tài khoản."); setAccounts([]); });
    }, []);

    useEffect(() => {
        const handler = e => { if (e.key === "Escape") onClose?.(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return accounts ?? [];
        return (accounts ?? []).filter(a => a.displayName.toLowerCase().includes(q) || a.username.toLowerCase().includes(q));
    }, [accounts, search]);

    const resetPassword = async account => {
        const newPassword = window.prompt(`Mật khẩu mới cho "${account.username}" (tối thiểu 8 ký tự):`);
        if (!newPassword) return;
        try {
            await resetUserPassword(account.username, newPassword);
            window.alert(`Đã đặt lại mật khẩu cho "${account.username}".`);
        } catch (e) {
            window.alert(e.message || "Không đặt lại được mật khẩu.");
        }
    };

    return createPortal((
        <div className="account-modal-overlay" onClick={onClose}>
            <div className="account-modal" role="dialog" aria-modal="true" aria-label="Quản lý tài khoản" onClick={e => e.stopPropagation()}>
                <div className="account-modal__header">
                    <b>Quản lý tài khoản</b>
                    <button type="button" className="v3-drawer__close" onClick={onClose} aria-label="Đóng">✕</button>
                </div>
                <input
                    className="v3-input account-modal__search"
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm theo tên hoặc tài khoản…"
                    autoFocus
                />
                {error ? <p className="account-modal__empty">{error}</p> : null}
                <div className="account-modal__list">
                    {accounts === null ? (
                        <p className="account-modal__empty">Đang tải…</p>
                    ) : filtered.length === 0 ? (
                        <p className="account-modal__empty">Không tìm thấy tài khoản phù hợp.</p>
                    ) : filtered.map(account => (
                        <div className="account-modal__row" key={account.userId}>
                            <span className="account-modal__row-name">
                                <b>{account.displayName}</b>
                                <small>{account.username}</small>
                            </span>
                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => resetPassword(account)}>
                                Đặt lại mật khẩu
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    ), document.body);
}
