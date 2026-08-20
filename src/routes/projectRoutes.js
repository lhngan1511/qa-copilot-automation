import { Router } from "express";

const clean = value => String(value ?? "").trim();

export default function createProjectRoutes({ repository }) {
    if (!repository) throw new Error("Project repository is required.");
    const router = Router();
    router.get("/", async (_req, res, next) => { try { res.json({ success: true, data: await repository.list(), error: null }); } catch (e) { next(e); } });
    router.get("/:projectId", async (req, res, next) => { try { const item = await repository.getById(req.params.projectId); if (!item) return res.status(404).json({ success: false, data: null, error: { code: "PROJECT_NOT_FOUND", message: "Không tìm thấy Project." } }); res.json({ success: true, data: item, error: null }); } catch (e) { next(e); } });
    router.post("/", async (req, res, next) => { try { const name = clean(req.body?.name); if (!name) return res.status(400).json({ success: false, data: null, error: { code: "PROJECT_NAME_REQUIRED", message: "Tên Project bắt buộc." } }); const item = await repository.create({ name, code: clean(req.body?.code), description: clean(req.body?.description) }); res.status(201).json({ success: true, data: item, error: null }); } catch (e) { next(e); } });
    router.patch("/:projectId", async (req, res, next) => { try { const item = await repository.update(req.params.projectId, req.body ?? {}); if (!item) return res.status(404).json({ success: false, data: null, error: { code: "PROJECT_NOT_FOUND", message: "Không tìm thấy Project." } }); res.json({ success: true, data: item, error: null }); } catch (e) { next(e); } });
    router.delete("/:projectId", async (req, res, next) => { try { const item = await repository.delete(req.params.projectId); if (!item) return res.status(404).json({ success: false, data: null, error: { code: "PROJECT_NOT_FOUND", message: "Không tìm thấy Project." } }); res.json({ success: true, data: { projectId: item.projectId, deleted: true }, error: null }); } catch (e) { next(e); } });
    return router;
}
