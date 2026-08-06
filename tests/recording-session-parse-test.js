import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import CurrentRecordingSession from "../src/codegen/CurrentRecordingSession.js";
import CodeGenRecordingStore from "../src/codegen/CodeGenRecordingStore.js";
import AutomationWorkspace from "../src/codegen/AutomationWorkspace.js";
import { parseRecording, isSensitiveField } from "../src/codegen/recordingParser.js";

/* V3 — Bước 2: Current Recording Session + Parse Recording. */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s2-"));
const store = new CodeGenRecordingStore({
    metadataFile: path.join(dir, "recordings.json"),
    scriptsDir: path.join(dir, "scripts")
});
const ws = new AutomationWorkspace({ metadataFile: path.join(dir, "workspaces.json") });
const w = ws.create({ module: "Đăng nhập", testCases: [
    { id: "TC001", title: "Đăng nhập thành công", module: "Đăng nhập", reviewStatus: "APPROVED" },
    { id: "TC002", title: "Sai mật khẩu", module: "Đăng nhập", reviewStatus: "APPROVED" }
]});

const session = new CurrentRecordingSession({ store, workspace: ws });

const SRC_TC001 = `import { test, expect } from '@playwright/test';
test('TC001 - Đăng nhập thành công', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill('122222');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Danh mục phần mềm quản lý')).toBeVisible();
});`;

function main() {
    // 1. Start TC001 → Stop → testCaseId=TC001, type=TESTCASE.
    ws.setSelected(w.workspaceId, "TC001", true);
    const s1 = session.start({ workspaceId: w.workspaceId, testCaseId: "TC001", type: "TESTCASE", url: "http://172.16.1.100:9230/wasuco/login" });
    assert.equal(s1.status, "RECORDING");
    assert.equal(s1.testCaseId, "TC001");
    assert.equal(s1.type, "TESTCASE");
    assert.equal(session.current()?.id, s1.id, "có 1 active");

    const stopped = session.stop({ source: SRC_TC001 });
    assert.equal(stopped.testCaseId, "TC001", "giữ đúng testCaseId khi Stop");
    assert.equal(stopped.workspaceId, w.workspaceId);
    assert.equal(stopped.status, "PARSED");
    assert.ok(stopped.completedAt, "có completedAt");
    assert.equal(session.current(), null, "không còn active sau Stop");

    // 2. Không thể đổi testCaseId giữa Start và Stop — stop giữ nguyên TC001.
    // (stop không nhận testCaseId param; kiểm tra store vẫn TC001)
    assert.equal(store.getByTestCase("TC001")?.testCaseId, "TC001");

    // 3. Start session thứ hai khi session đang RECORDING → reject.
    session.start({ workspaceId: w.workspaceId, testCaseId: "TC001", type: "TESTCASE" });
    let err = null;
    try { session.start({ workspaceId: w.workspaceId, testCaseId: "TC002", type: "TESTCASE" }); } catch (e) { err = e; }
    assert.equal(err?.code, "RECORDING_ALREADY_ACTIVE", "reject khi 2 recording active");
    // dừng để dọn
    session.stop({ source: "" });

    // 4. SETUP recording lưu type=SETUP (không bắt buộc testCaseId).
    const sSetup = session.start({ workspaceId: w.workspaceId, type: "SETUP", url: "http://x/login" });
    assert.equal(sSetup.type, "SETUP");
    assert.equal(sSetup.testCaseId, "SETUP", "SETUP dùng testCaseId='SETUP'");
    session.stop({ source: "await page.goto('http://x/login');" });
    assert.equal(store.getByTestCase("SETUP")?.type, "SETUP");

    // 5. Parse được goto/fill/click/expect.
    const parsed = parseRecording(SRC_TC001);
    const actions = parsed.steps.map(s => s.actionType);
    assert.ok(actions.includes("GOTO"));
    assert.ok(actions.includes("FILL"));
    assert.ok(actions.includes("CLICK"));
    assert.equal(parsed.assertions.length, 1);
    assert.equal(parsed.assertions[0].matcher, "toBeVisible");

    // 6. Giữ sourceRange + sourceLine.
    const step0 = parsed.steps.find(s => s.actionType === "GOTO");
    assert.ok(step0.sourceStart >= 0 && step0.sourceEnd > step0.sourceStart, "sourceRange hợp lệ");
    assert.ok(step0.sourceLine >= 1, "có sourceLine");
    assert.ok(parsed.assertions[0].sourceLine >= 1);

    // 7. Password recordedValue đánh dấu sensitive/redacted.
    const pw = parsed.steps.find(s => /Mật khẩu/.test(s.target));
    assert.equal(pw.sensitive, true, "password sensitive");
    assert.equal(pw.recordedValue, "REDACTED", "password redacted");
    assert.equal(parsed.recordedValues["Mật khẩu"], "REDACTED");
    assert.equal(isSensitiveField("Mật khẩu"), true);
    // Giá trị không nhạy cảm (Tài khoản) giữ literal
    const user = parsed.steps.find(s => /Tài khoản/.test(s.target));
    assert.equal(user.sensitive, false);
    assert.equal(user.recordedValue, "admin");

    // 8. getByTestCase(TC001) trả đúng recording (sau khi đã stop).
    const rec001 = store.getByTestCase("TC001");
    assert.equal(rec001?.testCaseId, "TC001");
    assert.equal(rec001?.status, "RECORDED");
    assert.ok(rec001?.steps.length > 0, "recording có steps");

    // 9. approved-testcases.json không thay đổi — workspace/recording lưu file riêng.
    assert.equal(fs.existsSync(path.join(dir, "workspaces.json")), true);
    assert.equal(fs.existsSync(path.join(dir, "recordings.json")), true);
    // (không có approved file nào được tạo/sửa trong dir)

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Recording Session + Parse test: PASS");
}

main();
