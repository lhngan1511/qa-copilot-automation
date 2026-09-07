import { Router } from "express";
import { handle } from "./automationV3Routes.js";

/*
 boundaryTestingRoutes — Kiểm thử biên (Boundary Testing), HOÀN TOÀN độc lập với
 /api/automation-v3 — mount riêng ở /api/boundary-testing. Cùng error contract
 { success:false, errorCode, message, details } (tái dùng handle/sendError thuần, không kéo theo
 phụ thuộc domain automation-v3 nào).
*/

export default function createBoundaryTestingRoutes({ service = null } = {}) {
    const router = Router();

    router.post("/entries", handle(service, (svc, req) =>
        svc.createEntry({
            projectId: req.get("x-project-id") || null,
            label: req.body?.label,
            scriptSource: req.body?.scriptSource
        })));

    router.get("/entries", handle(service, (svc, req) =>
        svc.listEntries({ projectId: req.get("x-project-id") || null })));

    router.get("/entries/:entryId", handle(service, (svc, req) =>
        svc.getEntry({ entryId: req.params.entryId })));

    router.delete("/entries/:entryId", handle(service, (svc, req) =>
        svc.deleteEntry({ entryId: req.params.entryId })));

    router.patch("/entries/:entryId/target", handle(service, (svc, req) =>
        svc.setTarget({ entryId: req.params.entryId, stepOrder: req.body?.stepOrder })));

    router.patch("/entries/:entryId/sensitive-overrides", handle(service, (svc, req) =>
        svc.setSensitiveOverrides({ entryId: req.params.entryId, overrides: req.body?.overrides })));

    router.post("/entries/:entryId/suggest", handle(service, (svc, req) =>
        svc.suggestValues({ entryId: req.params.entryId })));

    router.post("/entries/:entryId/candidates", handle(service, (svc, req) =>
        svc.saveCandidates({ entryId: req.params.entryId, candidates: req.body?.candidates })));

    router.post("/entries/:entryId/preview", handle(service, (svc, req) =>
        svc.previewSpec({ entryId: req.params.entryId, candidates: req.body?.candidates })));

    router.post("/entries/:entryId/run", handle(service, (svc, req) =>
        svc.runEntry({
            entryId: req.params.entryId,
            candidateIds: req.body?.candidateIds ?? null,
            env: req.body?.env ?? {},
            agentId: req.body?.agentId ?? null,
            userId: req.user?.userId ?? null
        })));

    router.patch("/entries/:entryId/candidates/:candidateId", handle(service, (svc, req) =>
        svc.markDefect({
            entryId: req.params.entryId,
            candidateId: req.params.candidateId,
            defectFlag: req.body?.defectFlag,
            note: req.body?.note
        })));

    return router;
}
