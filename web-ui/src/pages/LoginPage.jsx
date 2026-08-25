import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
export default function LoginPage() {
    const { login } = useAuth(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
    const submit = async event => { event.preventDefault(); setBusy(true); setError(""); try { await login(username, password); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    return <main className="login-page"><form className="login-card" onSubmit={submit}><small>QA Copilot</small><h1>Đăng nhập</h1><label>Tên đăng nhập<input autoFocus value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></label><label>Mật khẩu<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>{error ? <p className="login-error">{error}</p> : null}<button disabled={busy}>{busy ? "Đang đăng nhập..." : "Đăng nhập"}</button></form></main>;
}
