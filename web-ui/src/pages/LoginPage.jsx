import { useState } from "react";
import cuscSoftwareLogo from "../assets/cusc-software-logo.png";
import { useAuth } from "../contexts/AuthContext.jsx";

// Ghi nhớ đăng nhập (theo yêu cầu): giữ cả tài khoản + mật khẩu ở máy này để lần đăng nhập
// sau (kể cả sau khi Đăng xuất) không phải gõ lại — chỉ Đăng xuất mới kết thúc phiên làm việc,
// KHÔNG xóa thông tin đã ghi nhớ. Lưu trên trình duyệt (localStorage), không qua server.
const REMEMBER_KEY = "qa-copilot.rememberedCredentials";
function loadRemembered() {
    try {
        const raw = window.localStorage.getItem(REMEMBER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export default function LoginPage() {
    const { login } = useAuth();
    const remembered = loadRemembered();
    const [username, setUsername] = useState(remembered?.username ?? "");
    const [password, setPassword] = useState(remembered?.password ?? "");
    const [rememberMe, setRememberMe] = useState(Boolean(remembered));
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async event => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            await login(username, password, rememberMe);
            if (rememberMe) window.localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password }));
            else window.localStorage.removeItem(REMEMBER_KEY);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="login-page">
            <form className="login-card" onSubmit={submit}>
                <img className="login-card__logo" src={cuscSoftwareLogo} alt="QA Copilot" />

                <label className="login-field">
                    <span>Tài khoản</span>
                    <input autoFocus value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
                </label>

                <label className="login-field">
                    <span>Mật khẩu</span>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                </label>

                <label className="login-remember">
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                    <span>Ghi nhớ đăng nhập</span>
                </label>

                {error ? <p className="login-error" role="alert">{error}</p> : null}

                <button className="login-submit" disabled={busy || !username || !password}>
                    {busy ? "Đang đăng nhập…" : "Đăng nhập"}
                </button>
            </form>
        </main>
    );
}
