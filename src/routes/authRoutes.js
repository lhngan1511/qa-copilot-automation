import { Router } from "express";
const COOKIE = "qa_copilot_session";
export function sessionIdFrom(req) { return String(req.headers.cookie ?? "").split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? ""; }
export function attachPrincipal(auth) { return (req, _res, next) => { req.user = auth.current(sessionIdFrom(req)); next(); }; }
function requireAdmin(req) {
    if (req.user?.role !== "ADMIN") {
        const error = new Error("Chỉ quản trị viên mới được thực hiện thao tác này.");
        error.code = "AUTH_FORBIDDEN"; error.statusCode = 403;
        throw error;
    }
}

export default function createAuthRoutes({ auth }) {
    const router = Router();
    router.post("/login", (req, res, next) => {
        try {
            const rememberMe = Boolean(req.body?.rememberMe);
            const { sessionId, user, ttlMs } = auth.login({ ...req.body, rememberMe });
            res.cookie(COOKIE, sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: rememberMe ? ttlMs : undefined });
            res.json({ success: true, data: user, error: null });
        } catch (error) { next(error); }
    });
    router.post("/logout", (req, res) => { auth.logout(sessionIdFrom(req)); res.clearCookie(COOKIE, { path: "/" }); res.json({ success: true, data: null, error: null }); });
    router.get("/me", (req, res) => res.json({ success: true, data: req.user, error: null }));
    router.get("/users", (req, res, next) => {
        try { requireAdmin(req); res.json({ success: true, data: auth.listUsers(), error: null }); }
        catch (error) { next(error); }
    });
    router.post("/users/:username/reset-password", (req, res, next) => {
        try {
            requireAdmin(req);
            const user = auth.resetPassword({ requestedByRole: req.user.role, username: req.params.username, newPassword: req.body?.newPassword });
            res.json({ success: true, data: user, error: null });
        } catch (error) { next(error); }
    });
    return router;
}
