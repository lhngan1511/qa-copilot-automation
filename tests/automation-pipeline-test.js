import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import LocatorReferenceStore from "../src/automation/LocatorReferenceStore.js";
import AutomationMappingGenerator from "../src/automation/AutomationMappingGenerator.js";
import PlaywrightGenerator from "../src/automation/PlaywrightGenerator.js";
import AutomationReadinessValidator from "../src/automation/AutomationReadinessValidator.js";
import ExecutionReport from "../src/automation/ExecutionReport.js";
import ExecutionResult from "../src/automation/ExecutionResult.js";
import { normalizeAction, normalizeAssertion } from "../src/automation/AutomationActions.js";
import AutomationPipelineService from "../src/services/AutomationPipelineService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const approvedFile = path.join(rootDir, "outputs", "production", "json", "approved-testcases.json");

let failures = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✔ ${name}`);
    } catch (e) {
        failures++;
        console.error(`  ✘ ${name}`);
        console.error(`    ${e.message}`);
    }
}

console.log("\n=================================");
console.log(" QA COPILOT PHASE 2 — AUTOMATION TEST");
console.log("=================================\n");

const testCases = JSON.parse(fs.readFileSync(approvedFile, "utf8"));
assert.ok(Array.isArray(testCases) && testCases.length > 0, "cần testcase mẫu");
const tc = testCases[0];

// 1. normalizeAction
test("normalizeAction nhận diện action tiếng Việt", () => {
    assert.strictEqual(normalizeAction("Nhập dữ liệu"), "fill");
    assert.strictEqual(normalizeAction("Lưu dữ liệu"), "click");
    assert.strictEqual(normalizeAction("Thiết lập điều kiện trước"), "setup");
    assert.strictEqual(normalizeAction("Kiểm tra kết quả nghiệp vụ"), "verify");
});

// 2. normalizeAssertion
test("normalizeAssertion nhận diện assertion", () => {
    assert.strictEqual(normalizeAssertion("Thiết bị được tạo thành công"), "toBeVisible");
});

// 3. LocatorReferenceStore
test("LocatorReferenceStore đề xuất locator draft", () => {
    const store = new LocatorReferenceStore({ rootDir });
    const ref = store.propose("Device", "Mã thiết bị");
    assert.ok(ref, "phải đề xuất được");
    assert.strictEqual(ref.isDraft, true);
    assert.strictEqual(ref.strategy, "getByLabel");
});

// 4. Readiness validator
test("AutomationReadinessValidator trả blockers", () => {
    const v = new AutomationReadinessValidator({ locatorStore: new LocatorReferenceStore({ rootDir }) });
    const r = v.evaluate(tc);
    assert.ok(Array.isArray(r.blockers));
    assert.ok(Array.isArray(r.missing));
});

// 5. Mapping generator
test("MappingGenerator tạo mapping READY (autoApprove)", () => {
    const store = new LocatorReferenceStore({ rootDir });
    const gen = new AutomationMappingGenerator({ locatorStore: store });
    const m = gen.generate(tc, { autoApprove: true });
    assert.strictEqual(m.blockers.length, 0);
    assert.strictEqual(m.readiness, "READY");
    assert.ok(m.actions.length > 0, "có actions");
    assert.ok(m.locatorReferences.length > 0, "có locators");
});

test("MappingGenerator giữ traceability testCaseId", () => {
    const store = new LocatorReferenceStore({ rootDir });
    const gen = new AutomationMappingGenerator({ locatorStore: store });
    const m = gen.generate(tc, { autoApprove: true });
    assert.strictEqual(m.testCaseId, tc.id);
    assert.ok(m.artifactId.startsWith("AM-"));
});

// 6. PlaywrightGenerator sinh file hợp lệ
test("PlaywrightGenerator sinh project + spec syntax hợp lệ", () => {
    const store = new LocatorReferenceStore({ rootDir });
    const gen = new AutomationMappingGenerator({ locatorStore: store });
    const mappings = testCases.map((t) => gen.generate(t, { autoApprove: true }));
    mappings.forEach((m) => (m.status = "APPROVED"));
    const tmpOut = path.join(rootDir, "outputs", "playwright", "test-verify");
    const pw = new PlaywrightGenerator({ outputDir: tmpOut, baseUrl: "http://localhost:3100" });
    const res = pw.generate(mappings, { module: "Thiết bị" });
    assert.ok(res.projectDir, "có projectDir");
    const spec = res.files.find((f) => f.endsWith("tc001.spec.js"));
    assert.ok(spec, "sinh spec tc001");
    // mọi file .js parse được (syntax check)
    for (const f of res.files.filter((x) => x.endsWith(".js"))) {
        execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    }
});

// 7. Pipeline service end-to-end (không chạy browser)
test("PipelineService chạy end-to-end (no-run)", async () => {
    const service = new AutomationPipelineService({ rootDir, approvedFile });
    const result = await service.run({ module: "Thiết bị", autoApprove: true, run: false });
    assert.strictEqual(result.testCaseCount, 35);
    assert.strictEqual(result.readyCount, 35);
    assert.strictEqual(result.blockedCount, 0);
    assert.ok(fs.existsSync(result.mappingFile));
    assert.ok(fs.existsSync(path.join(result.playwrightProjectDir, "manifest.json")));
    assert.strictEqual(result.ran, false);
});

// 8. ExecutionReport
test("ExecutionReport tổng hợp summary", () => {
    const results = [
        new ExecutionResult({ status: "PASSED", testCaseId: "A" }),
        new ExecutionResult({ status: "FAILED", testCaseId: "B" }),
        new ExecutionResult({ status: "ERROR", testCaseId: "C" })
    ];
    const report = new ExecutionReport().build(results);
    assert.strictEqual(report.summary.total, 3);
    assert.strictEqual(report.summary.passed, 1);
    assert.strictEqual(report.summary.failed, 1);
    assert.strictEqual(report.summary.error, 1);
});

console.log(`\n=================================`);
if (failures === 0) {
    console.log(" ALL AUTOMATION TESTS PASSED ✔");
} else {
    console.log(` ${failures} FAILURE(S) ✘`);
}
console.log("=================================\n");
process.exit(failures === 0 ? 0 : 1);
