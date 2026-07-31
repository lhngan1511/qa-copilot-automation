import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import XLSX from "xlsx";
import QACopilot from "../src/QACopilot.js";

const previousAI = process.env.ENABLE_AI;
const originalLog = console.log;
process.env.ENABLE_AI = "false";
console.log = () => {};
const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-post-ai04-"));

try {
    const app = new QACopilot();
    let result = await app.run("./requirements/thiet-bi.md", {
        productionWorkflow: true,
        outputRoot
    });
    const clarification = result.workflowContext.clarificationReview;
    app.reviewClarification({ sessionId: clarification.sessionId });
    app.approveClarification({
        sessionId: clarification.sessionId,
        artifactId: clarification.artifactId,
        approvedBy: "quality-test"
    });

    result = await app.run("./requirements/thiet-bi.md", {
        productionWorkflow: true,
        workflowContext: result.workflowContext,
        outputRoot
    });
    assert.equal(result.status, "AWAITING_TEST_CASE_REVIEW");
    assert.ok(result.testCases.length >= 6);
    assert.ok(result.testCases.every(testCase => testCase.steps.length > 0));
    assert.ok(
        result.testCases.every(testCase =>
            testCase.steps.every(
                step =>
                    !/Thiết lập điều kiện trước|Chuẩn bị dữ liệu kiểm thử|Thực hiện thao tác|Kiểm tra kết quả$/i.test(
                        step.action
                    )
            )
        )
    );
    assert.ok(
        result.testCases.every(testCase =>
            testCase.preconditions.every(
                value => !/đang ở màn hình|quyền truy cập màn hình/i.test(value)
            )
        )
    );
    assert.ok(
        result.testCases.every(
            testCase =>
                !/\bBR\d+\b|Chưa có đủ dữ liệu|theo rule|xử lý đúng theo yêu cầu/i.test(
                    `${testCase.title} ${testCase.expectedResult}`
                )
        )
    );

    const tc006 = result.testCases.find(testCase => testCase.id === "TC006");
    assert.ok(tc006);
    assert.ok(tc006.steps.length > 0);
    assert.deepEqual(tc006.preconditions, [
        "Người dùng đã đăng nhập vào hệ thống.",
        "Người dùng có quyền thêm thiết bị."
    ]);
    assert.ok(tc006.steps.some(step => step.action === "Chọn một Loại thiết bị hợp lệ"));
    assert.ok(tc006.steps.some(step => step.action === "Lưu thông tin thiết bị"));
    assert.equal(tc006.testData.fields["Tên thiết bị"].purpose, "EMPTY");
    assert.match(tc006.expectedResult, /Hệ thống không lưu thiết bị mới/);

    const reviewStage = result.workflowContext.testCaseReview;
    const artifact = app.workflowCoordinator.findArtifact(reviewStage.artifactId);
    artifact.testCases = artifact.testCases.map(testCase => ({
        ...testCase,
        reviewStatus: "APPROVED"
    }));
    app.workflowCoordinator.saveArtifact(artifact);
    app.reviewTestCase({ sessionId: reviewStage.sessionId });
    app.approveTestCase({
        sessionId: reviewStage.sessionId,
        artifactId: reviewStage.artifactId,
        approvedBy: "quality-test"
    });

    result = await app.run("./requirements/thiet-bi.md", {
        productionWorkflow: true,
        workflowContext: result.workflowContext,
        outputRoot
    });
    assert.equal(result.status, "COMPLETED");
    const json = JSON.parse(fs.readFileSync(result.outputs.json, "utf8"));
    assert.ok(json.every(testCase => testCase.steps.length > 0));
    assert.ok(json.every(testCase => testCase.testData?.fields));
    const workbook = XLSX.readFile(result.outputs.excel);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Test Cases"], { range: 6 });
    assert.equal(rows.length, json.length);
    assert.ok(rows.every(row => row["Các bước thực hiện"]));
    assert.ok(rows.every(row => row["Kết quả mong đợi"]));

    originalLog("Post AI-04 production quality test PASSED");
} finally {
    console.log = originalLog;
    if (previousAI === undefined) delete process.env.ENABLE_AI;
    else process.env.ENABLE_AI = previousAI;
    fs.rmSync(outputRoot, { recursive: true, force: true });
}
