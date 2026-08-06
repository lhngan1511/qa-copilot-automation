import crypto from "node:crypto";
import { parseRecording } from "./recordingParser.js";

/*
 CurrentRecordingSession — quản lý "Current Recording" trong 1 workspace (Architecture V3).

 Contract:
   CurrentRecordingSession {
     id, workspaceId, testCaseId, type, status: IDLE|RECORDING|STOPPED|PARSED|FAILED,
     startedAt, completedAt, source, steps, assertions, recordedValues
   }

 Quy tắc:
   - Một thời điểm chỉ MỘT recording đang hoạt động trong workspace.
   - Start mới khi session khác đang RECORDING → RECORDING_ALREADY_ACTIVE.
   - TESTCASE bắt buộc có testCaseId; SETUP không bắt buộc.
   - Stop giữ đúng workspaceId/testCaseId gắn lúc Start; KHÔNG đổi testCaseId giữa Start/Stop.
   - Không tự map recording sang testcase khác. Không dùng AI.
   - Không sửa approved-testcases.json.
   - Không log password / dữ liệu nhạy cảm (parser redacts).
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

export default class CurrentRecordingSession {
    constructor({ store = null, workspace = null } = {}) {
        this.store = store;      // CodeGenRecordingStore (lưu recording)
        this.workspace = workspace; // AutomationWorkspace (lưu trạng thái)
        this.active = null;      // session đang RECORDING
    }

    /**
     * Start recording cho testcase (TESTCASE) hoặc setup chung (SETUP).
     */
    start({ workspaceId, testCaseId = null, type = "TESTCASE", url = "", browser = "chrome" }) {
        if (this.active) {
            const err = new Error("Đã có recording đang hoạt động trong workspace.");
            err.code = "RECORDING_ALREADY_ACTIVE";
            throw err;
        }
        const sessionType = String(type ?? "TESTCASE").toUpperCase() === "SETUP" ? "SETUP" : "TESTCASE";
        // TESTCASE bắt buộc có testCaseId.
        if (sessionType === "TESTCASE" && !testCaseId) {
            const err = new Error("TESTCASE recording bắt buộc có testCaseId.");
            err.code = "TESTCASE_ID_REQUIRED";
            throw err;
        }
        const session = {
            id: newSessionId(),
            workspaceId,
            testCaseId: sessionType === "SETUP" ? (testCaseId ?? "SETUP") : testCaseId,
            type: sessionType,
            status: SESSION_STATUS.RECORDING,
            startedAt: new Date().toISOString(),
            completedAt: null,
            source: "",
            steps: [],
            assertions: [],
            recordedValues: {},
            recordingId: null
        };
        this.active = session;

        // Lưu recording vào store (gắn workspaceId/testCaseId/type); giữ recordingId để stop update ĐÚNG.
        if (this.store) {
            const rec = this.store.create({
                workspaceId,
                testCaseId: session.testCaseId,
                type: sessionType,
                url,
                browser
            });
            session.recordingId = rec?.recordingId ?? null;
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

        // Parse recording nếu có source.
        if (session.source.trim()) {
            try {
                const parsed = parseRecording(session.source);
                session.steps = parsed.steps;
                session.assertions = parsed.assertions;
                session.recordedValues = parsed.recordedValues;
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
                recordedValues: session.recordedValues
            });
        }
        // Cập nhật trạng thái workspace: RECORDED.
        if (this.workspace && session.testCaseId && session.testCaseId !== "SETUP") {
            this.workspace.transition(session.workspaceId, session.testCaseId, {
                recordingStatus: "RECORDED",
                reviewStatus: "RECORDED"
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
