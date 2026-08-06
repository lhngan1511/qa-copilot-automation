import path from "node:path";
import fs from "node:fs";
import { renderV3Spec, pickLatestApproved } from "./rendererV3.js";

/*
 GenerateService — Orchestrator (Architecture V3).

 Trách nhiệm (duy nhất Service làm):
   Workspace → lấy recording → lấy testcase → lấy data
   → gọi Renderer → node --check → ghi file → cập nhật Workspace

 Renderer KHÔNG biết filesystem/workspace. API chỉ gọi Service (không gọi Renderer trực tiếp).

 Flow tương lai (AI Review):
   Recording → Renderer → Draft Spec → [AI Review] → [Tester Review] → Write File.
   AI KHÔNG chen vào giữa Renderer.
*/

export const GENERATE_ERRORS = {
    RECORDING_APPROVAL_REQUIRED: "RECORDING_APPROVAL_REQUIRED",
    TESTCASE_NOT_FOUND: "TESTCASE_NOT_FOUND",
    WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND"
};

export default class GenerateService {
    constructor({ workspace = null, store = null, outputDir = null } = {}) {
        this.workspace = workspace;
        this.store = store;
        this.outputDir = outputDir ?? path.resolve("outputs", "generated-tests");
    }

    /**
     * Generate spec cho 1 testcase trong workspace.
     * @param {object} o
     * @param {string} o.workspaceId
     * @param {string} o.testCaseId
     * @param {object} o.approvedTestData  testData từ approved-testcases (snapshot)
     * @param {object} o.confirmedTestData testData tester đã lưu (USER_CONFIRMED)
     * @param {Array}  o.confirmedAssertions automationAssertions TESTER_CONFIRMED
     * @param {object} o.setupRecordingId?  nếu có, dùng recording SETUP này (mặc định latest APPROVED SETUP)
     */
    generate({ workspaceId, testCaseId, approvedTestData = {}, confirmedTestData = {}, confirmedAssertions = [], setupRecordingId = null }) {
        const ws = this.workspace?.get(workspaceId);
        if (!ws) {
            return { ok: false, errorCode: GENERATE_ERRORS.WORKSPACE_NOT_FOUND, reason: "Không tìm thấy workspace." };
        }
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        if (!entry) {
            return { ok: false, errorCode: GENERATE_ERRORS.TESTCASE_NOT_FOUND, reason: "Không tìm thấy testcase trong workspace." };
        }
        // Testcase snapshot (approved) — từ entry workspace + approvedTestData truyền vào.
        const testCase = {
            id: entry.testCaseId,
            testcaseId: entry.testCaseId,
            title: entry.title,
            module: entry.module,
            type: entry.type
        };

        // 1. latest APPROVED TESTCASE recording (đúng testCaseId).
        const tcRecordings = this.store?.allByTestCase(testCaseId) ?? [];
        const testcaseRecording = pickLatestApproved(tcRecordings);
        if (!testcaseRecording) {
            return { ok: false, errorCode: GENERATE_ERRORS.RECORDING_APPROVAL_REQUIRED, reason: "Chưa có recording APPROVED." };
        }
        const testcaseRecordingRaw = this.store?.getRaw(testcaseRecording.recordingId) ?? testcaseRecording;

        // 2. SETUP recording (mặc định latest APPROVED SETUP, hoặc theo setupRecordingId).
        let setupRecording = null;
        if (setupRecordingId) {
            const raw = this.store?.getRaw(setupRecordingId);
            if (raw && raw.status === "APPROVED") setupRecording = raw;
        } else {
            const setups = this.store?.allByTestCase("SETUP") ?? [];
            const approvedSetup = pickLatestApproved(setups);
            if (approvedSetup) setupRecording = this.store?.getRaw(approvedSetup.recordingId) ?? approvedSetup;
        }

        // 3. Gọi Renderer (chỉ render, không ghi file).
        const rendered = renderV3Spec({
            testCase,
            testcaseRecording: testcaseRecordingRaw,
            setupRecording,
            confirmedTestData,
            confirmedAssertions,
            approvedTestData,
            approvedBy: testcaseRecordingRaw.approvedBy ?? null,
            approvedAt: testcaseRecordingRaw.approvedAt ?? null
        });
        if (!rendered.ok) return rendered;

        // 4. Ghi file (Service làm — Renderer không biết filesystem).
        fs.mkdirSync(this.outputDir, { recursive: true });
        const outputPath = path.join(this.outputDir, `${testCaseId}.spec.js`);
        fs.writeFileSync(outputPath, rendered.code, "utf8");

        // 5. Cập nhật Workspace: GENERATED.
        this.workspace.transition(workspaceId, testCaseId, {
            generateStatus: "GENERATED",
            generatedFile: outputPath,
            recordingId: rendered.metadata.recording.id,
            recordingVersion: rendered.metadata.recording.version,
            recordingHash: rendered.metadata.recording.hash
        });

        return {
            ok: true,
            ...rendered,
            outputPath
        };
    }
}
