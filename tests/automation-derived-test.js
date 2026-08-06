import assert from "node:assert/strict";
import {
    normalizeConfidence,
    confidenceOf,
    isReady,
    dataRows,
    hasUsableData,
    hasCodegenMapping,
    runLabel,
    mappingStatus,
    allMappingSteps
} from "../web-ui/src/utils/automationDerived.js";

/* Sprint 2 — logic suy diễn cho card + drawer (Workflow 6 bước). */

// confidence
assert.equal(normalizeConfidence(0.85), 85);
assert.equal(normalizeConfidence(85), 85);
assert.equal(normalizeConfidence(100), 100);
assert.equal(normalizeConfidence(null), null);
assert.equal(confidenceOf({ stepMappings: [{ confidence: 0.9 }, { confidence: 0.95 }] }), 93);
assert.equal(confidenceOf({ stepMappings: [] }), null);
assert.equal(confidenceOf(null), null);

// isReady
assert.equal(isReady({ executionReadiness: "READY" }), true);
assert.equal(isReady({ executionReadiness: "DATA_REQUIRED" }), false);
assert.equal(isReady({}), true);
assert.equal(isReady({ testData: { fields: { "Tài khoản": { value: "" } } } }), false);
assert.equal(isReady({ testData: { fields: { "Tài khoản": { value: "admin" } } } }), true);

// dataRows: xử lý cả 3 dạng (fields object, array, inputs object)
const withFields = { testData: { fields: { "Tài khoản": { value: "admin" }, "Mật khẩu": { value: "123", requiresTesterInput: true } } } };
const fRows = dataRows(withFields);
assert.equal(fRows.length, 2);
assert.equal(fRows[0].name, "Tài khoản");
assert.equal(fRows[1].requiresTesterInput, true);

const withArray = { testData: [{ name: "Tài khoản", value: "admin" }, { name: "Mật khẩu", value: "pw" }] };
assert.deepEqual(dataRows(withArray).map(r => r.name), ["Tài khoản", "Mật khẩu"]);

const withInputs = { testData: { inputs: { "Tài khoản": "u1", "Mật khẩu": "p1" } } };
assert.deepEqual(dataRows(withInputs).map(r => r.value), ["u1", "p1"]);

// hasUsableData
assert.equal(hasUsableData({ testData: { value: "x" } }), true);
assert.equal(hasUsableData({ steps: [{ action: "a" }] }), true);
assert.equal(hasUsableData({}), false);

// hasCodegenMapping
const goodMapping = {
    stepMappings: [{ locator: "getByRole", codegenSource: "PLAYWRIGHT_CODEGEN" }],
    authenticationSetup: { steps: [{ locator: "getByLabel", codegenSource: "PLAYWRIGHT_CODEGEN" }] }
};
const mixedMapping = {
    stepMappings: [{ locator: "getByRole", codegenSource: "PLAYWRIGHT_CODEGEN" }, { locator: "X", codegenSource: "NOT_IN_CODEGEN" }]
};
assert.equal(hasCodegenMapping(goodMapping), true);
assert.equal(hasCodegenMapping(mixedMapping), false);
assert.equal(hasCodegenMapping(null), false);

// runLabel
assert.equal(runLabel({ execution: { status: "PASSED" } }).label, "Đạt");
assert.equal(runLabel({ execution: { status: "FAILED" } }).label, "Thất bại");
assert.equal(runLabel({ execution: { status: "NOT_RUN" } }).label, "Chưa chạy");
assert.equal(runLabel({}).label, "Chưa chạy");

// mappingStatus
const st = mappingStatus({
    mapping: {
        ...goodMapping,
        assertionMappings: [{ businessExpectation: "Đăng nhập thành công" }]
    },
    testData: { fields: { "Tài khoản": { value: "admin" } } },
    assertions: [{ expected: "Đăng nhập thành công" }],
    expectedResult: "Đăng nhập thành công"
});
assert.equal(st.locator, true);
assert.equal(st.data, true);
assert.equal(st.expected, true);
assert.equal(st.assertion, true);

// allMappingSteps: gộp auth + nav + business theo thứ tự
const steps = allMappingSteps({
    authenticationSetup: { steps: [{ target: "Tài khoản", locator: "L1", confidence: 0.9 }] },
    navigationChain: { steps: [{ target: "Mở menu", locator: "L2", confidence: 0.85 }] },
    stepMappings: [{ businessStep: "Bấm Đăng nhập", locator: "L3", confidence: 1 }]
});
assert.deepEqual(steps.map(s => s.kind), ["auth", "nav", "business"]);
assert.equal(steps[0].locator, "L1");
assert.equal(steps[2].confidence, 100);

console.log("Automation Derived (Sprint 2) test: PASS");
