import crypto from "node:crypto";
import { parseRecording, buildSummary } from "./recordingParser.js";

/*
 CurrentRecordingSession — quản lý "Current Recording" trong 1 workspace (Architecture V3).

 Contract:
   CurrentRecordingSession {
     id, workspaceId, testCaseId, type, status: IDLE|RECORDING|STOPPED|PARSED|FAILED,
     startedAt, completedAt, source, steps, assertions, recordedValues,
     recordingId, recordingVersion, recordingHash, summary
   }

 Quy tắc:
   - Một thời điểm chỉ MỘT recording đang hoạt động trong workspace.
   - Start mới khi session khác đang RECORDING → RECORDING_ALREADY_ACTIVE.
   - TESTCASE có thể CHƯA gán testCaseId (5C-0: mapping ở mức Segment — 1 bản ghi dài phục vụ nhiều testcase).
   - Stop giữ đúng workspaceId/testCaseId gắn lúc Start; KHÔNG đổi testCaseId giữa Start/Stop.
   - Không tự map recording sang testcase khác. Không dùng AI.
   - Không sửa approved-testcases.json.
   - Không log password / dữ liệu nhạy cảm (parser redacts).
   - Mỗi lần Record tạo recording MỚI (không overwrite) — recordingVersion tăng dần.
   - Parser chỉ sinh GOTO/CLICK/FILL/CHECK/SELECT/ASSERT (không AUTH/LOGIN/NAVIGATION/BUSINESS —
     phân loại để Renderer/Workflow quyết định).
*/

export const SESSION_STATUS = {
    IDLE: "IDLE",
    RECORDING: "RECORDING",
    STOPPED: "STOPPED",
    PARSED: "PARSED",
    FAILED: "FAILED"
};

function newSessionId() {
    return `SES-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Tính hash an toàn của source recording (không phải hash của password riêng). */
export function hashRecording(source) {
    return crypto.createHash("sha256").update(String(source ?? "")).digest("hex").slice(0, 16);
}

export default class CurrentRecordingSession {
    constructor({ store = null, workspace = null } = {}) {
        this.store = store;      // CodeGenRecordingStore (lưu recording)
        this.workspace = workspace; // AutomationWorkspace (lưu trạng thái)
        this.active = null;      // session đang RECORDING
    }

    /**
     * Start recording cho testcase (TESTCASE) hoặc setup chung (SETUP).
     */
    start({ workspaceId, testCaseId = null, type = "TESTCASE", url = "", browser = "chrome", projectId = null }) {
        if (this.active) {
            const err = new Error("Đã có recording đang hoạt động trong workspace.");
            err.code = "RECORDING_ALREADY_ACTIVE";
            throw err;
        }
        const sessionType = String(type ?? "TESTCASE").toUpperCase() === "SETUP" ? "SETUP" : "TESTCASE";
        // 5C-0: TESTCASE KHÔNG bắt buộc testCaseId — 1 bản ghi dài có thể gán nhiều testcase qua Segment.
        const session = {
            id: newSessionId(),
            workspaceId,
            testCaseId: sessionType === "SETUP" ? (testCaseId ?? "SETUP") : (testCaseId ?? null),
            type: sessionType,
            status: SESSION_STATUS.RECORDING,
            startedAt: new Date().toISOString(),
            completedAt: null,
            source: "",
            steps: [],
            assertions: [],
            recordedValues: {},
            recordingId: null,
            recordingVersion: null,
            recordingHash: null,
            summary: null
        };
        this.active = session;

        // Lưu recording vào store (gắn workspaceId/testCaseId/type); giữ recordingId để stop update ĐÚNG.
        if (this.store) {
            const rec = this.store.create({
                workspaceId,
                projectId,
                testCaseId: session.testCaseId,
                type: sessionType,
                url,
                browser
            });
            session.recordingId = rec?.recordingId ?? null;
            // recordingVersion = số recording đã có của testcase này + 1 (không overwrite).
            session.recordingVersion = this.store.countByTestCase(session.testCaseId);
        }
        return session;
    }

    /**
     * Stop recording — parse source (nếu có) thành steps/assertions/recordedValues.
     * Giữ đúng workspaceId/testCaseId gắn lúc Start; không đổi testCaseId.
     */
    stop({ source = "" } = {}) {
        if (!this.active) {
            const err = new Error("Không có recording đang hoạt động.");
            err.code = "NO_ACTIVE_RECORDING";
            throw err;
        }
        const session = this.active;
        session.completedAt = new Date().toISOString();
        session.source = String(source ?? "");

        // Hash recording (điểm 1) — để nhận diện version.
        session.recordingHash = hashRecording(session.source);

        // Parse recording nếu có source.
        if (session.source.trim()) {
            try {
                const parsed = parseRecording(session.source);
                session.steps = parsed.steps;
                session.assertions = parsed.assertions;
                session.recordedValues = parsed.recordedValues;
                session.summary = {
                    ...parsed.summary,
                    duration: session.startedAt && session.completedAt
                        ? Math.max(0, Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 1000))
                        : null
                };
                session.status = SESSION_STATUS.PARSED;
            } catch (error) {
                session.status = SESSION_STATUS.FAILED;
                session.parseError = error?.message ?? "Parse recording thất bại.";
            }
        } else {
            session.status = SESSION_STATUS.STOPPED;
        }

        // Cập nhật ĐÚNG recording đã tạo ở start (không dùng getByTestCase — tránh ghi nhầm recording khác).
        if (this.store && session.recordingId) {
            this.store.update(session.recordingId, {
                status: session.status === "PARSED" ? "RECORDED" : "STOPPED",
                completedAt: session.completedAt,
                scriptContent: session.source,
                steps: session.steps,
                assertions: session.assertions,
                recordedValues: session.recordedValues,
                recordingVersion: session.recordingVersion,
                recordingHash: session.recordingHash,
                summary: session.summary
            });
        }
        // Cập nhật trạng thái workspace: RECORDED → REVIEW_REQUIRED (điểm 2: Review nằm giữa Record và Generate).
        if (this.workspace && session.testCaseId && session.testCaseId !== "SETUP") {
            this.workspace.transition(session.workspaceId, session.testCaseId, {
                recordingStatus: "RECORDED",
                reviewStatus: "REVIEW_REQUIRED"
            });
        }
        this.active = null;
        return session;
    }

    /** Session đang hoạt động (RECORDING) — để UI hiển thị "Đang ghi TC..." */
    current() {
        return this.active;
    }
}
