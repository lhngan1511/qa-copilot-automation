import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import OutputManager from "../src/managers/OutputManager.js";
import TestCaseOutputService from "../src/services/TestCaseOutputService.js";
import JsonExporter from "../src/exporters/JsonExporter.js";
import ExcelExporter from "../src/exporters/ExcelExporter.js";
import MarkdownExporter from "../src/exporters/MarkdownExporter.js";
import slugify from "../src/utils/Slug.js";

assert.equal(slugify("Thiết bị"), "thiet-bi");
assert.equal(slugify("Đăng nhập"), "dang-nhap");
assert.equal(slugify("Đơn vị tính"), "don-vi-tinh");
assert.equal(slugify("Quản lý người dùng"), "quan-ly-nguoi-dung");
assert.equal(slugify("  Thiết bị / Nội bộ  "), "thiet-bi-noi-bo");

const outputManager = new OutputManager();
outputManager.registerExporter("json", new JsonExporter());
outputManager.registerExporter("excel", new ExcelExporter());
outputManager.registerExporter("markdown", new MarkdownExporter());
const service = new TestCaseOutputService({
    outputManager,
    fileNameGenerator: { getTimestamp: () => "unused" }
});
const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-export-naming-"));
const testCase = {
    id: "TC001",
    testcaseId: "TC001",
    title: "Kiểm tra xuất file",
    steps: [{ order: 1, action: "Mở chức năng" }],
    expectedResult: "File được xuất thành công.",
    reviewStatus: "APPROVED"
};
const exportApproved = testCases =>
    service.export({
        testCases,
        outputRoot,
        outputFileName: "approved-testcases",
        formats: ["json", "markdown", "excel"]
    });

try {
    const device = exportApproved([{ ...testCase, module: "Thiết bị", function: "Thêm thiết bị" }]);
    assert.equal(path.basename(device.json), "thiet-bi-approved-testcases.json");
    assert.equal(path.basename(device.excel), "thiet-bi-approved-testcases.xlsx");
    assert.equal(path.basename(device.markdown), "thiet-bi-testcases.md");

    const login = exportApproved([{ ...testCase, module: "", function: "Đăng nhập" }]);
    assert.equal(path.basename(login.json), "dang-nhap-approved-testcases.json");
    assert.equal(path.basename(login.excel), "dang-nhap-approved-testcases.xlsx");
    assert.equal(path.basename(login.markdown), "dang-nhap-testcases.md");
    assert.equal(fs.existsSync(device.json), false);
    assert.equal(fs.existsSync(device.excel), false);
    assert.equal(fs.existsSync(device.markdown), false);

    const multiple = exportApproved([
        { ...testCase, id: "TC001", module: "Thiết bị", function: "Thêm thiết bị" },
        { ...testCase, id: "TC002", module: "Người dùng", function: "Đăng nhập" }
    ]);
    assert.equal(path.basename(multiple.json), "approved-testcases.json");
    assert.equal(path.basename(multiple.excel), "approved-testcases.xlsx");
    assert.equal(path.basename(multiple.markdown), "testcases.md");

    assert.deepEqual(fs.readdirSync(path.join(outputRoot, "json")), ["approved-testcases.json"]);
    assert.deepEqual(fs.readdirSync(path.join(outputRoot, "excel")), ["approved-testcases.xlsx"]);
    assert.deepEqual(fs.readdirSync(path.join(outputRoot, "markdown")), ["testcases.md"]);

    console.log("Export filename generation test PASSED");
} finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
}
