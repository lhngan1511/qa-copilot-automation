import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";
import ApprovedTestCaseMapper from "../src/mappers/ApprovedTestCaseMapper.js";
import QACopilotApplicationService from "../src/services/QACopilotApplicationService.js";
import JsonExporter from "../src/exporters/JsonExporter.js";
import ExcelExporter from "../src/exporters/ExcelExporter.js";
import {
    DATA_REQUIRED,
    READY,
    normalizeTestData,
    resolveExecutionReadiness
} from "../src/utils/TestDataReadiness.js";

const generated = new TestCaseGenerator().generate([
    {
        id: "SC001",
        module: "Quản lý hồ sơ",
        moduleId: "MOD001",
        feature: "Tạo hồ sơ",
        function: "Tạo hồ sơ",
        functionId: "FUNC001",
        title: "Kiểm tra Mã hồ sơ bắt buộc",
        type: "NEGATIVE",
        sourceItems: [
            {
                content: "Mã hồ sơ không được để trống",
                source: "REQUIRED_VALIDATION"
            }
        ],
        inputDefinitions: [
            { name: "Mã hồ sơ", required: true },
            { name: "Tên hồ sơ", required: true }
        ],
        preconditions: [],
        steps: [],
        expectedResults: ["Không lưu hồ sơ khi thiếu Mã hồ sơ"]
    },
    {
        id: "SC002",
        module: "Quản lý hồ sơ",
        moduleId: "MOD001",
        feature: "Tạo hồ sơ",
        function: "Tạo hồ sơ",
        functionId: "FUNC001",
        title: "Kiểm tra Mã hồ sơ duy nhất",
        type: "DATA_INTEGRITY",
        sourceItems: [{ content: "Mã hồ sơ không được trùng", source: "BUSINESS_RULE" }],
        inputDefinitions: [{ name: "Mã hồ sơ", required: true }],
        preconditions: [],
        steps: [],
        expectedResults: ["Không lưu hồ sơ có mã trùng"]
    }
]);

assert.equal(generated.length, 2);
generated.forEach(testCase => {
    assert.deepEqual(Object.keys(testCase.testData), ["requirement", "value"]);
    assert.equal(testCase.testData.value, "");
    assert.equal(testCase.executionReadiness, DATA_REQUIRED);
});
assert.match(generated[0].testData.requirement, /Mã hồ sơ/);
assert.match(generated[1].testData.requirement, /đã tồn tại/);
assert.doesNotMatch(JSON.stringify(generated), /TB001|user01|DEVICE_|VALID_VALUE|_EXISTING_001/);

assert.equal(resolveExecutionReadiness({ requirement: "", value: "" }), READY);
assert.equal(
    resolveExecutionReadiness({ requirement: "Sử dụng mã đã tồn tại", value: "" }),
    DATA_REQUIRED
);
assert.equal(
    resolveExecutionReadiness({ requirement: "Sử dụng mã đã tồn tại", value: "HS-REAL-42" }),
    READY
);

const records = new Map([
    [
        "TC-ARTIFACT",
        {
            artifactId: "TC-ARTIFACT",
            artifactType: "TEST_CASE_REVIEW",
            sessionId: "SESSION-TESTER",
            workflowId: "testcase-review",
            approvalStatus: "pending",
            testCases: generated
        }
    ]
]);
const sessions = new Map([["SESSION-TESTER", { sessionId: "SESSION-TESTER" }]]);
const coordinator = {
    findSession: id => sessions.get(id) ?? null,
    findArtifact: id => records.get(id) ?? null,
    saveArtifact: artifact => {
        records.set(artifact.artifactId, structuredClone(artifact));
        return structuredClone(artifact);
    }
};
const service = new QACopilotApplicationService({
    qaCopilot: { workflowCoordinator: coordinator }
});
const edited = service.editArtifact({
    sessionId: "SESSION-TESTER",
    artifactId: "TC-ARTIFACT",
    artifact: {
        ...records.get("TC-ARTIFACT"),
        testCases: generated.map((testCase, index) =>
            index === 0
                ? {
                      ...testCase,
                      testData: {
                          ...testCase.testData,
                          value: "HS-REAL-42"
                      }
                  }
                : testCase
        )
    }
});
assert.equal(edited.approvalStatus, "pending");
assert.equal(edited.testCases[0].testData.value, "HS-REAL-42");
assert.equal(edited.testCases[0].executionReadiness, READY);
assert.equal(edited.testCases[1].executionReadiness, DATA_REQUIRED);

const approved = {
    ...edited,
    approvalStatus: "approved"
};
const approvedCases = new ApprovedTestCaseMapper().map(approved);
assert.equal(approvedCases[1].executionReadiness, DATA_REQUIRED);

const outputRoot = path.resolve("outputs/integration/tester-owned-test-data");
const jsonPath = path.join(outputRoot, "approved-testcases.json");
const excelPath = path.join(outputRoot, "approved-testcases.xlsx");
new JsonExporter().export(approvedCases, jsonPath);
new ExcelExporter().export(approvedCases, excelPath);

const exportedJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
assert.deepEqual(
    exportedJson[0].testData,
    normalizeTestData({ requirement: generated[0].testData.requirement, value: "HS-REAL-42" })
);
assert.equal(exportedJson[0].executionReadiness, READY);
assert.equal(exportedJson[1].executionReadiness, DATA_REQUIRED);

const workbook = XLSX.readFile(excelPath);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Test Cases"], { range: 6 });
assert.match(rows[0]["Dữ liệu kiểm thử"], /Yêu cầu dữ liệu:/);
assert.match(rows[0]["Dữ liệu kiểm thử"], /Giá trị tester: HS-REAL-42/);

console.log("Tester-owned Test Data: PASS");
