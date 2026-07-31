import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import XLSX from "xlsx";

const integrationOutputRoot = path.resolve("./outputs/integration/approved-testcase-export");
process.env.QA_COPILOT_INTEGRATION_OUTPUT_ROOT = integrationOutputRoot;
process.env.QA_COPILOT_INTEGRATION_OUTPUT_PREFIX = "INTEGRATION_approved-testcase-export";

const { exportResult } = await import("./approved-testcase-source-of-truth-test.js");

const expectedFields = [
    "testcaseId",
    "scenarioId",
    "moduleId",
    "module",
    "functionId",
    "function",
    "title",
    "objective",
    "type",
    "priority",
    "severity",
    "preconditions",
    "testData",
    "steps",
    "expectedResult",
    "reviewStatus",
    "requirementReferences",
    "coveredRules",
    "automationCandidate",
    "automationNotes",
    "source"
];

const json = JSON.parse(fs.readFileSync(exportResult.outputs.json, "utf8"));
Object.values(exportResult.outputs).forEach(outputPath => {
    assert.ok(
        path.resolve(outputPath).startsWith(`${integrationOutputRoot}${path.sep}`),
        `Integration output escaped its root: ${outputPath}`
    );
    assert.ok(
        path.basename(outputPath).startsWith("INTEGRATION_approved-testcase-export_"),
        `Integration output is missing its prefix: ${outputPath}`
    );
});
assert.ok(json.length > 0);
expectedFields.forEach(field =>
    assert.ok(Object.prototype.hasOwnProperty.call(json[0], field), `JSON missing ${field}`)
);
assert.ok(json.every(testCase => testCase.reviewStatus === "APPROVED"));
assert.ok(json.every(testCase => testCase.steps.length > 0));

const markdown = fs.readFileSync(exportResult.outputs.markdown, "utf8");
["Scenario ID", "Tình huống", "Review Status", "Function", "Severity", "Automation"].forEach(value =>
    assert.ok(markdown.includes(value), `Markdown missing ${value}`)
);
assert.ok(markdown.includes("TestCase đã chỉnh sửa khi review"));

const workbook = XLSX.readFile(exportResult.outputs.excel);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Test Cases"], {
    range: 6
});
assert.ok(rows.length > 0);
[
    "Test Case ID",
    "Scenario ID",
    "Module ID",
    "Function ID",
    "Function",
    "Severity",
    "Automation",
    "Review Status",
    "Requirement References",
    "Covered Rules"
].forEach(column =>
    assert.ok(Object.prototype.hasOwnProperty.call(rows[0], column), `Excel missing ${column}`)
);

console.log("Approved TestCase export test PASSED");
