import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createApp from "../src/server/createApp.js";

/*
 Bước 5B — Backend API Recording (detail / source / delete + list summary).
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-rec-"));

const APPROVED = [
    {
        id: "TC001", title: "Đăng nhập thành công", module: "Login", type: "POSITIVE",
        reviewStatus: "APPROVED",
        testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "Admin@123", purpose: "VALID" } } }
    },
    {
        id: "TC002", title: "Đổi mật khẩu", module: "Login", type: "POSITIVE",
        reviewStatus: "APPROVED",
        testData: { fields: {} }
    }
];

const SRC = `import { test, expect } from '@playwright/test';
test('TC001', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('Admin@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Danh mục phần mềm quản lý')).toBeVisible();
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

    const created = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: APPROVED });
    const wid = created.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);

    // start → stop
    const start = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { testCaseId: "TC001", type: "TESTCASE" });
    const recId = start.body.recordingId;
    const stop = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: recId, source: SRC });
    assert.equal(stop.body.status, "RECORDED", "stop RECORDED");
    assert.equal(stop.body.testCaseId, "TC001", "giữ testCaseId");

    // list → summary shape, không steps/source
    const list = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/recordings`);
    const item = list.body[0];
    assert.equal(item.recordingId, recId);
    assert.equal(item.version, 1);
    assert.equal(item.status, "RECORDED");
    assert.ok(item.summary && item.summary.actionCount > 0, "summary.actionCount");
    assert.equal(typeof item.summary.assertionCount, "number", "summary.assertionCount");
    assert.ok(!("steps" in item) && !("source" in item) && !("scriptContent" in item), "list không trả steps/source");

    // detail → có steps, không source
    const detail = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/recordings/${recId}`);
    assert.equal(detail.body.recordingId, recId);
    assert.ok(Array.isArray(detail.body.steps) && detail.body.steps.length > 0, "detail có steps");
    assert.ok(!("source" in detail.body) && !("scriptContent" in detail.body), "detail không trả source");
    assert.ok(!detail.body.steps.some(s => "sourceStart" in s), "step không lộ sourceRange");

    // source → tải riêng khi "Xem mã"
    const src = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/source`);
    assert.ok(src.body.source.includes("page.goto"), "source có code");

    // approve
    const approve = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/approve`, { approvedBy: "tester" });
    assert.equal(approve.body.status, "APPROVED", "approve");

    // delete APPROVED → từ chối
    const delApproved = await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/recordings/${recId}`);
    assert.equal(delApproved.status, 409, "409 delete approved");
    assert.equal(delApproved.body.errorCode, "RECORDING_DELETE_FORBIDDEN", "delete forbidden");

    // recording mới REVIEW_REQUIRED → delete được
    const start2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { testCaseId: "TC001", type: "TESTCASE" });
    const rec2 = start2.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: rec2, source: SRC });
    const delReview = await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/recordings/${rec2}`);
    assert.equal(delReview.body.deleted, true, "delete review ok");

    await closeServer(server);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 Recording API test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
