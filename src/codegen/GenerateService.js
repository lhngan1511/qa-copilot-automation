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
    WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
    // 5C-0 — Record Mapping (tester-owned, không AI, không theo thứ tự).
    RECORDING_MAPPING_REQUIRED: "RECORDING_MAPPING_REQUIRED",
    SEGMENT_NOT_CONFIRMED: "SEGMENT_NOT_CONFIRMED",
    SEGMENT_MAPPING_INVALID: "SEGMENT_MAPPING_INVALID"
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
     * @param {object} o.setupRecordingId?  nếu có, dùng recording SETUP này (mặc định: SETUP segments của các recording liên quan)
     * @param {Array}  o.segments?          refs [{segmentId, recordingId, orderInTestCase}] từ Workspace (5C-0)
     */
    generate({ workspaceId, testCaseId, approvedTestData = {}, confirmedTestData = {}, confirmedAssertions = [], setupRecordingId = null, segments = null }) {
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

        let rendered;
        if (Array.isArray(segments) && segments.length > 0 && segments[0]?.blockId) {
            // ===== 6B — ActionBlock flow (CANONICAL): snapshot steps từ workspace blocks, theo thứ tự binding =====
            const resolved = this.resolveBlockFlow({ workspaceId, testCaseId, segments });
            if (!resolved.ok) return resolved;
            rendered = renderV3Spec({
                testCase,
                testcaseRecording: resolved.mainRecording,
                setupRecording: null, // block SETUP nằm trong sequence như tester sắp (không tự reorder)
                confirmedTestData,
                confirmedAssertions,
                approvedTestData,
                approvedBy: resolved.mainRecording.approvedBy ?? null,
                approvedAt: resolved.mainRecording.approvedAt ?? null
            });
            if (rendered.ok) {
                rendered.metadata = { ...rendered.metadata, segments: resolved.traceSegments };
            }
        } else if (Array.isArray(segments) && segments.length > 0) {
            // ===== 5C-0 — Segment flow (legacy compatibility): steps ghép theo thứ tự tester xác nhận =====
            const resolved = this.resolveSegmentFlow({ testCaseId, segments, setupRecordingId });
            if (!resolved.ok) return resolved;
            rendered = renderV3Spec({
                testCase,
                testcaseRecording: resolved.mainRecording,
                setupRecording: null, // steps SETUP đã ghép sẵn trong mainRecording.steps
                confirmedTestData,
                confirmedAssertions,
                approvedTestData,
                approvedBy: resolved.mainRecording.approvedBy ?? null,
                approvedAt: resolved.mainRecording.approvedAt ?? null
            });
            if (rendered.ok) {
                rendered.metadata = { ...rendered.metadata, segments: resolved.traceSegments };
            }
        } else {
            // ===== Legacy 5B flow (tương thích dữ liệu cũ: recording gắn thẳng testCaseId) =====
            const tcRecordings = this.store?.allByTestCase(testCaseId) ?? [];
            const testcaseRecording = pickLatestApproved(tcRecordings);
            if (!testcaseRecording) {
                return { ok: false, errorCode: GENERATE_ERRORS.RECORDING_MAPPING_REQUIRED, reason: "Không có bản ghi thao tác cho testcase này." };
            }
            const raw = this.store?.getRaw(testcaseRecording.recordingId) ?? testcaseRecording;
            let setupRecording = null;
            if (setupRecordingId) {
                const r = this.store?.getRaw(setupRecordingId);
                if (r && r.status === "APPROVED") setupRecording = r;
            } else {
                const setups = this.store?.allByTestCase("SETUP") ?? [];
                const approvedSetup = pickLatestApproved(setups);
                if (approvedSetup) setupRecording = this.store?.getRaw(approvedSetup.recordingId) ?? approvedSetup;
            }
            rendered = renderV3Spec({
                testCase,
                testcaseRecording: raw,
                setupRecording,
                confirmedTestData,
                confirmedAssertions,
                approvedTestData,
                approvedBy: raw.approvedBy ?? null,
                approvedAt: raw.approvedAt ?? null
            });
        }
        if (!rendered.ok) return rendered;

        // Ghi file (Service làm — Renderer không biết filesystem).
        fs.mkdirSync(this.outputDir, { recursive: true });
        const outputPath = path.join(this.outputDir, `${testCaseId}.spec.js`);
        fs.writeFileSync(outputPath, rendered.code, "utf8");

        // Cập nhật Workspace: GENERATED.
        this.workspace.transition(workspaceId, testCaseId, {
            generateStatus: "GENERATED",
            generatedFile: outputPath,
            recordingId: rendered.metadata.recording?.id ?? null,
            recordingVersion: rendered.metadata.recording?.version ?? null,
            recordingHash: rendered.metadata.recording?.hash ?? null
        });

        return {
            ok: true,
            ...rendered,
            outputPath
        };
    }

    /**
     * 6B — Ghép steps từ ActionBlock SNAPSHOT (workspace), theo đúng thứ tự binding (order).
     * KHÔNG đọc live recording — block giữ snapshot; sourceRecordingId chỉ để traceability.
     */
    resolveBlockFlow({ workspaceId, testCaseId, segments }) {
        const refs = segments.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const steps = [];
        const traceSegments = [];
        let baseBlock = null;
        for (const ref of refs) {
            const block = this.workspace?.getActionBlock(workspaceId, ref.blockId) ?? null;
            if (!block) {
                return { ok: false, errorCode: GENERATE_ERRORS.SEGMENT_MAPPING_INVALID, reason: "Chưa xác định đầy đủ đoạn thao tác cho testcase." };
            }
            if (block.status !== "CONFIRMED") {
                return { ok: false, errorCode: GENERATE_ERRORS.SEGMENT_NOT_CONFIRMED, reason: "Bản ghi thao tác chưa được xác nhận." };
            }
            steps.push(...(block.steps ?? []).map(s => ({ ...s }))); // snapshot — copy
            traceSegments.push({
                segmentId: block.blockId,
                recordingId: block.sourceRecordingId ?? null,
                startStep: block.sourceRange?.startStep ?? null,
                endStep: block.sourceRange?.endStep ?? null,
                type: block.kind,
                testCaseId
            });
            if (!baseBlock) baseBlock = block;
        }
        if (!baseBlock) {
            return { ok: false, errorCode: GENERATE_ERRORS.SEGMENT_MAPPING_INVALID, reason: "Chưa xác định đầy đủ đoạn thao tác cho testcase." };
        }
        // Pseudo recording APPROVED: renderer chỉ render theo steps; snapshot không cần hash recording.
        const mainRecording = {
            status: "APPROVED",
            recordingId: baseBlock.sourceRecordingId ?? "BLOCK",
            steps
        };
        return { ok: true, mainRecording, traceSegments };
    }

    /**
     * 5C-0 — Ghép steps từ các segment CONFIRMED theo đúng thứ tự tester (orderInTestCase).
     * Không AI, không theo thứ tự JSON/recording. Trả recording view đã ghép (status APPROVED để qua renderer).
     */
    resolveSegmentFlow({ testCaseId, segments, setupRecordingId = null }) {
        const refs = segments.slice().sort((a, b) => (a.orderInTestCase || 0) - (b.orderInTestCase || 0));
        const testcaseSteps = [];
        const traceSegments = [];
        let baseRaw = null;

        for (const ref of refs) {
            const seg = this.store?.getSegment(ref.recordingId, ref.segmentId) ?? null;
            if (!seg || seg.type !== "TESTCASE" || seg.testCaseId !== testCaseId) {
                return { ok: false, errorCode: GENERATE_ERRORS.SEGMENT_MAPPING_INVALID, reason: "Chưa xác định đầy đủ đoạn thao tác cho testcase." };
            }
            if (seg.status !== "CONFIRMED") {
                return { ok: false, errorCode: GENERATE_ERRORS.SEGMENT_NOT_CONFIRMED, reason: "Bản ghi thao tác chưa được xác nhận." };
            }
            const raw = this.store?.getRaw(ref.recordingId) ?? null;
            if (!raw) {
                return { ok: false, errorCode: GENERATE_ERRORS.SEGMENT_MAPPING_INVALID, reason: "Chưa xác định đầy đủ đoạn thao tác cho testcase." };
            }
            testcaseSteps.push(...this.sliceSteps(raw.steps, seg.startStep, seg.endStep));
            traceSegments.push({
                segmentId: seg.segmentId,
                recordingId: raw.recordingId,
                startStep: seg.startStep,
                endStep: seg.endStep,
                type: seg.type,
                testCaseId: seg.testCaseId
            });
            if (!baseRaw) baseRaw = raw;
        }
        if (!baseRaw) {
            return { ok: false, errorCode: GENERATE_ERRORS.SEGMENT_MAPPING_INVALID, reason: "Chưa xác định đầy đủ đoạn thao tác cho testcase." };
        }

        // SETUP dùng chung: segment SETUP CONFIRMED trong chính các recording mà testcase đang dùng
        // (hoặc chỉ recording setupRecordingId nếu được truyền). Không bắt testcase chứa lại login/navigation.
        const setupSteps = [];
        if (setupRecordingId) {
            const raw = this.store?.getRaw(setupRecordingId);
            if (raw) setupSteps.push(...this.setupStepsFrom(raw));
        } else {
            const seen = new Set();
            for (const ref of refs) {
                if (seen.has(ref.recordingId)) continue;
                seen.add(ref.recordingId);
                const raw = this.store?.getRaw(ref.recordingId);
                if (raw) setupSteps.push(...this.setupStepsFrom(raw));
            }
        }

        // Pseudo recording APPROVED: renderer chỉ render theo steps; hash xác nhận source không đổi.
        const mainRecording = {
            ...baseRaw,
            status: "APPROVED",
            steps: [...setupSteps, ...testcaseSteps]
        };
        return { ok: true, mainRecording, traceSegments };
    }

    /** Steps thuộc khoảng order [startStep..endStep] của recording. */
    sliceSteps(steps, startStep, endStep) {
        return (Array.isArray(steps) ? steps : [])
            .filter(s => Number.isInteger(s?.order) && s.order >= startStep && s.order <= endStep);
    }

    /** Các step của segment SETUP CONFIRMED trong 1 recording (theo thứ tự startStep). */
    setupStepsFrom(raw) {
        const segs = (raw?.segments ?? [])
            .filter(s => s.type === "SETUP" && s.status === "CONFIRMED")
            .sort((a, b) => a.startStep - b.startStep);
        const steps = [];
        for (const seg of segs) {
            steps.push(...this.sliceSteps(raw.steps, seg.startStep, seg.endStep));
        }
        return steps;
    }
}
