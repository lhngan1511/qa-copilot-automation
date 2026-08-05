import assert from "node:assert/strict";
import fs from "node:fs";
import QACopilotApplicationService from "../src/services/QACopilotApplicationService.js";
import ApprovedTestCaseMapper from "../src/mappers/ApprovedTestCaseMapper.js";
import JsonExporter from "../src/exporters/JsonExporter.js";
import { READY, DATA_REQUIRED } from "../src/utils/TestDataReadiness.js";

function makeTestCase(id, fields) {
    return {
        id,
        testcaseId: id,
        scenarioId: `SC-${id}`,
        module: "Đăng nhập",
        moduleId: "MOD001",
        function: "Đăng nhập",
        feature: "Đăng nhập",
        title: `TestCase ${id}`,
        type: "POSITIVE",
        expectedResult: "Đăng nhập thành công",
        reviewStatus: "PENDING",
        executable: false,
        automationHints: { executable: false },
        steps: [{ order: 1, action: "Đăng nhập" }],
        testData: {
            fields: Object.fromEntries(
                Object.entries(fields).map(([name, field]) => [
                    name,
                    field.purpose === "EMPTY"
                        ? { value: "", purpose: "EMPTY" }
                        : {
                              value: field.value ?? "",
                              purpose: field.purpose ?? "VALID",
                              requiresTesterInput: field.value ? false : true,
                              ...(field.value
                                  ? {}
                                  : { instruction: `Nhập ${name} hợp lệ` })
                          }
                ])
            ),
            requirement: "Nhập dữ liệu hợp lệ",
            value: "",
            requiresTesterInput: true
        }
    };
}

const tc001 = makeTestCase("TC001", {
    "Tài khoản": { purpose: "EMPTY", value: "" },
    "Mật khẩu": { purpose: "VALID" },
    "Mã xác nhận": { purpose: "VALID" }
});
const tc002 = makeTestCase("TC002", {
    "Tài khoản": { purpose: "VALID" },
    "Mật khẩu": { purpose: "VALID" }
});
// TC005 with existing value A
const tc005 = makeTestCase("TC005", {
    "Tài khoản": { purpose: "VALID", value: "admin" },
    "Mật khẩu": { purpose: "VALID", value: "AAAA" }
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
            testCases: [tc001, tc002, tc005]
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
    qaCopilot: {
        workflowCoordinator: coordinator,
        buildTestCaseReviewSummary: testCases => ({
            total: testCases.length,
            byType: {},
            byFeature: {},
            bySeverity: {},
            automationCandidates: 0
        })
    }
});

const result = service.updateTestCaseReview({
    sessionId: "SESSION-TESTER",
    artifactId: "TC-ARTIFACT",
    testCases: [
        // TC001: EMPTY field + VALID fields in one textarea
        {
            ...tc001,
            testData: {
                ...tc001.testData,
                value: "Tài khoản: admin\nMật khẩu: 123456@Aa\nMã xác nhận: 112222"
            }
        },
        tc002,
        // TC005: edit A -> B
        {
            ...tc005,
            testData: {
                ...tc005.testData,
                value: "Tài khoản: admin\nMật khẩu: BBBB"
            }
        }
    ]
});

const apiTc001 = result.testCases.find(t => t.id === "TC001");
assert.equal(apiTc001.testData.fields["Tài khoản"].value, "", "EMPTY field must stay empty");
assert.equal(apiTc001.testData.fields["Tài khoản"].purpose, "EMPTY");
assert.equal(apiTc001.testData.fields["Mật khẩu"].value, "123456@Aa");
assert.equal(apiTc001.testData.fields["Mã xác nhận"].value, "112222");
assert.equal(apiTc001.executionReadiness, READY);

const apiTc005 = result.testCases.find(t => t.id === "TC005");
assert.equal(apiTc005.testData.fields["Mật khẩu"].value, "BBBB", "edit A->B must persist B");
assert.equal(apiTc005.executionReadiness, READY);
// executable must stay false (no automation metadata)
assert.equal(apiTc005.executable, false);

// Persisted artifact
const stored = records.get("TC-ARTIFACT");
const storedTc001 = stored.testCases.find(t => t.id === "TC001");
assert.equal(storedTc001.testData.fields["Tài khoản"].value, "");
assert.equal(storedTc001.testData.fields["Mật khẩu"].value, "123456@Aa");
assert.equal(storedTc001.testData.fields["Mã xác nhận"].value, "112222");
const storedTc005 = stored.testCases.find(t => t.id === "TC005");
assert.equal(storedTc005.testData.fields["Mật khẩu"].value, "BBBB");

// Reload artifact (simulate page reload -> re-fetch from repo)
const reloadedArtifact = coordinator.findArtifact("TC-ARTIFACT");
const reloadedTc001 = reloadedArtifact.testCases.find(t => t.id === "TC001");
assert.equal(reloadedTc001.testData.fields["Tài khoản"].value, "");
assert.equal(reloadedTc001.testData.fields["Mật khẩu"].value, "123456@Aa");
assert.equal(reloadedTc001.testData.fields["Mã xác nhận"].value, "112222");
const reloadedTc005 = reloadedArtifact.testCases.find(t => t.id === "TC005");
assert.equal(reloadedTc005.testData.fields["Mật khẩu"].value, "BBBB");

// export JSON preserves values
const approved = {
    ...reloadedArtifact,
    approvalStatus: "approved",
    testCases: reloadedArtifact.testCases.map(tc => ({ ...tc, reviewStatus: "APPROVED" }))
};
const mapped = new ApprovedTestCaseMapper().map(approved);
const jsonOut = new JsonExporter().export(mapped, "/tmp/wt-019fcae2/outputs/test-case-review-edit-testdata.json");
const exported = JSON.parse(fs.readFileSync("/tmp/wt-019fcae2/outputs/test-case-review-edit-testdata.json", "utf8"));
const exTc005 = exported.find(t => t.id === "TC005");
assert.equal(exTc005.testData.fields["Mật khẩu"].value, "BBBB");

console.log("Test Case Review edit testdata: PASS");
