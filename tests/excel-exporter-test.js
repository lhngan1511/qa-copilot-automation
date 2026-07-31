import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import XLSX from "xlsx";
import ExcelExporter from "../src/exporters/ExcelExporter.js";
import TestCase from "../src/models/TestCase.js";

const expectedColumns = [
    "STT",
    "Test Case ID",
    "Chức năng",
    "Loại kiểm tra",
    "Tình huống kiểm tra",
    "Dữ liệu đầu vào",
    "Các bước thực hiện",
    "Kết quả mong đợi",
    "Kết quả thực tế",
    "Trạng thái"
];
const removedColumns = [
    "Scenario ID",
    "Module ID",
    "Module",
    "Function ID",
    "Function",
    "Mục tiêu kiểm thử",
    "Tiền điều kiện",
    "Chuẩn bị dữ liệu",
    "Dữ liệu kiểm thử",
    "Các bước kiểm thử",
    "Review Status",
    "Type",
    "Priority",
    "Severity",
    "Automation",
    "Automation Notes",
    "Requirement References",
    "Covered Rules",
    "Business Rule IDs",
    "Source"
];
const testCase = new TestCase();
testCase.id = "TC001";
testCase.testcaseId = "TC001";
testCase.scenarioId = "SC001";
testCase.moduleId = "MOD001";
testCase.module = "Thiết bị";
testCase.functionId = "FUNC001";
testCase.function = "Quản lý thiết bị";
testCase.feature = "Thêm thiết bị";
testCase.title = "Thêm thiết bị thành công";
testCase.scenario = "Thêm thiết bị với dữ liệu hợp lệ";
testCase.type = "POSITIVE";
testCase.preconditions = ["Người dùng đã đăng nhập"];
testCase.setupData = { internal: "Không xuất" };
testCase.testData = {
    fields: { "Mã thiết bị": { value: "TB001", purpose: "VALID" } }
};
testCase.steps = [{ order: 1, action: "Mở chức năng Thiết bị" }];
testCase.expectedResult = "Thiết bị được tạo thành công";
testCase.reviewStatus = "APPROVED";
testCase.automationNotes = "Internal automation note";
testCase.requirementReferences = ["REQ-001"];
testCase.coveredRules = ["Mã thiết bị duy nhất"];
testCase.businessRuleIds = ["BR01"];
testCase.source = "Requirement Intelligence Engine";

const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-excel-exporter-"));
const outputPath = path.join(outputRoot, "thiet-bi-approved-testcases.xlsx");

try {
    new ExcelExporter().export([testCase], outputPath);
    const workbook = XLSX.readFile(outputPath);
    assert.deepEqual(workbook.SheetNames, ["Test Cases"]);
    const worksheet = workbook.Sheets["Test Cases"];
    const header = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        range: 6,
        blankrows: false
    })[0];
    const rows = XLSX.utils.sheet_to_json(worksheet, { range: 6 });

    assert.deepEqual(header, expectedColumns);
    removedColumns.forEach(column => assert.equal(header.includes(column), false));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]["Test Case ID"], "TC001");
    assert.equal(rows[0]["Chức năng"], "Thêm thiết bị");
    assert.equal(rows[0]["Loại kiểm tra"], "POSITIVE");
    assert.match(rows[0]["Dữ liệu đầu vào"], /Mã thiết bị: TB001/);
    assert.match(rows[0]["Các bước thực hiện"], /Mở chức năng Thiết bị/);
    assert.equal(worksheet["!autofilter"].ref, "A7:J8");
    assert.deepEqual(worksheet["!merges"], [XLSX.utils.decode_range("A1:J1")]);

    console.log("Excel exporter tester-facing columns test PASSED");
} finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
}
