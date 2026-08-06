import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import CurrentRecordingSession, { hashRecording } from "../src/codegen/CurrentRecordingSession.js";
import CodeGenRecordingStore from "../src/codegen/CodeGenRecordingStore.js";
import AutomationWorkspace from "../src/codegen/AutomationWorkspace.js";
import { parseRecording } from "../src/codegen/recordingParser.js";

/* V3 — Bổ sung 6 điểm khóa bước 2 (version/hash/summary/REVIEW/không overwrite/parser action set). */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b2s-"));
const store = new CodeGenRecordingStore({ metadataFile: path.join(dir, "r.json"), scriptsDir: path.join(dir, "s") });
const ws = new AutomationWorkspace({ metadataFile: path.join(dir, "w.json") });
const w = ws.create({ module: "Đăng nhập", testCases: [{ id: "TC001", title: "x", reviewStatus: "APPROVED" }] });
ws.setSelected(w.workspaceId, "TC001", true);

const session = new CurrentRecordingSession({ store, workspace: ws });

const SRC1 = `import { test, expect } from '@playwright/test';
test('TC001', async ({ page }) => {
  await page.goto('http://x/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('ok')).toBeVisible();
});`;
const SRC2 = `import { test, expect } from '@playwright/test';
test('TC001', async ({ page }) => {
  await page.goto('http://x/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill('1222');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Danh mục')).toBeVisible();
});`;

function main() {
    // 1. Record V1 → Stop.
    session.start({ workspaceId: w.workspaceId, testCaseId: "TC001", type: "TESTCASE" });
    const s1 = session.stop({ source: SRC1 });
    assert.equal(s1.recordingVersion, 1, "V1");
    assert.ok(s1.recordingHash && s1.recordingHash.length >= 8, "có hash");
    assert.equal(hashRecording(SRC1), s1.recordingHash, "hash đúng source");
    // summary
    assert.equal(s1.summary.actionCount, 3);
    assert.equal(s1.summary.assertionCount, 1);
    assert.equal(s1.summary.fillCount, 1);
    assert.equal(s1.summary.clickCount, 1);
    assert.equal(s1.summary.navigationCount, 1);
    // REVIEW_REQUIRED (điểm 2) — không Generate ngay sau Record.
    assert.equal(ws.getTestCase(w.workspaceId, "TC001").reviewStatus, "REVIEW_REQUIRED");

    // 5. Record V2 — KHÔNG overwrite V1.
    session.start({ workspaceId: w.workspaceId, testCaseId: "TC001", type: "TESTCASE" });
    const s2 = session.stop({ source: SRC2 });
    assert.equal(s2.recordingVersion, 2, "V2");
    assert.notEqual(s1.recordingHash, s2.recordingHash, "hash khác nhau");
    // store giữ cả 2 recording (không overwrite).
    const all = store.allByTestCase("TC001");
    assert.equal(all.length, 2, "2 recording TC001");
    assert.ok(all.some(r => r.recordingHash === s1.recordingHash), "V1 còn");
    assert.ok(all.some(r => r.recordingHash === s2.recordingHash), "V2 có");

    // 4. Parser chỉ sinh GOTO/CLICK/FILL/CHECK/SELECT/ASSERT — không AUTH/LOGIN/NAVIGATION/BUSINESS.
    const parsed = parseRecording(SRC1);
    const actionTypes = new Set(parsed.steps.map(s => s.actionType));
    const allowed = new Set(["GOTO", "CLICK", "FILL", "CHECK", "SELECT", "ASSERT", "PRESS", "UNCHECK"]);
    for (const t of actionTypes) {
        assert.ok(allowed.has(t), `action ${t} phải nằm trong tập GOTO/CLICK/FILL/CHECK/SELECT/ASSERT`);
    }
    assert.ok(!actionTypes.has("AUTH") && !actionTypes.has("LOGIN") && !actionTypes.has("NAVIGATION") && !actionTypes.has("BUSINESS"), "không sinh AUTH/LOGIN/NAVIGATION/BUSINESS");

    // 6. Renderer bước 3 chỉ nhận Workspace + recording TC001 + approved TC001 — không codegen chung.
    // (điều kiện bắt buộc: recording gắn testCaseId từ start; approved giữ nguyên)
    assert.equal(store.getByTestCase("TC001").testCaseId, "TC001");
    assert.equal("selectedForAutomation" in w.selectedTestCases[0], true, "trạng thái automation ở workspace, không phải approved");

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Recording Session V2 Supplement test: PASS");
}

main();
