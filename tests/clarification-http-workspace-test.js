import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startTestServer } from "./http-test-helpers.js";

const originalEnableAI = process.env.ENABLE_AI;
process.env.ENABLE_AI = "true";
const api = await startTestServer();
process.env.ENABLE_AI = "true";
api.app.locals.dependencies.qaCopilot.aiEngine = {
    async analyze() {
        return {
            analysisStatus: "SUCCESS",
            analysisSource: "mock",
            featureUnderstanding: "Fixture",
            testFocus: [],
            riskAreas: [],
            suggestedScenarios: [],
            questions: [
                {
                    id: "CL001",
                    category: "Business Rule",
                    priority: "High",
                    question: "Có cần xác nhận trước khi lưu?",
                    reason: "Xác định expected result.",
                    options: ["Có", "Không", "Chưa xác định"]
                },
                {
                    id: "CL002",
                    category: "Validation",
                    priority: "Medium",
                    question: "Trường nào bắt buộc?",
                    reason: "Xác định validation.",
                    options: ["Tất cả", "Không", "Chưa xác định"]
                }
            ],
            notes: [],
            confidence: 1
        };
    }
};

try {
    const requirementFile = path.join(api.dataDir, "clarification.md");
    fs.writeFileSync(requirementFile, "# Đăng nhập\n\nNgười dùng đăng nhập.", "utf8");
    const created = await api.request("POST", "/api/workflows", { requirementFile });
    assert.equal(created.body.data.status, "AWAITING_AI_CLARIFICATION");
    const { currentStage, workflowContext } = created.body.data;
    const stage = workflowContext[currentStage];

    const partial = await api.request(
        "POST",
        `/api/workflows/${stage.sessionId}/clarifications/CL001`,
        { answer: "Có", answeredBy: "tester" }
    );
    assert.equal(partial.status, 200);
    assert.equal(partial.body.data.clarificationStatus.pending, 1);

    const blocked = await api.request("POST", `/api/workflows/${stage.sessionId}/approve`, {
        artifactId: stage.artifactId,
        approvedBy: "tester"
    });
    assert.equal(blocked.status, 409);

    const complete = await api.request(
        "POST",
        `/api/workflows/${stage.sessionId}/clarifications/CL002`,
        { answer: "Tất cả", answeredBy: "tester" }
    );
    assert.equal(complete.body.data.clarificationStatus.isFullyAnswered, true);

    const approved = await api.request("POST", `/api/workflows/${stage.sessionId}/approve`, {
        artifactId: stage.artifactId,
        approvedBy: "tester"
    });
    assert.equal(approved.status, 200);

    const resumed = await api.request("POST", `/api/workflows/${stage.sessionId}/resume`, {});
    assert.equal(resumed.body.data.status, "AWAITING_REQUIREMENT_REVIEW");
} finally {
    await api.close();
    if (originalEnableAI === undefined) delete process.env.ENABLE_AI;
    else process.env.ENABLE_AI = originalEnableAI;
}

console.log("Clarification HTTP workspace test PASSED");
