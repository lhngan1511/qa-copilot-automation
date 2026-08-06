import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspace, { TESTCASE_STATUS } from "../src/codegen/AutomationWorkspace.js";

/* V3 — AutomationWorkspace "bộ não": tách trạng thái automation khỏi approved-testcases. */

const approved = [
    { id: "TC001", title: "Đăng nhập thành công", module: "Đăng nhập", type: "POSITIVE", reviewStatus: "APPROVED" },
    { id: "TC005", title: "Sai mật khẩu", module: "Đăng nhập", type: "NEGATIVE", reviewStatus: "APPROVED" },
    { id: "TC002", title: "Bỏ trống tài khoản", module: "Đăng nhập", type: "NEGATIVE", reviewStatus: "APPROVED" }
];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-"));
const ws = new AutomationWorkspace({ metadataFile: path.join(dir, "workspaces.json") });

// 1. Tạo workspace từ approved (mode NEW) — approved-testcases không bị đụng.
const w = ws.create({ mode: "NEW", module: "Đăng nhập", testCases: approved });
assert.ok(w.workspaceId.startsWith("WS-"), "có workspaceId");
assert.equal(w.selectedTestCases.length, 3);

// 2. Chọn TC001 → selectedForAutomation=true, reviewStatus=SELECTED.
const sel = ws.setSelected(w.workspaceId, "TC001", true);
assert.equal(sel.selectedForAutomation, true);
assert.equal(sel.reviewStatus, "SELECTED");
assert.equal(sel.recordingStatus, "NOT_RECORDED", "chưa record");

// 3. Bỏ chọn → reset automation state.
ws.setSelected(w.workspaceId, "TC001", false);
const unsel = ws.getTestCase(w.workspaceId, "TC001");
assert.equal(unsel.selectedForAutomation, false);
assert.equal(unsel.reviewStatus, "NOT_SELECTED");

// 4. Chọn lại + chuyển trạng thái theo vòng đời V3.
ws.setSelected(w.workspaceId, "TC001", true);
ws.transition(w.workspaceId, "TC001", { recordingStatus: "RECORDED", reviewStatus: "UNDER_REVIEW" });
ws.transition(w.workspaceId, "TC001", { reviewStatus: "APPROVED" });
ws.transition(w.workspaceId, "TC001", { generateStatus: "GENERATED", generatedFile: "outputs/generated-tests/TC001.spec.js" });
ws.transition(w.workspaceId, "TC001", { runStatus: "RUNNING" });
ws.transition(w.workspaceId, "TC001", { runStatus: "PASS", lastRun: "PASS" });
const finalTc = ws.getTestCase(w.workspaceId, "TC001");
assert.equal(finalTc.reviewStatus, "APPROVED");
assert.equal(finalTc.generateStatus, "GENERATED");
assert.equal(finalTc.runStatus, "PASS");
assert.equal(finalTc.lastRun, "PASS");

// 5. Lưu automationAssertions (tách khỏi expectedResult).
const assertions = [
    { id: "asrt-1", testCaseId: "TC001", type: "URL", expected: "http://x/", matcher: "toHaveURL", source: "TESTER_INPUT", status: "TESTER_CONFIRMED" }
];
ws.saveAssertions(w.workspaceId, "TC001", assertions);
assert.equal(ws.getTestCase(w.workspaceId, "TC001").automationAssertions.length, 1);

// 6. approved-testcases gốc không bị sửa (không có trường automation).
assert.equal("selectedForAutomation" in approved[0], false, "approved KHÔNG có trạng thái automation");
assert.equal("recordingStatus" in approved[0], false);

// 7. List workspace.
assert.equal(ws.list().length, 1);
assert.equal(ws.list()[0].selectedCount, 3);

fs.rmSync(dir, { recursive: true, force: true });
console.log("Automation Workspace test: PASS");
