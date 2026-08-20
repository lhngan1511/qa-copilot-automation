import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 EDIT/DELETE — Action Library Viewer (composition edit + delete guard + stale).

 PHẦN A — step grid 5 cột (STT|Loại|Thao tác|Giá trị bản ghi|Technical) thẳng hàng.
 PHẦN B — header [Chỉnh sửa][Xóa] + warning used.
 PHẦN C — edit: rename / group / include-exclude step / recorded value (KHÔNG raw Playwright) → PATCH
          /codegen/library/:id (updateBlock + confirm; content change → version++ + hash mới).
 PHẦN D — delete: used > 0 → BLOCK 409 LIBRARY_IN_USE (không phá workspace); unused → 200.
 PHẦN E — shared Library duy nhất (CodeGen + Automation cùng nguồn).
 PHẦN F — fingerprint gồm content (label|version|hash): content change → testcase stale
          → Run bị chặn → bắt Generate lại (KHÔNG workaround remove/re-add).

 Acceptance A1-A14.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "libedit-"));

async function boot() {
    const { default: createApp } = await import("../src/server/createApp.js");
    const app = createApp({ repositoryType: "file", dataDir: path.join(tempRoot, "d"), outputDir: path.join(tempRoot, "o"), v3OutputDir: path.join(tempRoot, "out") });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b !== undefined ? { "content-type": "application/json" } : {}, body: b !== undefined ? JSON.stringify(b) : undefined });
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, body: d };
    }
    return { srv, req };
}

const { srv, req } = await boot();

// Setup: recording → 2 actions (Đăng nhập dùng được; Tìm kiếm KHÔNG dùng — để test delete)
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.goto('http://x/danh-muc');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const libLogin = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 4, groupName: "Đăng nhập" });
const libOpen = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Mở danh mục", startStep: 5, endStep: 5, groupName: "Danh mục đơn vị tính" });
const libSearch = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Tìm kiếm đơn vị tính", startStep: 6, endStep: 8, groupName: "Danh mục đơn vị tính" });
const loginBlockId = libLogin.body.data.blockId;
const openBlockId = libOpen.body.data.blockId;
const searchBlockId = libSearch.body.data.blockId;

// Workspace + testcase dùng Đăng nhập (để test delete used block)
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "ĐVT", approvedTestCases: [
    { id: "TC001", title: "Tìm kiếm", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: { fields: { "Từ khóa tìm kiếm": { value: "Bản" } } } }
] });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: loginBlockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: searchBlockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
    expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
});
// Generate để có fingerprint + artifact
const gen = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(gen.status, 200, "setup: generate 200");

// ===== A7/A10 — DELETE used Action → BLOCK 409 LIBRARY_IN_USE (an toàn, không phá workspace) =====
const delUsed = await req("DELETE", `/api/codegen/library/${encodeURIComponent(loginBlockId)}`);
assert.equal(delUsed.status, 409, "A10: delete used action -> 409 block");
assert.equal(delUsed.body?.error?.code ?? delUsed.body?.errorCode, "LIBRARY_IN_USE", "A10: errorCode LIBRARY_IN_USE");
assert.ok(String(delUsed.body?.error?.message ?? delUsed.body?.message ?? "").includes("1 testcase"), "A10: message nói rõ N testcase");
const listAfterBlock = (await req("GET", "/api/codegen/library")).body?.data ?? [];
assert.ok(listAfterBlock.some(b => b.blockId === loginBlockId), "A10: action vẫn còn (block không xóa)");

// ===== A9 — DELETE unused Action (Mở danh mục — không bind) → 200 + list giảm =====
const delUnused = await req("DELETE", `/api/codegen/library/${encodeURIComponent(openBlockId)}`);
assert.equal(delUnused.status, 200, "A9: delete unused action -> 200");
const listAfterDel = (await req("GET", "/api/codegen/library")).body?.data ?? [];
assert.ok(!listAfterDel.some(b => b.blockId === openBlockId), "A9: action biến mất khỏi Library");

// ===== A11 — shared Library: Automation workspace list cũng hết open action =====
const autoList = await req("GET", `/api/automation-v3/workspaces/${wid}/library`);
const autoBlocks = Array.isArray(autoList.body) ? autoList.body : (autoList.body?.data ?? []);
assert.ok(!autoBlocks.some(b => b.blockId === openBlockId), "A11: CodeGen + Automation CÙNG nguồn (open đã xóa ở cả 2)");

// ===== A5 — EDIT rename/group persist =====
const upd = await req("PATCH", `/api/codegen/library/${encodeURIComponent(loginBlockId)}`, { label: "Đăng nhập hệ thống", groupName: "Bảo mật" });
assert.equal(upd.status, 200, "A5: PATCH rename/group 200");
assert.equal(upd.body?.data?.label, "Đăng nhập hệ thống", "A5: label mới");
assert.equal(upd.body?.data?.groupName, "Bảo mật", "A5: group mới");
const listAfterEdit = (await req("GET", "/api/codegen/library")).body?.data ?? [];
const edited = listAfterEdit.find(b => b.blockId === loginBlockId);
assert.equal(edited.label, "Đăng nhập hệ thống", "A5: persist sau reload (GET)");
assert.equal(edited.groupName, "Bảo mật", "A5: group persist");

// ===== A6/A8 — EDIT content (include-exclude step) → Library đổi + fingerprint đổi → stale =====
const blockBefore = (await req("GET", "/api/codegen/library")).body?.data.find(b => b.blockId === loginBlockId);
const stepsBefore = blockBefore.steps;
const stepCountBefore = stepsBefore.length;
// Bỏ step cuối (CLICK Đăng nhập) khỏi Action
const keptSteps = stepsBefore.slice(0, -1);
const updContent = await req("PATCH", `/api/codegen/library/${encodeURIComponent(loginBlockId)}`, { steps: keptSteps });
assert.equal(updContent.status, 200, "A6: PATCH steps 200");
const blockAfter = (await req("GET", "/api/codegen/library")).body?.data.find(b => b.blockId === loginBlockId);
assert.equal(blockAfter.stepCount, stepCountBefore - 1, "A6: step include-exclude persist vào shared Library");
assert.notEqual(blockAfter.hash, blockBefore.hash, "A6/F: hash đổi (content change)");
assert.ok(blockAfter.version >= blockBefore.version + 1, "A6/F: version++ khi content change");
// A8 — testcase đang dùng action → stale (fingerprint gồm hash/version)
const item = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
const runStale = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/run`, {});
assert.equal(runStale.status, 409, "A8: content change -> run stale (409)");
assert.equal(runStale.body?.errorCode, "STALE_GENERATED", "A8: STALE_GENERATED (không workaround remove/re-add)");
// Generate lại → code phản ánh steps mới (bớt 1 step Login)
const gen2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(gen2.status, 200, "A8: generate lại 200");
const code2 = gen2.body?.code ?? "";
assert.ok(!code2.includes("name: 'Đăng nhập'"), "A8: step bị loại khỏi Action KHÔNG còn trong spec");

// ===== A13 — Action picker vẫn hoạt động sau edit =====
const ws2 = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "ĐVT", approvedTestCases: [
    { id: "TC002", title: "Login", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: { fields: {} } }
] });
const wid2 = ws2.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/select`);
const bind2 = await req("POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/library/blocks`, { blockId: loginBlockId });
assert.equal(bind2.status, 200, "A13: picker bind action đã edit vẫn 200");

// ===== A12 — workspace cũ không crash (đọc bình thường sau edit/delete) =====
const itemOld = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.ok(itemOld, "A12: workspace vẫn đọc được (không crash)");
assert.ok(Array.isArray(itemOld.segments), "A12: segments array");

await new Promise(r => srv.close(r));
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Static — PHẦN A/B: grid 5 cột + header actions + technical collapse =====
const viewerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3LibraryViewer.jsx"), "utf8");
assert.ok(viewerSource.includes("v3-lib-modal__steps-head") && viewerSource.includes("v3-lib-modal__step"), "A1: step grid container");
assert.ok(viewerSource.includes("v3-lib-step__n") && viewerSource.includes("v3-lib-step__type") && viewerSource.includes("v3-lib-step__desc") && viewerSource.includes("v3-lib-step__val") && viewerSource.includes("v3-lib-step__tech"), "A1: 5 cột STT/Loại/Thao tác/Giá trị/Technical");
assert.ok(viewerSource.includes("title={!withCheckbox && s.hasRecordedValue ? s.recordedValue : \"\"}"), "A2: view mode có recorded value ellipsis + title full");
assert.ok(viewerSource.includes("expandedTechnicalStep") && viewerSource.includes("▸ Xem") && viewerSource.includes("▾ Ẩn"), "A3: technical collapsed và mở theo từng bước");
assert.ok(viewerSource.includes("Chỉnh sửa") && viewerSource.includes("Xóa"), "A4: header actions");
assert.ok(viewerSource.includes("sameRecordingActions") && viewerSource.includes("Áp dụng Chức năng cho {sameRecordingActions.length} thao tác cùng bản ghi"),
    "A5b: sửa Chức năng đồng loạt theo sourceRecordingId của cùng bản ghi");
assert.ok(viewerSource.includes("updateLibraryAction(item.blockId, { groupName: editGroup })"),
    "A5b: cập nhật từng Action cùng bản ghi, không rename lây bản ghi khác");
assert.ok(viewerSource.includes("Action này đang được dùng bởi") || viewerSource.includes("đang được dùng bởi"), "A7: warning used");
assert.ok(viewerSource.includes("updateLibraryAction") && viewerSource.includes("deleteLibraryAction"), "REUSE: edit/delete qua API shared");
assert.ok(viewerSource.includes("v3-lib-step__value-input") && viewerSource.includes("editValues"), "EDIT: giá trị bản ghi là input có state riêng");
assert.ok(viewerSource.includes("preserveRecordedValue") && viewerSource.includes("dirtySensitiveValues"), "EDIT: secret không đổi được giữ nguyên, không ghi đè bằng mask");
const cssSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "styles", "automationV3.css"), "utf8");
assert.ok(cssSource.includes("grid-template-columns: 44px 84px minmax(0, 1fr) 150px 120px"), "A1: grid 5 cột width cố định STT/Loại + 1fr mô tả");
assert.ok(cssSource.includes("text-overflow: ellipsis"), "A2: long value truncate");
assert.ok(cssSource.includes("@media (max-width: 900px)"), "A1: responsive mobile/tablet");

console.log("Automation V3 Action Library Edit/Delete (composition + stale + guard) test: PASS");
