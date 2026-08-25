import { Router } from "express";
const COOKIE = "qa_copilot_session";
export function sessionIdFrom(req) { return String(req.headers.cookie ?? "").split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? ""; }
export function attachPrincipal(auth) { return (req, _res, next) => { req.user = auth.current(sessionIdFrom(req)); next(); }; }
export default function createAuthRoutes({ auth }) {
    const router = Router();
    router.post("/login", (req, res, next) => { try { const { sessionId, user } = auth.login(req.body ?? {}); res.cookie(COOKIE, sessionId, { httpOnly: true, sameSite: "lax", path: "/" }); res.json({ success: true, data: user, error: null }); } catch (error) { next(error); } });
    router.post("/logout", (req, res) => { auth.logout(sessionIdFrom(req)); res.clearCookie(COOKIE, { path: "/" }); res.json({ success: true, data: null, error: null }); });
    router.get("/me", (req, res) => res.json({ success: true, data: req.user, error: null }));
    return router;
}
