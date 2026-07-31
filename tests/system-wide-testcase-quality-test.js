import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import QACopilot from "../src/QACopilot.js";

const repositoryRoot = process.cwd();
const originalCwd = process.cwd();
const originalAI = process.env.ENABLE_AI;
const originalLog = console.log;
process.env.ENABLE_AI = "false";
console.log = () => {};
const requirementFiles = [
    "requirements/thiet-bi.md",
    "requirements/dang-nhap.md",
    "requirements/bang-dieu-khien.md",
    "requirements/danh-muc-don-vi-tinh.md"
];
const results = {};

function visibleContent(testCase) {
    const fields = Object.entries(testCase.testData?.fields ?? {}).flatMap(([name, field]) => [
        name,
        field?.instruction
    ]);
    return [
        testCase.title,
        testCase.scenario,
        testCase.testScenario,
        ...testCase.preconditions,
        ...testCase.steps.flatMap(step => [step.action, step.expected]),
        testCase.expectedResult,
        ...fields,
        testCase.testData?.recordState,
        testCase.testData?.dataState,
        testCase.testData?.requirement
    ]
        .filter(Boolean)
        .join(" ");
}

try {
    for (const requirementFile of requirementFiles) {
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-system-quality-"));
        process.chdir(workDir);
        const app = new QACopilot();
        const absoluteRequirement = path.join(repositoryRoot, requirementFile);
        let result = await app.run(absoluteRequirement, {
            productionWorkflow: true,
            outputRoot: path.join(workDir, "outputs", "production")
        });
        const clarification = result.workflowContext.clarificationReview;
        app.reviewClarification({ sessionId: clarification.sessionId });
        app.approveClarification({
            sessionId: clarification.sessionId,
            artifactId: clarification.artifactId,
            approvedBy: "quality-test"
        });
        result = await app.run(absoluteRequirement, {
            productionWorkflow: true,
            workflowContext: result.workflowContext,
            outputRoot: path.join(workDir, "outputs", "production")
        });
        results[requirementFile] = result.testCases;

        assert.ok(result.testCases.length > 0, `${requirementFile} has no reviewable testcase`);
        const signatures = new Set();
        result.testCases.forEach(testCase => {
            const visible = visibleContent(testCase);
            assert.doesNotMatch(
                visible,
                /\b(?:BR|FUNC|MOD)[-_]?\d+\b|\bRule[-_\s]*\d+\b|\b(?:condition|source|ruleId)\s*:/i
            );
            assert.ok(testCase.steps.length > 0);
            assert.equal(
                testCase.steps.some(step =>
                    /^(Mở màn hình hoặc chức năng|Thực hiện chức năng|Thực hiện thao tác|Thiết lập điều kiện kiểm thử|Không xác nhận thao tác|Kiểm tra hệ thống|Thực hiện lưu dữ liệu)$/i.test(
                        step.action
                    )
                ),
                false
            );
            assert.ok(testCase.expectedResult.trim());
            assert.ok(
                [
                    "POSITIVE",
                    "VALIDATION",
                    "NEGATIVE",
                    "BUSINESS_RULE",
                    "PERMISSION",
                    "BOUNDARY",
                    "DATA_INTEGRITY"
                ].includes(testCase.type)
            );
            if (testCase.type === "PERMISSION") {
                assert.match(
                    String(testCase.sourceItem?.content ?? testCase.requirementReference),
                    /quyền|vai trò|được phép|không được phép/i
                );
            }
            if (testCase.type === "BOUNDARY") {
                const source = String(
                    testCase.sourceItem?.content ?? testCase.requirementReference
                ).replace(/^\s*\[?(?:BR|VR|PR)[\s_-]*\d+\]?\s*(?:[:\-_–—]\s*)?/i, "");
                assert.match(source, /\d|<=|>=|<|>|ngày bắt đầu.*ngày kết thúc/i);
            }
            const effectiveFields = new Set();
            Object.keys(testCase.testData?.fields ?? {}).forEach(name => {
                const key = name.toLocaleLowerCase("vi");
                assert.equal(effectiveFields.has(key), false, `Conflicting field: ${name}`);
                effectiveFields.add(key);
            });
            const signature = [
                testCase.module,
                testCase.function,
                testCase.type,
                testCase.ruleClassification,
                Object.entries(testCase.testData?.fields ?? {})
                    .filter(([, field]) => field?.purpose !== "VALID")
                    .map(([name, field]) => `${name}:${field?.purpose}`)
                    .sort()
                    .join(","),
                testCase.expectedResult
            ]
                .join("|")
                .toLocaleLowerCase("vi");
            assert.equal(signatures.has(signature), false, `Duplicate testcase: ${testCase.id}`);
            signatures.add(signature);
        });

        fs.rmSync(workDir, { recursive: true, force: true });
    }

    const deviceFunctions = results["requirements/thiet-bi.md"].map(testCase => testCase.function);
    assert.ok(deviceFunctions.some(value => /thêm/i.test(value)));
    assert.ok(deviceFunctions.some(value => /sửa|cập nhật/i.test(value)));
    assert.ok(deviceFunctions.some(value => /xóa/i.test(value)));
    assert.ok(deviceFunctions.some(value => /tìm kiếm/i.test(value)));
    assert.ok(results["requirements/dang-nhap.md"].some(testCase => testCase.type === "POSITIVE"));
    assert.ok(results["requirements/bang-dieu-khien.md"].some(testCase => testCase.type === "POSITIVE"));

    originalLog("System-wide testcase quality test PASSED");
} finally {
    process.chdir(originalCwd);
    console.log = originalLog;
    if (originalAI === undefined) delete process.env.ENABLE_AI;
    else process.env.ENABLE_AI = originalAI;
}
