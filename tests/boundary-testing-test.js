import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseRecording } from "../src/codegen/recordingParser.js";
import { renderStandaloneBoundarySpec } from "../src/codegen/rendererBoundaryStandalone.js";
import BoundaryEntryStore from "../src/codegen/BoundaryEntryStore.js";
import BoundaryTestingService from "../src/services/BoundaryTestingService.js";
import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";

/* Kiểm thử biên (Boundary Testing) — HOÀN TOÀN độc lập với Automation Workspace: dán 1 script
   Playwright đã ghi, đánh dấu 1 bước FILL làm mục tiêu, chạy hàng loạt giá trị biên, gom kết quả
   riêng từng giá trị, lưu lịch sử chạy (report), đánh dấu lỗi thật + chạy lại tập con. */

// Đúng ví dụ thật Ngân đưa: đăng nhập có 3 field, "Tài khoản" là mục tiêu kiểm thử biên; "Mật
// khẩu"/"Mã xác nhận" là field nhạy cảm — recordingParser sẽ redact "REDACTED" lúc parse.
const SCRIPT = `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login?returnUrl=http%3A%2F%2F172.16.1.100%3A9230%2F');
  await page.getByRole('textbox', { name: 'Tài khoản' }).click();
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).click();
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('1234566s');
  await page.getByRole('textbox', { name: 'Mã xác nhận' }).click();
  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill('ss');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Tài khoản hoặc mật khẩu không')).toBeVisible();
});`;

async function main() {
    // ---- parseRecording: thuần, không cần workspace/testcase nào ----
    const { steps, assertions } = parseRecording(SCRIPT);
    const fillSteps = steps.filter(s => s.actionType === "FILL");
    assert.equal(fillSteps.length, 3, "3 bước FILL: Tài khoản, Mật khẩu, Mã xác nhận");
    const taiKhoanStep = fillSteps.find(s => s.target === "Tài khoản");
    const matKhauStep = fillSteps.find(s => s.target === "Mật khẩu");
    assert.equal(taiKhoanStep.recordedValue, "admin", "field không nhạy cảm giữ nguyên giá trị");
    assert.equal(taiKhoanStep.sensitive, false);
    assert.equal(matKhauStep.recordedValue, "REDACTED", "field nhạy cảm bị redact lúc parse — xác nhận bug đã lường trước");
    assert.equal(matKhauStep.sensitive, true);
    assert.equal(assertions.length, 1);

    // ---- Locator không có accessible name (vd page.locator('#css_id')) — target phải hiện
    // đúng selector để phân biệt được nhiều field, KHÔNG được rơi về chỉ còn tên method
    // ("locator"/"click"...) — bug thật Ngân báo lại 2026-08-28 (nhiều field CSS-id đều hiện
    // "locator", không chọn đúng được field nào). ----
    const CSS_ID_SCRIPT = `import { test, expect } from '@playwright/test';
test('test', async ({ page }) => {
  await page.locator('#txt_ma_ky_luat').click();
  await page.locator('#txt_ma_ky_luat').fill('avc');
  await page.locator('#txt_ten_ky_luat').click();
  await page.locator('#txt_ten_ky_luat').fill('abc');
});`;
    const cssIdParsed = parseRecording(CSS_ID_SCRIPT);
    const cssFillSteps = cssIdParsed.steps.filter(s => s.actionType === "FILL");
    assert.equal(cssFillSteps.length, 2);
    assert.equal(cssFillSteps[0].target, "#txt_ma_ky_luat");
    assert.equal(cssFillSteps[1].target, "#txt_ten_ky_luat");
    assert.notEqual(cssFillSteps[0].target, cssFillSteps[1].target, "2 field khác nhau phải có target khác nhau, không cùng rơi về \"locator\"");

    // ---- Chain phức tạp: .first()/.nth() trước method, CSS selector có ngoặc lồng nhau, locator
    // nối chuỗi 2 lớp (getByRole().getByLabel()) — bug thật Ngân báo lại 2026-08-28: các bước này
    // bị rơi mất LẶNG LẼ khỏi kết quả parse (không có step nào được tạo ra, không cảnh báo gì). ----
    const COMPLEX_CHAIN_SCRIPT = `import { test, expect } from '@playwright/test';
test('test', async ({ page }) => {
  await page.getByRole('button', { name: 'Thêm kỷ luật' }).first().click();
  await page.locator('tr:nth-child(5) > td:nth-child(2)').first().click();
  await page.getByRole('row', { name: 'Cấm học bổng', exact: true }).getByLabel('').check();
});`;
    const complexParsed = parseRecording(COMPLEX_CHAIN_SCRIPT);
    assert.equal(complexParsed.steps.length, 3, "cả 3 bước chain phức tạp đều phải được nhận diện, không bị rơi mất");
    assert.equal(complexParsed.steps[0].actionType, "CLICK");
    assert.equal(complexParsed.steps[0].target, "Thêm kỷ luật", ".first() xen giữa locator và method không được làm mất tên field");
    assert.equal(complexParsed.steps[1].actionType, "CLICK");
    assert.equal(complexParsed.steps[1].target, "tr:nth-child(5) > td:nth-child(2)", "CSS selector có ngoặc lồng nhau phải giữ nguyên nội dung, không bị cắt cụt ở dấu ) đầu tiên");
    assert.equal(complexParsed.steps[2].actionType, "CHECK");
    assert.equal(complexParsed.steps[2].target, "Cấm học bổng", "locator nối chuỗi 2 lớp (getByRole().getByLabel()) vẫn phải trích được tên field từ lớp đầu");

    // ---- BoundaryEntryStore + BoundaryTestingService end-to-end (không qua HTTP) ----
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bnd-entry-"));
    const store = new BoundaryEntryStore({ metadataFile: path.join(dir, "boundary-entries.json") });
    const runner = new PlaywrightRunner({ rootDir: dir });
    const service = new BoundaryTestingService({ store, runner, outputDir: path.join(dir, "out") });

    const entry = service.createEntry({ projectId: "PRJ-1", label: "Đăng nhập - Tài khoản", scriptSource: SCRIPT });
    assert.equal(entry.steps.length, 8, "goto + 3x(click+fill) + click Đăng nhập");
    assert.equal(entry.targetStep, null);

    // Chưa đánh dấu target -> suggest phải báo lỗi rõ ràng, không đoán.
    await assert.rejects(() => service.suggestValues({ entryId: entry.entryId }), /Chưa đánh dấu/);

    const withTarget = service.setTarget({ entryId: entry.entryId, stepOrder: taiKhoanStep.order });
    assert.deepEqual(withTarget.targetStep, { order: taiKhoanStep.order, locator: taiKhoanStep.locator, target: "Tài khoản" });

    // ---- suggestValues sau khi có target: currentValue = "admin", rule-based luôn có candidate rỗng ----
    const suggested = await service.suggestValues({ entryId: entry.entryId });
    assert.equal(suggested.currentValue, "admin");
    assert.ok(suggested.candidates.some(c => c.value === ""), "luôn có candidate rỗng");

    // ---- Chưa nhập sensitiveOverrides -> render phải CHẶN, không được âm thầm fill "REDACTED" ----
    const candidates = [{ id: "C1", value: "" }, { id: "C2", value: "!@#$" }];
    const blocked = renderStandaloneBoundarySpec({
        steps: entry.steps, assertions: entry.assertions, targetStep: withTarget.targetStep,
        sensitiveOverrides: {}, candidates, label: entry.label
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.errorCode, "BOUNDARY_SENSITIVE_VALUE_REQUIRED", "phải chặn khi field nhạy cảm khác mục tiêu chưa có giá trị thật");

    service.setSensitiveOverrides({ entryId: entry.entryId, overrides: { [matKhauStep.order]: "hotro1", [fillSteps[2].order]: "ss" } });
    const afterOverride = service.getEntry({ entryId: entry.entryId });

    // ---- renderStandaloneBoundarySpec: N test literal, KHÔNG business-field ----
    const rendered = renderStandaloneBoundarySpec({
        steps: afterOverride.steps, assertions: afterOverride.assertions, targetStep: afterOverride.targetStep,
        sensitiveOverrides: afterOverride.sensitiveOverrides, candidates, label: afterOverride.label
    });
    assert.equal(rendered.ok, true, rendered.reason);
    for (const c of candidates) {
        assert.ok(rendered.code.includes(`test(${JSON.stringify(c.id)}`), `spec chứa test title ${c.id}`);
    }
    assert.ok(rendered.code.includes(`.fill(${JSON.stringify("")})`) || rendered.code.includes(`.fill("")`), "candidate rỗng inline literal");
    assert.ok(rendered.code.includes(`.fill("!@#$")`), "candidate đặc biệt inline literal");
    assert.ok(rendered.code.includes(`.fill("hotro1")`), "Mật khẩu dùng đúng giá trị thật đã nhập lại, KHÔNG phải REDACTED");
    assert.ok(!rendered.code.includes("REDACTED"), "không bao giờ được để lọt literal REDACTED vào spec sinh ra");
    assert.ok(rendered.code.includes("Tài khoản hoặc mật khẩu không"), "assertion gốc được replay y nguyên");

    // Syntax hợp lệ.
    const tmpSpec = path.join(os.tmpdir(), `boundary-standalone-check-${Date.now()}.mjs`);
    fs.writeFileSync(tmpSpec, rendered.code, "utf8");
    const check = spawnSync(process.execPath, ["--check", tmpSpec]);
    fs.rmSync(tmpSpec, { force: true });
    assert.equal(check.status, 0, `node --check thất bại: ${check.stderr}`);

    // ---- saveCandidates + BoundaryEntryStore run-history (report bất biến, không ghi đè) ----
    const saved = store.saveCandidates(entry.entryId, [{ value: "" }, { value: "abc" }]);
    assert.equal(saved.candidates.length, 2);
    assert.ok(saved.candidates.every(c => c.id && c.defectFlag === "UNREVIEWED"));

    const resultsById = new Map(saved.candidates.map((c, i) => [c.id, { status: i === 0 ? "FAILED" : "PASSED", screenshotPath: i === 0 ? "shot.png" : null }]));
    const afterRun = store.applyRunResults(entry.entryId, resultsById);
    assert.equal(afterRun.runs.length, 1);
    assert.equal(afterRun.runs[0].summary.passed, 1);
    assert.equal(afterRun.runs[0].summary.failed, 1);

    const marked = store.markDefect(entry.entryId, saved.candidates[0].id, { defectFlag: "DEFECT", note: "Lỗi thật" });
    assert.equal(marked.candidates[0].defectFlag, "DEFECT");
    assert.equal(marked.candidates[0].lastStatus, "FAILED", "markDefect không đụng lastStatus");

    const secondRun = store.applyRunResults(entry.entryId, new Map([[saved.candidates[1].id, { status: "FAILED" }]]));
    assert.equal(secondRun.runs.length, 2, "chạy lần 2 phải THÊM report, không ghi đè report cũ");
    assert.equal(secondRun.runs[0].summary.failed, 1, "report mới nhất ở đầu mảng");
    assert.equal(secondRun.runs[1].summary.passed, 1, "report cũ vẫn còn nguyên");

    // ---- listEntries / deleteEntry ----
    assert.equal(service.listEntries({ projectId: "PRJ-1" }).length, 1);
    assert.equal(service.listEntries({ projectId: "PRJ-KHAC" }).length, 0, "lọc đúng theo projectId");
    service.deleteEntry({ entryId: entry.entryId });
    assert.equal(service.getEntry({ entryId: entry.entryId }), null);

    // ---- PlaywrightRunner.collectBoundarySpecs: gom theo title, KHÔNG ghi đè (đã verify thật trước đó) ----
    // Fixture khớp ĐÚNG cây JSON thật của Playwright reporter (spec.ok + spec.tests[].results[]),
    // KHÔNG phải spec.status/spec.results như fixture cũ — 2 field đó không tồn tại trong output
    // thật (xem extractBoundaryResults bên dưới).
    const byTitle = new Map();
    const fakeSuite = { specs: [
        { title: "C-1", file: "x.spec.js", ok: true, tests: [{ results: [{ status: "passed", error: null, attachments: [] }] }] },
        { title: "C-2", file: "x.spec.js", ok: false, tests: [{ results: [{ status: "timedOut", error: { message: "Timeout" }, attachments: [] }] }] }
    ] };
    runner.collectBoundarySpecs(fakeSuite, byTitle);
    assert.equal(byTitle.size, 2);

    // ---- PlaywrightRunner.extractBoundaryResults: BUG THẬT phát hiện khi chạy thật (2026-08-28) ----
    // Code cũ đọc `spec.status`/`spec.results` — cả 2 field đều KHÔNG tồn tại trong JSON reporter
    // thật của Playwright (cây thật là `spec.ok` (boolean) + `spec.tests[].results[]`). Vì đọc sai
    // field, MỌI lần chạy đều báo FAILED (spec.status luôn undefined -> nhánh else) và
    // error/screenshot luôn null (spec.results luôn undefined -> vòng lặp không chạy) — BẤT KỂ kết
    // quả thật. Đây chính là lý do tester ("test 1" trong workspace Quản lý thiết bị) luôn thấy "0
    // pass", không lý do, không ảnh dù script chạy thật. Fixture dưới đây khớp đúng cấu trúc JSON
    // thật (đã verify bằng cách chạy thật + in ra Object.keys) để bug này không thể tái diễn.
    const shotSrcDir = fs.mkdtempSync(path.join(os.tmpdir(), "boundary-shot-src-"));
    const shotSrcPath = path.join(shotSrcDir, "test-failed-1.png");
    fs.writeFileSync(shotSrcPath, Buffer.from([137, 80, 78, 71]));
    const shotDestDir = fs.mkdtempSync(path.join(os.tmpdir(), "boundary-shot-dest-"));
    const ESC = String.fromCharCode(27);
    const fakePlaywrightJson = {
        suites: [{
            specs: [
                {
                    title: "C-PASS", ok: true,
                    tests: [{ results: [{ status: "passed", error: null, attachments: [{ name: "screenshot", contentType: "image/png", path: shotSrcPath }] }] }]
                },
                {
                    title: "C-FAIL", ok: false,
                    tests: [{ results: [{
                        status: "timedOut",
                        error: { message: `${ESC}[31mTest timeout of 30000ms exceeded.${ESC}[39m` },
                        attachments: [{ name: "screenshot", contentType: "image/png", path: shotSrcPath }]
                    }] }]
                }
            ]
        }]
    };
    const extracted = runner.extractBoundaryResults(fakePlaywrightJson, shotDestDir);
    assert.equal(extracted.get("C-PASS").status, "PASSED", "status phải đọc từ spec.ok, không phải spec.status (không tồn tại)");
    assert.equal(extracted.get("C-FAIL").status, "FAILED");
    assert.equal(extracted.get("C-FAIL").errorMessage, "Test timeout of 30000ms exceeded.", "lỗi thật đọc từ spec.tests[].results[].error + mã màu ANSI đã được bóc");
    assert.ok(extracted.get("C-PASS").screenshotFile, "ảnh chụp màn hình phải được lưu kể cả khi PASSED (screenshot:'on'), không chỉ khi FAILED");
    assert.ok(fs.existsSync(path.join(shotDestDir, extracted.get("C-PASS").screenshotFile)), "ảnh phải thực sự được copy ra thư mục bền vững (test-results/ bị Playwright xóa sạch lần chạy sau)");
    fs.rmSync(shotSrcDir, { recursive: true, force: true });
    fs.rmSync(shotDestDir, { recursive: true, force: true });

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Boundary Testing (standalone) test: PASS");
}

main().catch(err => { console.error(err); process.exit(1); });
