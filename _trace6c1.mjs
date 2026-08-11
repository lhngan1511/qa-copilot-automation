import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "./src/server/createApp.js";

/* ===== 6C.1 — TRACE các hiện tượng user báo trên code HIỆN TẠI (chưa sửa) ===== */

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "trace6c1-"));
const app = createApp({ repositoryType: "file", dataDir: path.join(tempRoot, "d"), outputDir: path.join(tempRoot, "o"), v3OutputDir: path.join(tempRoot, "out") });
const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const BASE = `http://127.0.0.1:${srv.address().port}/api/automation-v3`;
async function req(m, p, b) {
  const r = await fetch(`${BASE}${p}`, { method: m, headers: b !== undefined ? { "content-type": "application/json" } : {}, body: b !== undefined ? JSON.stringify(b) : undefined });
  let d; try { d = await r.json(); } catch { d = null; }
  return { status: r.status, body: d };
}
const TC = [{ id: "TC001", title: "Đăng nhập hoạt động thành công với dữ liệu hợp lệ", module: "Login", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Người dùng đăng nhập thành công", testData: { fields: {} } }];
const SRC8 = Array.from({ length: 8 }, (_, i) => `await page.getByRole('button', { name: 'B${i + 1}' }).click();`).join("\n");

const c = await req("POST", "/workspaces", { source: "NEW", module: "Login", approvedTestCases: TC });
const wid = c.body.workspaceId;
await req("POST", `/workspaces/${wid}/testcases/TC001/select`);

// R1: fresh — paste 8 steps → confirm action (append)
const st = await req("POST", `/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
const recId = st.body.recordingId;
await req("POST", `/workspaces/${wid}/recordings/stop`, { recordingId: recId, source: SRC8 });
const blk = await req("POST", `/workspaces/${wid}/blocks`, { recordingId: recId, startStep: 1, endStep: 8 });
await req("POST", `/workspaces/${wid}/blocks/${blk.body.blockId}/confirm`);
await req("POST", `/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blk.body.blockId });
let b1 = await req("GET", `/workspaces/${wid}/testcases/TC001/binding`);
console.log("[R1] fresh confirm -> binding items =", b1.body.sequence.length, "| status =", b1.body.sequence.map(s => s.status).join(","));

// R2: confirm LẦN 2 (append — cùng handler) → duplicate?
const blk2 = await req("POST", `/workspaces/${wid}/blocks`, { recordingId: recId, startStep: 2, endStep: 3 });
await req("POST", `/workspaces/${wid}/blocks/${blk2.body.blockId}/confirm`);
await req("POST", `/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blk2.body.blockId });
b1 = await req("GET", `/workspaces/${wid}/testcases/TC001/binding`);
console.log("[R2] confirm lần 2 (append) -> binding items =", b1.body.sequence.length, "(DUPLICATE nếu >1)");

// R3: saveReuse (updateBlock scope REUSABLE) → block quay DRAFT → card 0/1?
await req("PATCH", `/workspaces/${wid}/blocks/${blk.body.blockId}`, { scope: "REUSABLE", label: "Đăng nhập" });
let ws = await req("GET", `/workspaces/${wid}`);
const tc = ws.body.items.find(i => i.testCaseId === "TC001");
console.log("[R3] sau saveReuse -> segments =", JSON.stringify(tc.segments.map(s => ({ label: s.label, status: s.status }))), "| summary =", JSON.stringify(tc.segmentSummary));

// R4: approve recording LẦN 2 (đã APPROVED) → 409?
const st2 = await req("POST", `/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
const rec2 = st2.body.recordingId;
await req("POST", `/workspaces/${wid}/recordings/stop`, { recordingId: rec2, source: SRC8 });
const ap1 = await req("POST", `/workspaces/${wid}/recordings/${rec2}/approve`, { approvedBy: "tester" });
const ap2 = await req("POST", `/workspaces/${wid}/recordings/${rec2}/approve`, { approvedBy: "tester" });
console.log("[R4] approve lần 1 =", ap1.status, "| lần 2 =", ap2.status, "| errorCode =", ap2.body?.errorCode, "| msg =", JSON.stringify(ap2.body?.message));

// R5: "Đăng nhập · Dùng lại · Nháp" từ đâu — workspace có block REUSABLE cũ + append
const st3 = await req("POST", `/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
const rec3 = st3.body.recordingId;
await req("POST", `/workspaces/${wid}/recordings/stop`, { recordingId: rec3, source: SRC8 });
const blkOld = await req("POST", `/workspaces/${wid}/blocks`, { recordingId: rec3, startStep: 1, endStep: 4, scope: "REUSABLE", label: "Đăng nhập" });
await req("POST", `/workspaces/${wid}/blocks/${blkOld.body.blockId}/confirm`);
await req("PATCH", `/workspaces/${wid}/blocks/${blkOld.body.blockId}`, { label: "Đăng nhập" }); // simulate saveReuse → DRAFT
await req("POST", `/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkOld.body.blockId });
const blkNew = await req("POST", `/workspaces/${wid}/blocks`, { recordingId: rec3, startStep: 1, endStep: 8 });
await req("POST", `/workspaces/${wid}/blocks/${blkNew.body.blockId}/confirm`);
await req("POST", `/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkNew.body.blockId });
b1 = await req("GET", `/workspaces/${wid}/testcases/TC001/binding`);
console.log("[R5] workspace có block REUSABLE cũ + append mới -> binding items =", b1.body.sequence.length,
  "|", b1.body.sequence.map(s => `'${s.label || "Bước " + s.startStep + "→" + s.endStep}' (${s.scope}, ${s.status})`).join(" | "));

await new Promise(r => srv.close(r));
fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("TRACE DONE");
