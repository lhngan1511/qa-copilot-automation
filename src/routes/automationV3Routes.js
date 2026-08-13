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

    // P0-D (C) — danh sách workspace (newest first) + xóa (không cascade shared assets).
    router.get("/workspaces", handle(applicationService, (svc) => svc.listWorkspaces()));

    router.delete("/workspaces/:workspaceId", handle(applicationService, (svc, req) =>
        svc.deleteWorkspace({ workspaceId: req.params.workspaceId })));

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

    router.get("/workspaces/:workspaceId/recordings/:recordingId/source", handle(applicationService, (svc, req) =>
        svc.getRecordingSource({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId
        })));

    router.get("/workspaces/:workspaceId/recordings/:recordingId", handle(applicationService, (svc, req) =>
        svc.getRecordingDetail({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId
        })));

    router.delete("/workspaces/:workspaceId/recordings/:recordingId", handle(applicationService, (svc, req) =>
        svc.deleteRecording({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId
        })));

    router.get("/workspaces/:workspaceId/testcases/:testCaseId/recordings", handle(applicationService, (svc, req) =>
        svc.listRecordings({ workspaceId: req.params.workspaceId, testCaseId: req.params.testCaseId })));

    // ---------- B2. Record Mapping — Segment (5C-0) ----------
    router.post("/workspaces/:workspaceId/recordings/:recordingId/segments", handle(applicationService, (svc, req) =>
        svc.createSegment({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId,
            startStep: req.body?.startStep,
            endStep: req.body?.endStep,
            type: req.body?.type,
            testCaseId: req.body?.testCaseId
        })));

    router.patch("/workspaces/:workspaceId/recordings/:recordingId/segments/:segmentId", handle(applicationService, (svc, req) =>
        svc.updateSegment({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId,
            segmentId: req.params.segmentId,
            startStep: req.body?.startStep,
            endStep: req.body?.endStep,
            type: req.body?.type,
            testCaseId: req.body?.testCaseId
        })));

    router.post("/workspaces/:workspaceId/recordings/:recordingId/segments/:segmentId/confirm", handle(applicationService, (svc, req) =>
        svc.confirmSegment({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId,
            segmentId: req.params.segmentId
        })));

    router.delete("/workspaces/:workspaceId/recordings/:recordingId/segments/:segmentId", handle(applicationService, (svc, req) =>
        svc.deleteSegment({
            workspaceId: req.params.workspaceId,
            recordingId: req.params.recordingId,
            segmentId: req.params.segmentId
        })));

    router.post("/workspaces/:workspaceId/testcases/:testCaseId/segments/reorder", handle(applicationService, (svc, req) =>
        svc.reorderTestCaseSegments({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            segmentIds: req.body?.segmentIds
        })));

    router.post("/workspaces/:workspaceId/testcases/:testCaseId/automation-decision", handle(applicationService, (svc, req) =>
        svc.setAutomationDecision({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            decision: req.body?.decision
        })));

    // ---------- B3. Expected Result (5C) ----------
    router.patch("/workspaces/:workspaceId/testcases/:testCaseId/test-data", handle(applicationService, (svc, req) =>
        svc.saveTestData({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            testData: req.body?.testData ?? {}
        })));

    router.patch("/workspaces/:workspaceId/testcases/:testCaseId/expected-result", handle(applicationService, (svc, req) =>
        svc.updateExpectedResult({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            expectedResult: req.body?.expectedResult
        })));

    // ---------- B4. ActionBlock + Binding (6B/6C — CANONICAL) ----------
    router.get("/workspaces/:workspaceId/blocks", handle(applicationService, (svc, req) =>
        svc.listBlocks({
            workspaceId: req.params.workspaceId,
            reusableOnly: req.query?.reusable === "1" || req.query?.reusable === "true"
        })));

    router.post("/workspaces/:workspaceId/blocks", handle(applicationService, (svc, req) =>
        svc.createBlock({
            workspaceId: req.params.workspaceId,
            recordingId: req.body?.recordingId,
            startStep: req.body?.startStep,
            endStep: req.body?.endStep,
            label: req.body?.label,
            scope: req.body?.scope,
            kind: req.body?.kind
        })));

    router.patch("/workspaces/:workspaceId/blocks/:blockId", handle(applicationService, (svc, req) =>
        svc.updateBlock({
            workspaceId: req.params.workspaceId,
            blockId: req.params.blockId,
            label: req.body?.label,
            scope: req.body?.scope,
            kind: req.body?.kind,
            startStep: req.body?.startStep,
            endStep: req.body?.endStep
        })));

    router.post("/workspaces/:workspaceId/blocks/:blockId/confirm", handle(applicationService, (svc, req) =>
        svc.confirmBlock({
            workspaceId: req.params.workspaceId,
            blockId: req.params.blockId
        })));

    router.delete("/workspaces/:workspaceId/blocks/:blockId", handle(applicationService, (svc, req) =>
        svc.deleteBlock({
            workspaceId: req.params.workspaceId,
            blockId: req.params.blockId
        })));

    router.get("/workspaces/:workspaceId/blocks/:blockId/usage", handle(applicationService, (svc, req) =>
        svc.getBlockUsage({
            workspaceId: req.params.workspaceId,
            blockId: req.params.blockId
        })));

    router.get("/workspaces/:workspaceId/testcases/:testCaseId/binding", handle(applicationService, (svc, req) =>
        svc.getBinding({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId
        })));

    router.post("/workspaces/:workspaceId/testcases/:testCaseId/binding/blocks", handle(applicationService, (svc, req) =>
        svc.bindBlock({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            blockId: req.body?.blockId
        })));

    router.delete("/workspaces/:workspaceId/testcases/:testCaseId/binding/blocks/:blockId", handle(applicationService, (svc, req) =>
        svc.unbindBlock({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            blockId: req.params.blockId,
            order: req.query?.order !== undefined ? Number(req.query.order) : null
        })));

    router.post("/workspaces/:workspaceId/testcases/:testCaseId/binding/reorder", handle(applicationService, (svc, req) =>
        svc.reorderBinding({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            blockIds: req.body?.blockIds
        })));

    // ---------- B5. Action Library (Boundary — shared asset) ----------
    router.get("/workspaces/:workspaceId/library", handle(applicationService, (svc, req) =>
        svc.listLibrary({ workspaceId: req.params.workspaceId })));

    router.post("/workspaces/:workspaceId/library", handle(applicationService, (svc, req) =>
        svc.saveToLibrary({
            workspaceId: req.params.workspaceId,
            blockId: req.body?.blockId,
            label: req.body?.label
        })));

    router.post("/workspaces/:workspaceId/testcases/:testCaseId/library/blocks", handle(applicationService, (svc, req) =>
        svc.bindLibraryBlock({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            blockId: req.body?.blockId
        })));

    // ---------- C. Assertions (5B + 5C) ----------
    router.post("/workspaces/:workspaceId/testcases/:testCaseId/assertions", handle(applicationService, (svc, req) =>
        svc.saveDraftAssertion({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            assertion: req.body
        })));

    router.get("/workspaces/:workspaceId/testcases/:testCaseId/assertions", handle(applicationService, (svc, req) =>
        svc.listAssertions({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId
        })));

    router.post("/workspaces/:workspaceId/testcases/:testCaseId/assertions/suggest", handle(applicationService, (svc, req) =>
        svc.suggestAssertionsForTestcase({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId
        })));

    router.patch("/workspaces/:workspaceId/testcases/:testCaseId/assertions/:assertionId", handle(applicationService, (svc, req) =>
        svc.updateAssertion({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            assertionId: req.params.assertionId,
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

    // P0-C - Chay thu testcase dang mo (dung generated artifact; chan khi stale).
    router.post("/workspaces/:workspaceId/testcases/:testCaseId/run", handle(applicationService, async (svc, req) =>
        svc.runTestcase({
            workspaceId: req.params.workspaceId,
            testCaseId: req.params.testCaseId,
            env: req.body?.env ?? {}
        })));

    return router;
}
