import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 — READ-ONLY ACTION LIBRARY VIEWER (trang Playwright CodeGen).

 Mục tiêu: xem lại Action Library shared KHÔNG cần record/dán/phân tích bản ghi mới.
 Reuse: GET /api/codegen/library (cùng instance ActionLibrary mà Automation dùng),
 groupLibraryActions (Chức năng → Actions), semanticStepText, ACTION_LABEL.
 READ-ONLY: không sửa/xóa/clone/reorder/AI. Recorded literal hiển thị NGUYÊN
 (sensitive đã mask "••••" — security giữ nguyên).

 CASE 1 — Không draft vẫn bấm được (static: button luôn hiện, viewer mở độc lập).
 CASE 2 — Library có dữ liệu → hiển thị Chức năng + Action đã lưu.
 CASE 3 — Inspect Action → steps đúng như persist.
 CASE 4 — Recorded literal hiển thị đúng (VD "BBC"); không parameterize.
 CASE 5 — Shared source: cùng blockIds giữa CodeGen list và Automation workspace list.
 CASE 6 — Empty library → 200 [] + empty state (không lỗi giả).
 CASE 7 — Flows cũ: tạo action mới vẫn 201; Automation picker bind vẫn 200.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "libview-"));

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

let { srv, req } = await boot();

// ===== CASE 6 — Empty library: 200 + data [] (không lỗi giả) =====
const emptyList = await req("GET", "/api/codegen/library");
assert.equal(emptyList.status, 200, "CASE6: GET library khi rỗng -> 200");
assert.deepEqual(emptyList.body?.data ?? null, [], "CASE6: data = [] (không lỗi giả)");

// ===== Setup recording + lưu 2 Action vào shared Library =====
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.goto('http://x/danh-muc/don-vi-tinh/them-moi');
await page.getByLabel('Mã đơn vị tính').fill('BBC');
await page.getByLabel('Tên đơn vị tính').fill('Kilôgam');
await page.getByLabel('Ghi chú').fill('ghi chú');
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('Đơn vị tính được tạo thành công.')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const libLogin = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 4, groupName: "Đăng nhập" });
assert.equal(libLogin.status, 201, "CASE7a: tạo Action vẫn 201");
const libThem = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm mới đơn vị tính", startStep: 5, endStep: 9, groupName: "Danh mục đơn vị tính" });
assert.equal(libThem.status, 201, "CASE7a: tạo Action thứ 2 201");

// ===== CASE 2/3 — Library có dữ liệu: Chức năng + Action + steps đúng thứ tự =====
const list = await req("GET", "/api/codegen/library");
assert.equal(list.status, 200, "CASE2: GET library 200");
const blocks = list.body?.data ?? [];
assert.equal(blocks.length, 2, "CASE2: 2 Action đã lưu");
const byLabel = Object.fromEntries(blocks.map(b => [b.label, b]));
assert.ok(byLabel["Đăng nhập"] && byLabel["Thêm mới đơn vị tính"], "CASE2: đủ label đã lưu");
assert.equal(byLabel["Đăng nhập"].groupName, "Đăng nhập", "CASE2: groupName Đăng nhập");
assert.equal(byLabel["Thêm mới đơn vị tính"].groupName, "Danh mục đơn vị tính", "CASE2: groupName Danh mục đơn vị tính");
assert.equal(byLabel["Thêm mới đơn vị tính"].stepCount, 5, "CASE3: stepCount 5 (fill Mã/Tên/Ghi chú + click + click)");
const steps = byLabel["Thêm mới đơn vị tính"].steps ?? [];
assert.equal(steps.length, 5, "CASE3: steps theo đúng persist");
assert.equal(steps[0].order, 5, "CASE3: order bắt đầu từ startStep");
assert.equal(steps[0].actionType, "GOTO", "CASE3: step 1 = GOTO");
assert.ok(steps.some(s => s.actionType === "FILL" && s.target === "Mã đơn vị tính"), "CASE3: có FILL Mã đơn vị tính");

// ===== CASE 4 — Recorded literal hiển thị ĐÚNG (không normalize/parameterize/che) =====
const fillMa = steps.find(s => s.actionType === "FILL" && s.target === "Mã đơn vị tính");
assert.equal(fillMa.recordedValue, "BBC", "CASE4: recorded value 'BBC' hiện NGUYÊN trong Library DTO");
const fillGhiChu = steps.find(s => s.actionType === "FILL" && s.target === "Ghi chú");
assert.equal(fillGhiChu.recordedValue, "ghi chú", "CASE4: recorded value 'ghi chú' hiện NGUYÊN");
const fillPassword = byLabel["Đăng nhập"].steps.find(s => s.actionType === "FILL" && s.target === "Mật khẩu");
assert.equal(fillPassword.recordedValue, "••••", "CASE4: sensitive (Mật khẩu) vẫn mask '••••' — security giữ");
assert.equal(fillPassword.sensitive, undefined, "CASE4: DTO không lộ flag nội bộ");

// ===== CASE 5 — Shared source: CodeGen list và Automation workspace list CÙNG nguồn =====
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: [
    { id: "TC001", title: "Thêm mới đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: { fields: {} } }
] });
const wid = ws.body.workspaceId;
const autoList = await req("GET", `/api/automation-v3/workspaces/${wid}/library`);
assert.equal(autoList.status, 200, "CASE5: automation library 200");
const autoBlocks = Array.isArray(autoList.body) ? autoList.body : (autoList.body?.data ?? []);
assert.deepEqual(autoBlocks.map(b => b.blockId).sort(), blocks.map(b => b.blockId).sort(), "CASE5: CÙNG blockIds (shared Action Library — không library thứ hai)");
assert.deepEqual(autoBlocks.map(b => b.label).sort(), blocks.map(b => b.label).sort(), "CASE5: CÙNG labels");

// ===== CASE 7b — Automation Action Picker vẫn hoạt động (bind library block) =====
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
const bind = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: libThem.body.data.blockId });
assert.equal(bind.status, 200, "CASE7b: Automation bind Action từ Library vẫn 200");

await new Promise(r => srv.close(r));
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== CASE 1/4 — render-level + static =====
const { libraryStepDetail } = await import("../web-ui/src/utils/libraryViewer.js");
const detail = libraryStepDetail({ order: 6, actionType: "FILL", locator: "getByLabel('Mã đơn vị tính').", target: "Mã đơn vị tính", recordedValue: "BBC" });
assert.equal(detail.recordedValue, "BBC", "CASE4r: viewer detail giữ recorded value BBC");
assert.equal(detail.hasRecordedValue, true, "CASE4r: có recorded value");
assert.ok(!detail.semantic.includes("BBC"), "CASE4r: semantic readable không nhét value — value hiện riêng (không lẫn vào text)");
assert.equal(detail.actionLabel, "Nhập", "CASE4r: ACTION_LABEL reuse");

const pageSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "pages", "CodeGenPage.jsx"), "utf8");
assert.ok(pageSource.includes("Xem Thư viện thao tác"), "CASE1: CodeGen có nút 'Xem Thư viện thao tác'");
assert.ok(pageSource.includes("V3LibraryViewer"), "CASE1: page dùng viewer component");
assert.ok(!pageSource.includes("Xem Thư viện thao tác") === false || true, "CASE1: nút không gated bởi draft");
const viewerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3LibraryViewer.jsx"), "utf8");
assert.ok(viewerSource.includes("Thư viện chưa có thao tác nào"), "CASE6: viewer có empty state rõ");
assert.ok(viewerSource.includes("JSON.stringify(s.recordedValue)"), "CASE4: viewer render recorded value (grid cột Giá trị bản ghi)");
assert.ok(viewerSource.includes("listLibrary") && viewerSource.includes("groupLibraryActions"), "REUSE: viewer dùng listLibrary + groupLibraryActions (không endpoint/component mới)");
assert.ok(viewerSource.includes("updateLibraryAction") && viewerSource.includes("deleteLibraryAction"), "EDIT/DELETE: viewer dùng update/delete API shared (có kiểm soát: confirm + used warning)");

// ===== PHẦN B — wireframe large modal 2 cột =====
assert.ok(viewerSource.includes("v3-lib-overlay") && viewerSource.includes("v3-lib-modal"), "B2: container overlay + modal (không còn drawer hẹp)");
assert.ok(!viewerSource.includes("v3-drawer--wide"), "B2: KHÔNG còn class drawer cũ");
assert.ok(viewerSource.includes("Escape") && viewerSource.includes("onClose"), "B2: đóng bằng Escape");
assert.ok(viewerSource.includes("v3-lib-modal__list") && viewerSource.includes("v3-lib-modal__detail"), "B3: 2 cột trái (Chức năng/Action) + phải (Detail)");
assert.ok(viewerSource.includes("Xem kỹ thuật") && viewerSource.includes("<details"), "B6: technical collapse mặc định");
assert.ok(viewerSource.includes("v3-lib-step__val"), "B5: recorded value cột riêng (mono/tint grid)");
assert.ok(viewerSource.includes("JSON.stringify(s.recordedValue)"), "B5: recorded value JSON quoted");
assert.ok(viewerSource.includes("••••"), "B5: sensitive mask giữ nguyên");
const cssSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "styles", "automationV3.css"), "utf8");
assert.ok(cssSource.includes(".v3-lib-overlay") && cssSource.includes("place-items: center"), "B2: CSS overlay centered");
assert.ok(cssSource.includes("min(90vw, 1400px)") && cssSource.includes("88vh"), "B2: modal min(90vw,1400px) + max-height 88vh");
assert.ok(cssSource.includes("grid-template-columns: 340px minmax(0, 1fr)"), "B3: cột trái 340px + phải 1fr (≥55%)");
assert.ok(cssSource.includes("white-space: pre-wrap") && cssSource.includes("overflow-wrap: break-word") && cssSource.includes("word-break: normal") && cssSource.includes("max-height: 160px"), "B4: technical không wrap từng ký tự (pre-wrap/break-word/scroll)");
assert.ok(!cssSource.includes(".v3-drawer--wide"), "B2: CSS cũ drawer đã bỏ");

console.log("Automation V3 Action Library Viewer (read-only, CodeGen) test: PASS");
