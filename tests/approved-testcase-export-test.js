import fs from "node:fs";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { exportResult } from "./approved-testcase-source-of-truth-test.js";

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
    "requirementReferences",
    "coveredRules",
    "automationCandidate",
    "automationNotes",
    "source"
];

const json = JSON.parse(fs.readFileSync(exportResult.outputs.json, "utf8"));
assert.ok(json.length > 0);
expectedFields.forEach(field =>
    assert.ok(Object.prototype.hasOwnProperty.call(json[0], field), `JSON missing ${field}`)
);
assert.ok(json[0].steps.every(step => step && typeof step === "object"));

const markdown = fs.readFileSync(exportResult.outputs.markdown, "utf8");
["Scenario ID", "Function ID", "Function", "Severity", "Automation"].forEach(value =>
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
    "Requirement References",
    "Covered Rules"
].forEach(column =>
    assert.ok(Object.prototype.hasOwnProperty.call(rows[0], column), `Excel missing ${column}`)
);

console.log("Approved TestCase export test PASSED");
