import { Router } from "express";
function requireUser(req) { if (req.user) return req.user; const error = new Error("Cần đăng nhập."); error.code = "AUTH_REQUIRED"; error.statusCode = 401; throw error; }
export default function createRunnerDeviceRoutes({ service }) {
    const router = Router(); const send = action => (req, res, next) => { try { res.json({ success: true, data: action(req), error: null }); } catch (error) { next(error); } };
    router.get("/", send(req => service.listForUser(requireUser(req).userId)));
    router.post("/", send(req => service.create({ userId: requireUser(req).userId, machineName: req.body?.machineName })));
    router.post("/:runnerId/revoke", send(req => service.revoke(req.params.runnerId, requireUser(req).userId)));
    return router;
}
