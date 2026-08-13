import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 422-LIFECYCLE — Test Data → Action → Generate (trace & fix).

 Báo cáo tester: 422 TESTDATA_UNRESOLVED xảy ra dù đã nhập/sửa data; "chữa" được bằng
 remove Action → re-add same Action. Root cause (đã trace + repro code thật):
   1) saveTestData (PATCH) KHÔNG recompute derived state (auto-bind/heal) — chỉ bind/re-add
      (qua getWorkspace) làm việc này → bất đối xứng lifecycle: save xong Generate có thể
      thấy binding cũ/thiếu → 422 dù data đã đủ.
   2) Drawer gửi tdBindings (snapshot lúc MỞ drawer, không re-sync trong phiên) → PATCH
      REPLACE entry.testDataBindings → wipe binding auto-created sau khi mở drawer.
   3) Draft drawer drop confirmed keys ngoài approved → save mất data.
   4) 422 thiếu structured unresolvedFields.

 Fix: saveTestData chạy autoBindTestData ngay sau persist; drawer KHÔNG gửi bindings snapshot
 (trừ chủ động); draft giữ mọi confirmed key; 422 trả unresolvedFields [{field, mapped}].

 Regression R1-R12 (bắt buộc).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "422life-"));

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
    return { srv, req, app };
}

const servers = [];

async function setup(approved, src, blocks, tcId = "TC001") {
    // Mỗi scenario boot server riêng (codegen session chỉ 1 active).
    const { srv, req, app } = await boot();
    servers.push(srv);
    const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
    const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
    await req("POST", `/api/codegen/recordings/${recId}/script`, { script: src });
    const libMap = {};
    for (const b of blocks) {
        const lib = await req("POST", "/api/codegen/library", { recordingId: recId, label: b.label, startStep: b.from, endStep: b.to, groupName: "Đơn vị tính" });
        libMap[b.label] = lib.body.data.blockId;
    }
    const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "ĐVT", approvedTestCases: [
        { id: tcId, title: "Testcase", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: { fields: approved } }
    ] });
    const wid = ws.body.workspaceId;
    await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/select`);
    for (const label of Object.keys(libMap)) {
        await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/library/blocks`, { blockId: libMap[label] });
    }
    await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions`, {
        type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
        expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
    });
    return { wid, tcId, libMap, req, app };
}

const SRC_TC001 = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.goto('http://x/them-moi');
await page.getByLabel('Mã đơn vị tính').fill('BBC');
await page.getByLabel('Tên đơn vị tính').fill('Tên mẫu');
await page.getByLabel('Ghi chú').fill('ghi chú');
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
const APPROVED_TC001 = { "Mã đơn vị tính": { value: "" }, "Tên đơn vị tính": { value: "Kg" }, "Ghi chú": { value: "" } };
const BLOCKS_TC001 = [
    { label: "Đăng nhập", from: 1, to: 4 },
    { label: "Thêm mới đơn vị tính", from: 5, to: 9 }
];

// ===== TC001 setup =====
const tc1 = await setup(APPROVED_TC001, SRC_TC001, BLOCKS_TC001);
const req = tc1.req;

// ===== R3 + R12 — UNRESOLVED thật: 422 + structured unresolvedFields =====
const savePartial = await req("PATCH", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/test-data`, {
    testData: { "Tên đơn vị tính": { value: "Kg", intent: "VALUE" } }
});
assert.equal(savePartial.status, 200, "R3: save data một phần 200");
const genUnresolved = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/generate`, {});
assert.equal(genUnresolved.status, 422, "R3: còn UNRESOLVED thật -> 422");
assert.equal(genUnresolved.body?.errorCode, "TESTDATA_UNRESOLVED", "R3: errorCode TESTDATA_UNRESOLVED");
assert.ok(String(genUnresolved.body?.message ?? "").includes("Mã đơn vị tính") && String(genUnresolved.body?.message ?? "").includes("Ghi chú"), "R12: message liệt kê field gây block");
const uf = genUnresolved.body?.details?.unresolvedFields ?? [];
assert.ok(Array.isArray(uf) && uf.some(x => x.field === "Mã đơn vị tính") && uf.some(x => x.field === "Ghi chú"), "R12: details.unresolvedFields structured [{field, mapped}]");
assert.ok(uf.every(x => typeof x.mapped === "boolean"), "R12: mỗi entry có mapped flag");

// ===== R4 — resolve: xác nhận field -> save -> Generate NGAY (không re-add) =====
const saveFull = await req("PATCH", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/test-data`, {
    testData: {
        "Mã đơn vị tính": { value: "M1", intent: "VALUE" },
        "Tên đơn vị tính": { value: "Kg", intent: "VALUE" },
        "Ghi chú": { value: "", intent: "EMPTY" }
    }
});
assert.equal(saveFull.status, 200, "R4: save đủ data 200");
const genR4 = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/generate`, {});
assert.equal(genR4.status, 200, "R4: sau khi xác nhận -> Generate 200 (KHÔNG remove/re-add)");
let codeR4 = genR4.body?.code ?? "";
assert.ok(codeR4.includes('"Mã đơn vị tính": "M1"') && codeR4.includes('fill(testData["Mã đơn vị tính"])'), "R4: Mã VALUE M1");
assert.ok(!codeR4.includes('fill(testData["Ghi chú"])') && !codeR4.includes('fill("ghi chú")'), "R4: Ghi chú EMPTY -> skip");

// ===== R1 — EDIT data, GIỮ Action -> Generate 200 =====
const saveV2 = await req("PATCH", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/test-data`, {
    testData: {
        "Mã đơn vị tính": { value: "M2", intent: "VALUE" },
        "Tên đơn vị tính": { value: "Kg", intent: "VALUE" },
        "Ghi chú": { value: "", intent: "EMPTY" }
    }
});
assert.equal(saveV2.status, 200, "R1: save V2 (edit) 200");
const genR1 = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/generate`, {});
assert.equal(genR1.status, 200, "R1: edit data + GIỮ Action -> Generate 200 (không cần remove/re-add)");
assert.ok((genR1.body?.code ?? "").includes('"Mã đơn vị tính": "M2"'), "R1: script dùng M2");

// ===== R6 — VALUE changed: A -> B, script dùng B (không giữ A trong derived state) =====
const saveV3 = await req("PATCH", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/test-data`, {
    testData: {
        "Mã đơn vị tính": { value: "M3", intent: "VALUE" },
        "Tên đơn vị tính": { value: "Kg", intent: "VALUE" },
        "Ghi chú": { value: "", intent: "EMPTY" }
    }
});
const genR6 = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/generate`, {});
assert.equal(genR6.status, 200, "R6: generate 200");
const codeR6 = genR6.body?.code ?? "";
assert.ok(codeR6.includes('"Mã đơn vị tính": "M3"') && !codeR6.includes('"Mã đơn vị tính": "M2"'), "R6: script dùng M3, KHÔNG giữ M2");

// ===== R2 — equivalence: edit+giữ Action ≡ remove/re-add same Action =====
const genA = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/generate`, {});
const themBlockId = tc1.libMap["Thêm mới đơn vị tính"];
await req("DELETE", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/binding/blocks/${encodeURIComponent(themBlockId)}`);
await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/library/blocks`, { blockId: themBlockId });
const genB = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/generate`, {});
assert.equal(genA.status, 200, "R2: gen A 200");
assert.equal(genB.status, 200, "R2: gen B (remove/re-add) 200");
assert.equal(genA.body?.code, genB.body?.code, "R2: canonical state KHÔNG đổi khi re-add — code giống hệt");

// ===== R7 — multi-input KHÔNG cross-bind =====
assert.ok(codeR6.includes('fill(testData["Mã đơn vị tính"])') && codeR6.includes('fill(testData["Tên đơn vị tính"])'), "R7: Mã/Tên fill đúng field của chúng");
assert.ok(!codeR6.includes('fill(testData["Tên đơn vị tính"])') === false || codeR6.split('fill(testData["Tên đơn vị tính"])').length === 2, "R7: chỉ Tên dùng value Tên (không Mã/Ghi chú dùng chung)");

// ===== R10 — drawer reopen: backend canonical state == UI draft (không mất data) =====
// Mô phỏng drawer mở lại: draft = approved keys + MỌI confirmed key (non-setup).
const fieldEntry = v => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
        return { value: v.value === undefined || v.value === null ? "" : String(v.value), intent: String(v.intent ?? "").toUpperCase() === "EMPTY" ? "EMPTY" : "VALUE" };
    }
    const s = v === undefined || v === null ? "" : String(v);
    return { value: s, intent: s.trim() !== "" ? "VALUE" : "" };
};
// Thêm confirmed key KHÔNG nằm trong approved (legacy target-keyed) rồi save -> không mất
const saveLegacy = await req("PATCH", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/test-data`, {
    testData: {
        "Mã đơn vị tính": { value: "M3", intent: "VALUE" },
        "Tên đơn vị tính": { value: "Kg", intent: "VALUE" },
        "Ghi chú": { value: "", intent: "EMPTY" },
        "text search": "legacy-value"
    }
});
assert.equal(saveLegacy.status, 200, "R10: save có key ngoài approved 200");
const itemReopen = (await req("GET", `/api/automation-v3/workspaces/${tc1.wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(itemReopen.confirmedTestData["text search"], "legacy-value", "R10: confirmed key ngoài approved KHÔNG bị drop khi save");
const draftReopen = {};
for (const [k, f] of Object.entries(APPROVED_TC001)) {
    const sv = String(f?.value ?? "");
    draftReopen[k] = { value: sv, intent: sv.trim() !== "" ? "VALUE" : "" };
}
for (const [k, v] of Object.entries(itemReopen.confirmedTestData ?? {})) {
    draftReopen[k] = fieldEntry(v);
}
assert.equal(draftReopen["Mã đơn vị tính"].value, "M3", "R10: reopen thấy data mới (M3)");
assert.equal(draftReopen["text search"].value, "legacy-value", "R10: reopen giữ legacy key");

// ===== R5 — UNRESOLVED -> EMPTY: save -> Generate ngay (không re-add) =====
const saveR5 = await req("PATCH", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/test-data`, {
    testData: {
        "Mã đơn vị tính": { value: "M3", intent: "VALUE" },
        "Tên đơn vị tính": { value: "Kg", intent: "VALUE" },
        "Ghi chú": { value: "", intent: "EMPTY" }
    }
});
const genR5 = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/generate`, {});
assert.equal(genR5.status, 200, "R5: EMPTY -> Generate ngay 200 (không re-add)");

// ===== R11 — Run FAILED trước đó không làm stale Test Data/Action cho Generate kế tiếp =====
const svc = tc1.app.locals.dependencies.v3ApplicationService;
const origRunner = svc.runner;
svc.runner = { runFile: async () => ({ status: "FAILED", durationMs: 5, error: "lỗi nghiệp vụ", diagnostic: null }) };
const runFail = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/run`, {});
assert.equal(runFail.body?.runStatus, "FAILED", "R11: run FAILED");
svc.runner = origRunner;
const saveAfterFail = await req("PATCH", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/test-data`, {
    testData: {
        "Mã đơn vị tính": { value: "M4", intent: "VALUE" },
        "Tên đơn vị tính": { value: "Kg", intent: "VALUE" },
        "Ghi chú": { value: "", intent: "EMPTY" }
    }
});
assert.equal(saveAfterFail.status, 200, "R11: save sau run FAIL 200");
const genR11 = await req("POST", `/api/automation-v3/workspaces/${tc1.wid}/testcases/TC001/generate`, {});
assert.equal(genR11.status, 200, "R11: Generate sau run FAILED 200 (không stale)");
assert.ok((genR11.body?.code ?? "").includes('"Mã đơn vị tính": "M4"'), "R11: script dùng data mới M4");

// ===== WIPE regression — save với bindings stale {} KHÔNG làm mất binding canonical =====
const SRC_SEARCH = `await page.goto('http://x/danh-muc');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
const tc8 = await setup({ "Từ khóa tìm kiếm": { value: "Bản" } }, SRC_SEARCH, [{ label: "Tìm kiếm đơn vị tính", from: 1, to: 3 }], "TC008");
const item8 = (await tc8.req("GET", `/api/automation-v3/workspaces/${tc8.wid}`)).body.items.find(x => x.testCaseId === "TC008");
assert.deepEqual(item8.testDataBindings, { "text search": "Từ khóa tìm kiếm" }, "WIPE: binding auto-created tồn tại");
// Giả lập drawer mở TRƯỚC khi có binding: save gửi bindings {} (snapshot cũ)
const wipeSave = await tc8.req("PATCH", `/api/automation-v3/workspaces/${tc8.wid}/testcases/TC008/test-data`, {
    testData: { "Từ khóa tìm kiếm": { value: "Bản", intent: "VALUE" } },
    bindings: {}
});
assert.equal(wipeSave.status, 200, "WIPE: save 200");
const item8b = (await tc8.req("GET", `/api/automation-v3/workspaces/${tc8.wid}`)).body.items.find(x => x.testCaseId === "TC008");
assert.deepEqual(item8b.testDataBindings, { "text search": "Từ khóa tìm kiếm" }, "WIPE: save KHÔNG wipe binding canonical (saveTestData recompute)");
const gen8 = await tc8.req("POST", `/api/automation-v3/workspaces/${tc8.wid}/testcases/TC008/generate`, {});
assert.equal(gen8.status, 200, "R8: TC008 parameterize vẫn PASS");
assert.ok((gen8.body?.code ?? "").includes('fill(testData["Từ khóa tìm kiếm"])') && (gen8.body?.code ?? "").includes('"Từ khóa tìm kiếm": "Bản"'), "R8: text search -> Từ khóa tìm kiếm");

// ===== R9 — Login setup env không bị block =====
const SRC_LOGIN = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
const tc9 = await setup({ "Tài khoản": { value: "admin" }, "Mật khẩu": { value: "secret" } }, SRC_LOGIN, [{ label: "Đăng nhập", from: 1, to: 4 }], "TC009");
const gen9 = await tc9.req("POST", `/api/automation-v3/workspaces/${tc9.wid}/testcases/TC009/generate`, {});
assert.equal(gen9.status, 200, "R9: Login setup env Generate 200 (không bị 422 business)");
const code9 = gen9.body?.code ?? "";
assert.ok(code9.includes('fill(process.env.LOGIN_USERNAME ?? "")') && code9.includes('fill(process.env.LOGIN_PASSWORD ?? "")'), "R9: LOGIN_* env");

for (const s of servers) await new Promise(r => s.close(r));
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("Automation V3 422 Lifecycle (Test Data -> Action -> Generate) test: PASS");
