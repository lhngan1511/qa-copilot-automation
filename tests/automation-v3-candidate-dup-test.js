import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0-C RUNTIME BUG — [Xác nhận] candidate "Điều kiện tìm thấy trong bản ghi" → 400.

 Root cause: recordedCandidatesForTestcase trả candidate KHÔNG lọc cái đã tồn tại
 trong automationAssertions -> sau khi Xác nhận (đã lưu), candidate vẫn xuất hiện
 lại -> bấm lần 2 -> saveDraftAssertion duplicate check (P0-C) -> 400
 ASSERTION_DUPLICATE "Điều kiện kiểm tra này đã được thêm.".

 Fix: backend lọc candidate theo identity matcher|locator|expected đã tồn tại
 (không REJECTED); UI lọc client-side + render "Đã thêm"/disabled (defensive).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "canddup-"));
const dataDir = path.join(tempRoot, "d");
const APPROVED = [{ id: "TC001", title: "Thêm đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Thành công", testData: null }];

async function boot() {
    const { default: createApp } = await import("../src/server/createApp.js");
    const app = createApp({ repositoryType: "file", dataDir, outputDir: path.join(tempRoot, "o"), v3OutputDir: path.join(tempRoot, "out") });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b !== undefined ? { "content-type": "application/json" } : {}, body: b !== undefined ? JSON.stringify(b) : undefined });
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, body: d };
    }
    return { srv, req };
}

let { srv, req } = await boot();

// Setup: recording có expect -> LIB block -> bind -> suggest
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('Thành công')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const lib = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm đơn vị tính", startStep: 1, endStep: 2, groupName: "Đơn vị tính" });
assert.equal(lib.body.data.recordedAssertionCount, 1, "setup: block có 1 recorded assertion");
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: lib.body.data.blockId });

// 1. Suggest -> có 1 candidate
const sug1 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/suggest`, {});
assert.equal(sug1.body.recordedCandidates.length, 1, "1: candidate xuất hiện lần đầu");
const cand = sug1.body.recordedCandidates[0];

// 2. Xác nhận candidate -> 200 (lần đầu không 400)
const confirm = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: cand.type, target: cand.target, locator: cand.locator, expected: cand.expected,
    matcher: cand.matcher, source: "RECORDED", status: "TESTER_CONFIRMED"
});
assert.equal(confirm.status, 200, "2: Xác nhận lần đầu 200 (không 400)");

// 3. Suggest lại -> candidate ĐÃ THÊM không còn xuất hiện (fix backend)
const sug2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/suggest`, {});
assert.equal(sug2.body.recordedCandidates.length, 0, "3: candidate đã thêm không xuất hiện lại (không bấm Xác nhận lần 2)");

// 4. Defensive: nếu vẫn cố Xác nhận lần 2 -> 400 ASSERTION_DUPLICATE (không phải 500) — UI đã chặn
const confirm2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: cand.type, target: cand.target, locator: cand.locator, expected: cand.expected,
    matcher: cand.matcher, source: "RECORDED", status: "TESTER_CONFIRMED"
});
assert.equal(confirm2.status, 400, "4: lần 2 vẫn 400 (defensive — UI không cho bấm)");
assert.equal(confirm2.body?.errorCode, "ASSERTION_DUPLICATE", "4: errorCode đúng");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

// Static — UI: lọc client-side + "Đã thêm" disabled
const tabSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ExpectedResultTab.jsx"), "utf8");
const clean = tabSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(clean.includes("alreadyAdded") && clean.includes('{alreadyAdded ? "Đã thêm" : "Xác nhận"}'), "UI: candidate đã thêm -> nút 'Đã thêm' disabled");
assert.ok(clean.includes('!assertions.some(a => a.status !== "REJECTED"'), "UI: lọc client-side theo assertions");

console.log("Automation V3 Candidate Duplicate Fix (P0-C runtime bug) test: PASS");
