import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";
import ApprovedTestCaseMapper from "../src/mappers/ApprovedTestCaseMapper.js";
import QACopilotApplicationService from "../src/services/QACopilotApplicationService.js";
import JsonExporter from "../src/exporters/JsonExporter.js";
import ExcelExporter from "../src/exporters/ExcelExporter.js";
import { DATA_REQUIRED, READY, resolveExecutionReadiness } from "../src/utils/TestDataReadiness.js";

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
    ["fields", "constraints", "requirement", "value", "requiresTesterInput"].forEach(key =>
        assert.ok(Object.hasOwn(testCase.testData, key), `Canonical TestData missing ${key}`)
    );
    assert.equal(typeof testCase.testData.fields, "object");
    assert.equal(typeof testCase.testData.constraints, "object");
    assert.equal(testCase.testData.value, "");
    assert.equal(typeof testCase.testData.requiresTesterInput, "boolean");
});
assert.equal(generated[0].executionReadiness, DATA_REQUIRED);
assert.equal(generated[1].executionReadiness, DATA_REQUIRED);
assert.deepEqual(generated[0].testData.fields["Mã hồ sơ"], {
    value: "",
    purpose: "EMPTY"
});
assert.equal(generated[1].testData.fields["Mã hồ sơ"].purpose, "DUPLICATE");
assert.equal(generated[1].testData.fields["Mã hồ sơ"].value, null);
assert.equal(generated[1].testData.fields["Mã hồ sơ"].requiresTesterInput, true);
assert.match(generated[1].testData.dataState, /đã tồn tại/);
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
                          fields: {
                              ...testCase.testData.fields,
                              "Tên hồ sơ": { value: "Hồ sơ tester", purpose: "VALID" }
                          },
                          requirement: "",
                          requiresTesterInput: false
                      }
                  }
                : testCase
        )
    }
});
assert.equal(edited.approvalStatus, "pending");
assert.equal(edited.testCases[0].testData.fields["Tên hồ sơ"].value, "Hồ sơ tester");
assert.equal(edited.testCases[0].executionReadiness, READY);
assert.equal(edited.testCases[1].executionReadiness, DATA_REQUIRED);

const approved = {
    ...edited,
    approvalStatus: "approved",
    testCases: edited.testCases.map(testCase => ({ ...testCase, reviewStatus: "APPROVED" }))
};
const approvedCases = new ApprovedTestCaseMapper().map(approved);
assert.equal(approvedCases[1].executionReadiness, DATA_REQUIRED);

const outputRoot = path.resolve("outputs/integration/tester-owned-test-data");
const jsonPath = path.join(outputRoot, "approved-testcases.json");
const excelPath = path.join(outputRoot, "approved-testcases.xlsx");
new JsonExporter().export(approvedCases, jsonPath);
new ExcelExporter().export(approvedCases, excelPath);

const exportedJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
assert.deepEqual(exportedJson[0].testData, approvedCases[0].testData);
assert.equal(exportedJson[0].executionReadiness, READY);
assert.equal(exportedJson[1].executionReadiness, DATA_REQUIRED);

const workbook = XLSX.readFile(excelPath);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Test Cases"], { range: 6 });
assert.match(rows[0]["Dữ liệu đầu vào"], /Mã hồ sơ:.*Để trống/);
assert.match(rows[0]["Dữ liệu đầu vào"], /Tên hồ sơ: Hồ sơ tester \(Hợp lệ\)/);

console.log("Tester-owned Test Data: PASS");
