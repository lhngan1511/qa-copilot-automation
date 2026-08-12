import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/*
 P0 CODEGEN CONSOLIDATION — Acceptance case Đơn vị tính.

 Record/Paste → GLOBAL Recording (không workspace) → Parse → Cut → Confirm → Action Library
 → Automation consume LIB-* (không paste lại) → TC Sửa = Login→Open→Search→Edit→Search (Search lặp).
 Reload → Library vẫn còn.
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cg-"));
const dataDir = path.join(tempRoot, "data");
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.getByRole('button', { name: 'Danh mục' }).click();
await page.getByRole('button', { name: 'Đơn vị tính' }).click();
await page.getByRole('button', { name: 'Thêm' }).click();
await page.getByLabel('Mã').fill('KG');
await page.getByLabel('Tên').fill('Kilôgam');
await page.getByRole('button', { name: 'Lưu' }).click();
await page.getByRole('textbox', { name: 'Tìm kiếm' }).fill('KG');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await page.getByRole('button', { name: 'Sửa' }).click();
await page.getByLabel('Tên').fill('Kilôgam mới');
await page.getByRole('button', { name: 'Lưu' }).click();
await page.getByRole('textbox', { name: 'Tìm kiếm' }).fill('KG');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await page.getByRole('button', { name: 'Xóa' }).click();
await page.getByRole('button', { name: 'Xác nhận xóa' }).click();`;

async function boot(dataDir2) {
    const app = createApp({ repositoryType: "file", dataDir: dataDir2, outputDir: path.join(tempRoot, "o"), v3OutputDir: path.join(tempRoot, "out") });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b !== undefined ? { "content-type": "application/json" } : {}, body: b !== undefined ? JSON.stringify(b) : undefined });
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, body: d };
    }
    return { srv, req };
}

async function main() {
    let { srv, req } = await boot(dataDir);

    // ===== 1. GLOBAL RECORDING — Codegen paste (không workspace) =====
    const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
    const recId = start?.body?.data?.recordingId ?? start?.body?.recordingId;
    assert.ok(recId, "codegen start → recordingId");
    const setScript = await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
    assert.equal(setScript.status, 200, "setScript 200");
    const detail = await req("GET", `/api/codegen/recordings/${recId}`);
    const rec = detail.body?.data ?? detail.body;
    assert.equal(Array.isArray(rec?.steps) ? rec.steps.length : 0, 19, "steps=19 (actions)");
    assert.equal(Array.isArray(rec?.assertions) ? rec.assertions.length : 0, 0, "assertions=0 (recording này không expect)");

    // ===== 2. CUT MANY → CONFIRM → LIBRARY (qua /api/codegen/library — không workspace) =====
    const segs = [
        [1, 4, "Đăng nhập"], [5, 6, "Mở Đơn vị tính"], [7, 10, "Thêm đơn vị tính"],
        [11, 12, "Tìm kiếm"], [13, 15, "Sửa đơn vị tính"], [16, 17, "Tìm kiếm (sau sửa)"], [18, 19, "Xóa đơn vị tính"]
    ];
    const libIds = {};
    for (const [s, e, label] of segs) {
        const r = await req("POST", "/api/codegen/library", { recordingId: recId, label, kind: "ACTION", startStep: s, endStep: e });
        assert.equal(r.status, 201, `createLibraryAction ${label}: ${r.status}`);
        const blockId = r.body?.data?.blockId;
        assert.ok(String(blockId).startsWith("LIB-"), `LIB-*: ${label}`);
        assert.equal(r.body.data.stepCount, e - s + 1, `stepCount ${label}`);
        libIds[label] = blockId;
    }

    // ===== 3. RELOAD (server restart cùng dataDir) → Library vẫn còn =====
    await new Promise(r => srv.close(r));
    ({ srv, req } = await boot(dataDir));
    const libAfterReload = await req("GET", "/api/codegen/recordings");
    // Library qua automation-v3 (shared file)
    const wsCreate = await req("POST", "/api/automation-v3/workspaces", {
        source: "NEW", module: "Đơn vị tính",
        approvedTestCases: [
            { id: "TC001", title: "Sửa đơn vị tính", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Sửa thành công", testData: { fields: {} } },
            { id: "TC002", title: "Thêm đơn vị tính", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Thêm thành công", testData: { fields: {} } }
        ]
    });
    const wid = wsCreate.body.workspaceId;
    const lib = await req("GET", `/api/automation-v3/workspaces/${wid}/library`);
    assert.equal(lib.body.length, 7, "reload: Library còn 7 action");
    const libMap = Object.fromEntries(lib.body.map(b => [b.label, b.blockId]));
    assert.equal(libMap["Đăng nhập"], libIds["Đăng nhập"], "LIB id giữ sau reload");

    // ===== 4. Automation consume — KHÔNG paste lại =====
    await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
    for (const label of ["Đăng nhập", "Mở Đơn vị tính", "Tìm kiếm", "Sửa đơn vị tính", "Tìm kiếm"]) {
        const bind = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: libMap[label] });
        assert.equal(bind.status, 200, `bind ${label}`);
    }
    const binding = await req("GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding`);
    assert.equal(binding.body.sequence.length, 5, "TC Sửa: 5 thao tác");
    assert.deepEqual(binding.body.sequence.map(x => x.blockId), [
        libMap["Đăng nhập"], libMap["Mở Đơn vị tính"], libMap["Tìm kiếm"], libMap["Sửa đơn vị tính"], libMap["Tìm kiếm"]
    ], "sequence Login→Open→Search→Edit→Search (Search lặp LIB)");

    // Generate TC Sửa (assertion + setup)
    const d = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`,
        { type: "TEXT_VISIBLE", target: "Thành công", locator: "page.getByText('Thành công')", expected: "Thành công", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED" });
    assert.equal(d.body.status, "TESTER_CONFIRMED", "assertion confirmed");
    const gen = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(gen.status, 200, "generate TC Sửa PASS");
    const code = fs.readFileSync(gen.body.outputPath, "utf8");
    assert.ok(code.indexOf("name: 'Sửa'") > code.indexOf("name: 'Tìm kiếm'"), "Search trước Edit");
    assert.ok(code.indexOf("name: 'Tìm kiếm'", code.indexOf("name: 'Sửa'")) > -1, "Search sau Edit (repeated)");

    // TC Thêm: Login→Open→Add
    await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/select`);
    for (const label of ["Đăng nhập", "Mở Đơn vị tính", "Thêm đơn vị tính"]) {
        await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/library/blocks`, { blockId: libMap[label] });
    }
    const bind2 = await req("GET", `/api/automation-v3/workspaces/${wid}/testcases/TC002/binding`);
    assert.equal(bind2.body.sequence.length, 3, "TC Thêm: 3 thao tác");

    await new Promise(r => srv.close(r));
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 Codegen Consolidation (acceptance ĐVT) test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
