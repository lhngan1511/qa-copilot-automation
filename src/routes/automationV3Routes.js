import { Router } from "express";

/*
 automationV3Routes — REST endpoints cho Architecture V3 (Record by Testcase).

 Luồng bắt buộc (điểm 7):
   Route → AutomationWorkspaceApplicationService → Domain/Store/GenerateService → Renderer.

 Route KHÔNG chứa business logic: không gọi Renderer trực tiếp, không gọi Store để tự
 xử lý nghiệp vụ, không tự transition state, không tự ghi file, không tự chọn recording,
 không tự bind testData.

 Error contract thống nhất:
   { success:false, errorCode, message, details }
 Không trả stack trace ra frontend.
*/

function sendError(res, error) {
    const isHttp = Number.isInteger(error?.statusCode) && error.statusCode >= 400;
    const statusCode = isHttp ? error.statusCode : 500;
    const body = {
        success: false,
        errorCode: isHttp ? (error?.code ?? "INVALID_REQUEST") : "GENERATE_FAILED",
        message: isHttp ? (error?.message ?? "Request failed.") : "Internal server error.",
        details: isHttp ? (error?.details ?? null) : null
    };
    return res.status(statusCode).json(body);
}

/** Bọc handler: gọi service, trả JSON hoặc lỗi V3 thống nhất. */
function handle(service, fn) {
    return (req, res) => {
        try {
            const result = fn(service, req);
            if (result && typeof result.then === "function") {
                return result.then(d => res.json(d)).catch(err => sendError(res, err));
            }
            return res.json(result);
        } catch (error) {
            return sendError(res, error);
        }
    };
}

export default function createAutomationV3Routes({ applicationService = null } = {}) {
    const router = Router();

    // ---------- A. Workspace ----------
    router.post("/workspaces", handle(applicationService, (svc, req) =>
        svc.createWorkspace({
            source: req.body?.source,
            approvedTestCases: req.body?.approvedTestCases,
            module: req.body?.module,
            sourceFile: req.body?.sourceFile
        })));

    router.get("/workspaces/:workspaceId", handle(applicationService, (svc, req) =>
        svc.getWorkspace(req.params.workspaceId)));

    router.post("/workspaces/:workspaceId/testcases/:testCaseId/select", handle(applicationService, (svc, req) =>
        svc.selectTestCase({ workspaceId: req.params.workspaceId, testCaseId: req.params.testCaseId })));

    router.post("/workspaces/:workspaceId/testcases/:testCaseId/unselect", handle(applicationService, (svc, req) =>
        svc.unselectTestCase({ workspaceId: req.params.workspaceId, testCaseId: req.params.testCaseId })));

    // ---------- B. Recording ----------
    router.post("/workspaces/:workspaceId/recordings/start", handle(applicationService, (svc, req) =>
        svc.startRecording({
            workspaceId: req.params.workspaceId,
            testCaseId: req.body?.testCaseId,
            type: req.body?.type,
            url: req.body?.url,
            browser: req.body?.browser
        })));

    router.post("/workspaces/:workspaceId/recordings/stop", handle(applicationService, (svc, req) =>
        svc.stopRecording({
            workspaceId: req.params.workspaceId,
            recordingId: req.body?.recordingId,
            source: req.body?.source
        })));

    router.post("/workspaces/:workspaceId/recordings/:recordingId/approve", handle(applicationService, (svc, req) =>
        svc.approveRecording({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId,
            approvedBy: req.body?.approvedBy
        })));

    router.post("/workspaces/:workspaceId/recordings/:recordingId/reject", handle(applicationService, (svc, req) =>
        svc.rejectRecording({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId,
            reason: req.body?.reason
        })));

    router.get("/workspaces/:workspaceId/testcases/:testCaseId/recordings", handle(applicationService, (svc, req) =>
        svc.listRecordings({ workspaceId: req.params.workspaceId, testCaseId: req.params.testCaseId })));

    // ---------- C. Assertions ----------
    router.post("/workspaces/:workspaceId/testcases/:testCaseId/assertions", handle(applicationService, (svc, req) =>
        svc.saveDraftAssertion({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            assertion: req.body
        })));

    router.patch("/workspaces/:workspaceId/testcases/:testCaseId/assertions/:assertionId/confirm", handle(applicationService, (svc, req) =>
        svc.confirmAssertion({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            assertionId: req.params.assertionId
        })));

    router.patch("/workspaces/:workspaceId/testcases/:testCaseId/assertions/:assertionId/reject", handle(applicationService, (svc, req) =>
        svc.rejectAssertion({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            assertionId: req.params.assertionId,
            reason: req.body?.reason
        })));

    router.delete("/workspaces/:workspaceId/testcases/:testCaseId/assertions/:assertionId", handle(applicationService, (svc, req) =>
        svc.removeAssertion({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            assertionId: req.params.assertionId
        })));

    // ---------- D. Generate ----------
    router.post("/workspaces/:workspaceId/testcases/:testCaseId/generate", handle(applicationService, (svc, req) =>
        svc.generate({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            confirmedTestData: req.body?.confirmedTestData
        })));

    return router;
}
