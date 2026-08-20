import { Router } from "express";

export default function createImageRequirementRoutes({ service }) {
    const router = Router();
    router.post("/analyze", async (req, res, next) => {
        try {
            const data = await service.analyze({ projectId: req.get("x-project-id"), images: req.body?.images, analysisMode: req.body?.analysisMode });
            res.status(201).json({ success: true, data, error: null });
        } catch (error) { next(error); }
    });
    router.post("/:draftId/confirm", (req, res, next) => {
        try {
            const data = service.confirm({ projectId: req.get("x-project-id"), draftId: req.params.draftId, markdownContent: req.body?.markdownContent, fileName: req.body?.fileName });
            res.status(200).json({ success: true, data, error: null });
        } catch (error) { next(error); }
    });
    return router;
}
