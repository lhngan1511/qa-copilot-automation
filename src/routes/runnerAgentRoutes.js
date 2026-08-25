import { Router } from "express";

function respondError(res, error) {
    return res.status(error?.statusCode ?? 500).json({
        success: false,
        errorCode: error?.code ?? "RUNNER_AGENT_FAILED",
        message: error?.message ?? "Runner Agent request failed.",
        details: null
    });
}

export default function createRunnerAgentRoutes({ service, applicationService = null } = {}) {
    const router = Router();
    const execute = handler => async (req, res) => {
        try { return res.json(await handler(req)); } catch (error) { return respondError(res, error); }
    };

    router.get("/", execute(() => ({ success: true, data: service.listAgents(), error: null })));
    router.post("/register", execute(req => ({ success: true, data: service.register(req.body ?? {}), error: null })));
    router.post("/:agentId/heartbeat", execute(req => ({ success: true, data: service.heartbeat({ agentId: req.params.agentId, token: req.body?.token }), error: null })));
    router.post("/:agentId/jobs/claim", execute(req => ({ success: true, data: service.claim({ agentId: req.params.agentId, token: req.body?.token }), error: null })));
    router.post("/:agentId/jobs/:jobId/complete", execute(req => {
        const completed = service.complete({ agentId: req.params.agentId, jobId: req.params.jobId, token: req.body?.token, result: req.body?.result });
        if (completed.job.type === "RUN_TESTCASE" && applicationService) {
            applicationService.completeRemoteRun({ job: completed.job, result: completed.job.result });
        }
        return { success: true, data: service.publicJob(completed.job), error: null };
    }));
    return router;
}
