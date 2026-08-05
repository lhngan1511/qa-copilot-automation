import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import QACopilotApplicationService from "../src/services/QACopilotApplicationService.js";
import ApprovedTestCaseMapper from "../src/mappers/ApprovedTestCaseMapper.js";
import JsonExporter from "../src/exporters/JsonExporter.js";
import { READY, DATA_REQUIRED } from "../src/utils/TestDataReadiness.js";

/*
 Regression: tester-entered data arrives as testData.value (a free-text "Test
 Data" field) and must be synced into testData.fields["<tên>"].value, cleared
 of requiresTesterInput/instruction, and survive approve/export/reload.
 */

function buildTestCase(id, fields) {
    return {
        id,
        scenarioId: `SC-${id}`,
        module: "Đăng nhập",
        moduleId: "MOD001",
        function: "Đăng nhập",
        functionId: "FUNC001",
        feature: "Đăng nhập",
        title: `TestCase ${id}`,
        type: "POSITIVE",
        expectedResult: "Đăng nhập thành công",
        coveredRules: [],
        preconditions: [],
        steps: [{ order: 1, action: "Đăng nhập" }],
        testData: {
            fields: Object.fromEntries(
                Object.entries(fields).map(([name, field]) => [
                    name,
                    { value: null, purpose: "VALID", requiresTesterInput: true, instruction: `Nhập ${name} hợp lệ do tester chuẩn bị` }
                ])
            ),
            requirement: "Nhập dữ liệu hợp lệ cho các trường",
            value: "",
            requiresTesterInput: true
        }
    };
}

const tc001 = buildTestCase("TC001", {
    "Tài khoản": {},
    "Mật khẩu": {},
    "Mã xác nhận": {}
});
const tc002 = buildTestCase("TC002", {
    "Tài khoản": {},
    "Mật khẩu": {}
});

const records = new Map([
    [
        "TC-ARTIFACT",
        {
            artifactId: "TC-ARTIFACT",
            artifactType: "TEST_CASE_REVIEW",
            sessionId: "SESSION-TESTER",
            workflowId: "testcase-review",
            approvalStatus: "pending",
            testCases: [tc001, tc002]
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

// Tester fills TC001 via the Test Data textarea (testData.value).
const edited = service.editArtifact({
    sessionId: "SESSION-TESTER",
    artifactId: "TC-ARTIFACT",
    artifact: {
        ...records.get("TC-ARTIFACT"),
        testCases: [
            {
                ...tc001,
                testData: {
                    ...tc001.testData,
                    value: "Tài khoản: admin\nMật khẩu: 123456@Aa\nMã xác nhận: 1234567"
                }
            },
            { ...tc002 }
        ]
    }
});

// Per-testcase independence: TC001 values must NOT leak into TC002.
assert.equal(edited.testCases[1].testData.value, "");
assert.equal(edited.testCases[1].executionReadiness, DATA_REQUIRED);

const t1 = edited.testCases[0].testData;
assert.equal(t1.fields["Tài khoản"].value, "admin");
assert.equal(t1.fields["Mật khẩu"].value, "123456@Aa");
assert.equal(t1.fields["Mã xác nhận"].value, "1234567");
assert.equal(t1.fields["Tài khoản"].requiresTesterInput, false);
assert.equal(Object.hasOwn(t1.fields["Tài khoản"], "instruction"), false);
assert.equal(t1.fields["Tài khoản"].purpose, "VALID");
assert.equal(t1.requiresTesterInput, false);
assert.equal(edited.testCases[0].executionReadiness, READY);

// testData.value is derived from fields, not an independent source.
assert.equal(t1.value, "Tài khoản: admin\nMật khẩu: 123456@Aa\nMã xác nhận: 1234567");

// Approve -> export JSON -> reload artifact -> values persist.
const approved = {
    ...edited,
    approvalStatus: "approved",
    testCases: edited.testCases.map(testCase => ({ ...testCase, reviewStatus: "APPROVED" }))
};
const approvedCases = new ApprovedTestCaseMapper().map(approved);

const outputRoot = path.resolve("outputs/integration/test-data-value-sync");
const jsonPath = path.join(outputRoot, "approved-testcases.json");
fs.mkdirSync(outputRoot, { recursive: true });
new JsonExporter().export(approvedCases, jsonPath);

const reloaded = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const reloadedTc001 = reloaded.find(item => item.id === "TC001");
assert.equal(reloadedTc001.testData.fields["Tài khoản"].value, "admin");
assert.equal(reloadedTc001.testData.fields["Mật khẩu"].value, "123456@Aa");
assert.equal(reloadedTc001.testData.fields["Mã xác nhận"].value, "1234567");
assert.equal(reloadedTc001.executionReadiness, READY);

// Reloading the stored artifact also keeps the values.
const stored = records.get("TC-ARTIFACT");
const storedTc001 = stored.testCases.find(item => item.id === "TC001");
assert.equal(storedTc001.testData.fields["Tài khoản"].value, "admin");
assert.equal(storedTc001.testData.fields["Mật khẩu"].value, "123456@Aa");
assert.equal(storedTc001.testData.fields["Mã xác nhận"].value, "1234567");

console.log("Test Data value->fields sync: PASS");
