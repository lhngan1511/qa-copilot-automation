import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import XLSX from "xlsx";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";
import ScenarioEnrichmentEngine from "../src/engines/ScenarioEnrichmentEngine.js";
import ApprovedTestCaseMapper from "../src/mappers/ApprovedTestCaseMapper.js";
import JsonExporter from "../src/exporters/JsonExporter.js";
import ExcelExporter from "../src/exporters/ExcelExporter.js";

const generator = new TestCaseGenerator();
const scenarios = [
    {
        id: "SC001",
        module: "Thiết bị",
        feature: "Thêm thiết bị",
        title: "Thêm thiết bị",
        type: "POSITIVE",
        expectedResult: "Thiết bị được tạo",
        steps: [{ action: "Thêm thiết bị" }]
    },
    {
        id: "SC002",
        module: "Thiết bị",
        feature: "Thêm thiết bị",
        title: "BR01: Mã thiết bị phải duy nhất",
        type: "DATA_INTEGRITY",
        expectedResult: "Không lưu thiết bị",
        requirementReferences: ["BR01"],
        coveredRules: ["BR01: Mã thiết bị phải duy nhất"],
        steps: [{ action: "Nhập mã đã tồn tại" }]
    },
    {
        id: "SC003",
        module: "Thiết bị",
        feature: "Thêm thiết bị",
        title: "BR02: Tên thiết bị không được để trống",
        type: "NEGATIVE",
        expectedResult: "Hiển thị cảnh báo",
        requirementReferences: ["BR02"],
        steps: [{ action: "Để trống Tên thiết bị" }]
    },
    {
        id: "SC004",
        module: "Thiết bị",
        feature: "Xóa thiết bị",
        title: "BR03: Không được xóa thiết bị đang được sử dụng",
        type: "DATA_INTEGRITY",
        expectedResult: "Không xóa thiết bị",
        requirementReferences: ["BR03"],
        steps: [{ action: "Xóa thiết bị đang sử dụng" }]
    }
];
const enriched = new ScenarioEnrichmentEngine().enrich({
    scenarios,
    requirement: {
        module: "Thiết bị",
        features: [
            { name: "Thêm thiết bị", preconditions: [], inputs: [] },
            { name: "Xóa thiết bị", preconditions: [], inputs: [] }
        ]
    },
    knowledge: {}
});
const generated = generator.generate(enriched);

assert.equal(generated[0].title, "Thêm mới thiết bị thành công với dữ liệu hợp lệ");
assert.equal(generated[1].title, "Không cho phép thêm thiết bị có mã thiết bị đã tồn tại");
assert.equal(generated[2].title, "Hiển thị cảnh báo khi bỏ trống Tên thiết bị");
assert.equal(generated[3].title, "Không cho phép xóa thiết bị đang được sử dụng");
assert.deepEqual(generated[1].businessRuleIds, ["BR01"]);
assert.ok(generated.every(testCase => !/^\[?BR\d+/i.test(testCase.title)));

const legacyArtifact = {
    artifactType: "TEST_CASE_REVIEW",
    approvalStatus: "approved",
    testCases: [
        {
            ...generated[1],
            title: "[BR07] Mã thiết bị phải duy nhất",
            scenario: "BR07 - Mã thiết bị phải duy nhất",
            testScenario: "BR07_Mã thiết bị phải duy nhất",
            requirementReferences: ["BR07"],
            businessRuleIds: [],
            steps: [
                "1. Mở trang Thiết bị",
                { description: "Truy cập chức năng thiết bị" },
                { step: "Nhập Mã thiết bị là TB001", target: "Mã thiết bị", value: "TB001" },
                "Nhấn Lưu",
                "Lưu thông tin thiết bị",
                "Kiểm tra kết quả"
            ],
            preconditions: [
                "Người dùng đã đăng nhập vào hệ thống.",
                "người dùng đã đăng nhập",
                "Người dùng có quyền quản lý thiết bị",
                "Tài khoản có quyền truy cập chức năng Thiết bị"
            ],
            reviewStatus: "APPROVED"
        }
    ]
};
const approved = new ApprovedTestCaseMapper().map(legacyArtifact);
assert.equal(approved[0].title, "Không cho phép thêm thiết bị có mã thiết bị đã tồn tại");
assert.deepEqual(approved[0].businessRuleIds, ["BR07", "BR01"]);
assert.deepEqual(approved[0].preconditions, [
    "Người dùng đã đăng nhập vào hệ thống.",
    "Người dùng có quyền quản lý thiết bị."
]);
assert.deepEqual(
    approved[0].steps.map(step => step.action),
    ["Mở chức năng Thiết bị", "Nhập Mã thiết bị là TB001", "Nhấn Lưu"]
);

const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-natural-testcase-"));
try {
    const jsonPath = path.join(outputRoot, "approved-testcases.json");
    const excelPath = path.join(outputRoot, "approved-testcases.xlsx");
    new JsonExporter().export(approved, jsonPath);
    new ExcelExporter().export(approved, excelPath);
    const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    assert.equal(/^\[?BR\d+/i.test(json[0].title), false);
    assert.deepEqual(json[0].businessRuleIds, ["BR07", "BR01"]);
    assert.deepEqual(
        json[0].steps.map(step => step.action),
        ["Mở chức năng Thiết bị", "Nhập Mã thiết bị là TB001", "Nhấn Lưu"]
    );
    const rows = XLSX.utils.sheet_to_json(XLSX.readFile(excelPath).Sheets["Test Cases"], {
        range: 6
    });
    assert.equal(/^\[?BR\d+/i.test(rows[0]["Tình huống kiểm tra"]), false);
    assert.match(rows[0]["Requirement References"], /BR07/);
    assert.match(rows[0]["Business Rule IDs"], /BR07/);
    assert.match(rows[0]["Các bước kiểm thử"], /Nhập Mã thiết bị là TB001/);
    assert.doesNotMatch(rows[0]["Các bước kiểm thử"], /Kiểm tra kết quả/);
} finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Natural testcase content test PASSED");
