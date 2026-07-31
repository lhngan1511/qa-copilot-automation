import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import XLSX from "xlsx";
import ApprovedTestCaseMapper from "../src/mappers/ApprovedTestCaseMapper.js";
import TestCaseReviewValidator from "../src/validators/TestCaseReviewValidator.js";
import JsonExporter from "../src/exporters/JsonExporter.js";
import ExcelExporter from "../src/exporters/ExcelExporter.js";
import MarkdownExporter from "../src/exporters/MarkdownExporter.js";

const validator = new TestCaseReviewValidator();
const mapper = new ApprovedTestCaseMapper();
const baseCase = validator.normalize({
    id: "TC001",
    module: "Thiết bị",
    feature: "Thêm thiết bị",
    function: "Thêm thiết bị",
    scenario: "Thêm thiết bị hợp lệ",
    title: "Thêm thiết bị hợp lệ",
    type: "POSITIVE",
    testData: { fields: { "Mã thiết bị": { value: "TB001", purpose: "VALID" } } },
    steps: [{ order: 1, action: "Mở chức năng Thiết bị" }],
    expectedResult: "Thiết bị được tạo thành công."
});
const casesByStatus = statuses =>
    statuses.map((reviewStatus, index) => ({
        ...structuredClone(baseCase),
        id: `TC00${index + 1}`,
        testcaseId: `TC00${index + 1}`,
        reviewStatus
    }));

const allApproved = casesByStatus(["APPROVED", "APPROVED", "APPROVED"]);
const approvedAndRemoved = casesByStatus(["APPROVED", "APPROVED", "REMOVED"]);
const pendingDecision = casesByStatus(["APPROVED", "REMOVED", "PENDING"]);
const allRemoved = casesByStatus(["REMOVED", "REMOVED", "REMOVED"]);

assert.equal(validator.validateBatch(allApproved, { requireResolved: true }), true);
assert.equal(validator.validateBatch(approvedAndRemoved, { requireResolved: true }), true);
assert.throws(
    () => validator.validateBatch(pendingDecision, { requireResolved: true }),
    error =>
        error.code === "TEST_CASE_REVIEW_UNRESOLVED" &&
        error.details?.testcaseIds?.includes("TC003")
);
assert.equal(validator.validateBatch(allRemoved, { requireResolved: true }), true);

const approvedArtifact = testCases => ({
    artifactType: "TEST_CASE_REVIEW",
    approvalStatus: "approved",
    testCases
});
const approvedOnly = mapper.map(approvedArtifact(approvedAndRemoved));
assert.deepEqual(
    approvedOnly.map(testCase => testCase.id),
    ["TC001", "TC002"]
);
const noApprovedCases = mapper.map(approvedArtifact(allRemoved));
assert.deepEqual(noApprovedCases, []);

const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-review-completion-"));
const exportCases = (testCases, prefix) => {
    const paths = {
        json: path.join(outputRoot, `${prefix}.json`),
        excel: path.join(outputRoot, `${prefix}.xlsx`),
        markdown: path.join(outputRoot, `${prefix}.md`)
    };
    new JsonExporter().export(testCases, paths.json);
    new ExcelExporter().export(testCases, paths.excel);
    new MarkdownExporter().export(testCases, paths.markdown);
    return paths;
};

try {
    const mixedPaths = exportCases(approvedOnly, "mixed-approved-testcases");
    const json = JSON.parse(fs.readFileSync(mixedPaths.json, "utf8"));
    const markdown = fs.readFileSync(mixedPaths.markdown, "utf8");
    const rows = XLSX.utils.sheet_to_json(
        XLSX.readFile(mixedPaths.excel).Sheets["Test Cases"],
        { range: 6 }
    );

    assert.deepEqual(
        json.map(testCase => testCase.id),
        ["TC001", "TC002"]
    );
    assert.equal(markdown.includes("TC003"), false);
    assert.equal(rows.some(row => row["Test Case ID"] === "TC003"), false);
    assert.equal(rows.length, 2);

    const emptyPaths = exportCases(noApprovedCases, "empty-approved-testcases");
    assert.deepEqual(JSON.parse(fs.readFileSync(emptyPaths.json, "utf8")), []);
    assert.equal(fs.readFileSync(emptyPaths.markdown, "utf8").includes("TC00"), false);
    const emptyRows = XLSX.utils.sheet_to_json(
        XLSX.readFile(emptyPaths.excel).Sheets["Test Cases"],
        { range: 6 }
    );
    assert.deepEqual(emptyRows, []);

    console.log("TestCase Review completion regression test PASSED");
} finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
}
