import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/*
 Bước 5C — Expected Result → Tester-confirmed Assertion → Generate (wireframe đã duyệt).

 Kiểm chứng:
   1. Expected Result do TESTER sở hữu: bản gốc approved giữ nguyên, bản sửa lưu workspace (working copy).
   2. Đề xuất deterministic (KHÔNG AI): không bịa — expected quá chung → []; có trích dẫn + hiển thị → TEXT_VISIBLE toBeVisible;
      "không hiển thị" → toBeHidden.
   3. Áp dụng đề xuất → DRAFT; gate: chưa có TESTER_CONFIRMED → ASSERTION_CONFIRMATION_REQUIRED + message chuẩn.
   4. Confirm → Generate 200; spec chứa assertion đã xác nhận.
   5. Sửa assertion (PATCH) → quay về DRAFT (giống quyết định segment).
   6. Sửa Expected Result rỗng → quay về bản gốc approved.
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-asrt-"));

const APPROVED = [
    {
        id: "TC001", title: "Đăng nhập thành công", module: "Login", type: "POSITIVE",
        reviewStatus: "APPROVED",
        expectedResult: "Đăng nhập thành công",
        testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "Admin@123", purpose: "VALID" } } }
    }
];

const SRC = `import { test, expect } from '@playwright/test';
test('TC', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('Admin@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByText('Danh mục phần mềm quản lý').click();
});`;

async function startServer(dataDir, v3Out) {
    const app = createApp({ repositoryType: "file", dataDir, outputDir: path.join(dataDir, "o"), v3OutputDir: v3Out });
    return new Promise(resolve => {
        const server = app.listen(0, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
    });
}
function closeServer(server) { return new Promise(r => server.close(r)); }
async function req(baseUrl, method, p, body) {
    const json = body !== undefined;
    const res = await fetch(`${baseUrl}${p}`, {
        method,
        headers: json ? { "content-type": "application/json" } : {},
        body: json ? JSON.stringify(body) : undefined
    });
    let data; try { data = await res.json(); } catch { data = null; }
    return { status: res.status, body: data };
}

async function main() {
    const dataDir = path.join(tempRoot, "data");
    const v3Out = path.join(tempRoot, "out");
    let { server, baseUrl } = await startServer(dataDir, v3Out);

    // ===== 1. Workspace: expectedResult gốc được map vào item =====
    const created = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: APPROVED });
    const wid = created.body.workspaceId;
    let ws = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}`);
    let tc = ws.body.items.find(i => i.testCaseId === "TC001");
    assert.equal(tc.expectedResult, "Đăng nhập thành công", "expectedResult gốc map vào item");
    assert.equal(tc.expectedResultEdited, null, "chưa chỉnh sửa");

    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);

    // Recording + ActionBlocks (6B canonical) — setup kind SETUP + block testcase, bind vào TC001
    const start = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    const recId = start.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: recId, source: SRC });
    const blkSetup = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`, { recordingId: recId, startStep: 1, endStep: 4, kind: "SETUP" });
    const blkTc = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`, { recordingId: recId, startStep: 5, endStep: 5 });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkSetup.body.blockId}/confirm`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkTc.body.blockId}/confirm`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkSetup.body.blockId });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkTc.body.blockId });

    // ===== 2. Đề xuất KHÔNG bịa: expected quá chung → [] =====
    const sug1 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/suggest`);
    assert.equal(sug1.status, 200, "suggest 200");
    assert.equal(sug1.body.expectedResult, "Đăng nhập thành công", "expectedResult hiệu lực");
    assert.equal(sug1.body.suggestions.length, 0, "không bịa khi expected quá chung");

    // ===== 3. Sửa Expected Result (working copy) → đề xuất có TEXT_VISIBLE =====
    const upd = await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/expected-result`,
        { expectedResult: "Đăng nhập thành công và hiển thị 'Danh mục phần mềm quản lý'" });
    assert.equal(upd.status, 200, "update expected 200");
    assert.equal(upd.body.expectedResult, "Đăng nhập thành công và hiển thị 'Danh mục phần mềm quản lý'", "expectedResult edited");
    assert.equal(upd.body.expectedResultOriginal, "Đăng nhập thành công", "bản gốc approved giữ nguyên");

    const sug2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/suggest`);
    assert.equal(sug2.body.suggestions.length, 1, "1 đề xuất");
    const s = sug2.body.suggestions[0];
    assert.equal(s.type, "TEXT_VISIBLE", "TEXT_VISIBLE");
    assert.equal(s.matcher, "toBeVisible", "toBeVisible");
    assert.equal(s.expected, "Danh mục phần mềm quản lý", "expected trích dẫn");
    assert.ok(s.locator.includes("getByText"), "locator getByText");
    assert.equal(s.source, "SYSTEM_SUGGESTED", "nguồn hệ thống (chưa AI)");
    assert.ok(s.reason, "có lý do");

    // ===== 4. Áp dụng → DRAFT; generate chưa được (gate) =====
    const applied = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, { ...s, status: "DRAFT", source: "SYSTEM_SUGGESTED" });
    assert.equal(applied.body.status, "DRAFT", "áp dụng → DRAFT");
    const asrtId = applied.body.id;

    const genDraft = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`);
    assert.equal(genDraft.status, 409, "409 khi chưa xác nhận");
    assert.equal(genDraft.body.errorCode, "ASSERTION_CONFIRMATION_REQUIRED", "gate assertion");
    assert.equal(genDraft.body.message, "Chưa có điều kiện xác nhận phù hợp với kết quả mong đợi.", "message chuẩn");

    // ===== 5. Xác nhận → Generate 200 + spec chứa assertion =====
    const confirm = await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/${asrtId}/confirm`);
    assert.equal(confirm.body.status, "TESTER_CONFIRMED", "confirmed");

    const gen = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(gen.status, 200, "generate 200");
    const code = fs.readFileSync(gen.body.outputPath, "utf8");
    assert.ok(code.includes("toBeVisible"), "spec chứa toBeVisible");
    assert.ok(code.includes("Danh mục phần mềm quản lý"), "spec chứa nội dung kỳ vọng");
    assert.ok(code.includes("page.goto('http://172.16.1.100:9230/wasuco/login')") || code.includes('page.goto("http://172.16.1.100:9230/wasuco/login")'), "setup login có trong spec");

    // ===== 6. Sửa assertion → quay về DRAFT =====
    const updAsrt = await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/${asrtId}`,
        { target: "Danh mục phần mềm quản lý (đã đổi)" });
    assert.equal(updAsrt.body.status, "DRAFT", "sửa → DRAFT");
    assert.equal(updAsrt.body.target, "Danh mục phần mềm quản lý (đã đổi)", "field sửa");
    await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/${asrtId}/confirm`);

    // ===== 7. List assertions =====
    const list = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`);
    assert.equal(list.status, 200, "list 200");
    assert.equal(list.body.length, 1, "1 assertion");
    assert.equal(list.body[0].status, "TESTER_CONFIRMED", "trạng thái confirmed");

    // ===== 8. toBeHidden (không hiển thị) =====
    await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/expected-result`,
        { expectedResult: "Xóa thành công và không hiển thị 'Khách hàng ABC'" });
    const sug3 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/suggest`);
    assert.equal(sug3.body.suggestions[0].matcher, "toBeHidden", "toBeHidden khi 'không hiển thị'");

    // ===== 9. Reset expected (rỗng) → về bản gốc approved =====
    const reset = await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/expected-result`, { expectedResult: "  " });
    assert.equal(reset.body.expectedResult, "Đăng nhập thành công", "rỗng → bản gốc");
    assert.equal(reset.body.expectedResultEdited, null, "edited null");

    await closeServer(server);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 Assertion (5C) test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
