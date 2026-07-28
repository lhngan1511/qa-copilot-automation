import assert from "node:assert/strict";

import QACopilot from "../src/QACopilot.js";

const qaCopilot = new QACopilot();
const structuredQuestions = [
    {
        id: "CL100",
        category: "Business Rule",
        priority: "High",
        question: "Khi nào dữ liệu được phép lưu?",
        reason: "Câu trả lời quyết định expected result.",
        options: ["Khi hợp lệ", "Luôn lưu", "Chưa xác định"]
    },
    {
        category: "Validation",
        priority: "Medium",
        question: "Email có bắt buộc không?",
        reason: "Câu trả lời quyết định validation testcase.",
        options: ["Có", "Không", "Chưa xác định"]
    },
    {
        id: "CL100",
        category: "Permission",
        priority: "High",
        question: "Ai được phép cập nhật?",
        reason: "Cần xác định permission testcase.",
        options: ["Quản trị viên", "Người dùng", "Chưa xác định"]
    },
    "Có cần xác nhận thao tác không?",
    "Có giới hạn độ dài không?",
    "Có cho phép ký tự đặc biệt không?"
];
const inputSnapshot = JSON.stringify(structuredQuestions);
const artifactQuestions = qaCopilot.buildClarificationQuestions(
    {
        questions: structuredQuestions
    },
    {
        questions: []
    }
);

assert.equal(artifactQuestions.length, 5);
assert.equal(JSON.stringify(structuredQuestions), inputSnapshot);
assert.equal(artifactQuestions[0].questionId, "CL100");
assert.equal(artifactQuestions[0].category, "Business Rule");
assert.equal(artifactQuestions[0].priority, "High");
assert.equal(
    artifactQuestions[0].reason,
    "Câu trả lời quyết định expected result."
);
assert.deepEqual(
    artifactQuestions[0].options,
    ["Khi hợp lệ", "Luôn lưu", "Chưa xác định"]
);
assert.equal(artifactQuestions[1].questionId, "CL001");
assert.equal(artifactQuestions[2].questionId, "CL002");
assert.equal(artifactQuestions[3].category, "General");
assert.equal(artifactQuestions[3].priority, "Medium");
assert.deepEqual(
    artifactQuestions[3].options,
    ["Có", "Không", "Chưa xác định"]
);

artifactQuestions.forEach(question => {
    assert.equal(question.answer, "");
    assert.equal(question.status, "pending");
    assert.equal(question.answeredAt, null);
    assert.equal(question.answeredBy, null);
});

const originalEnableAI = process.env.ENABLE_AI;
const originalConsoleLog = console.log;
const pipelineQuestions = structuredQuestions.slice(0, 2);

process.env.ENABLE_AI = "true";
console.log = () => {};
qaCopilot.aiEngine = {
    async analyze() {
        return {
            analysisStatus: "SUCCESS",
            analysisSource: "fake-provider",
            featureUnderstanding: "Requirement test",
            testFocus: [],
            riskAreas: [],
            suggestedScenarios: [],
            questions: pipelineQuestions,
            notes: [],
            confidence: 1
        };
    }
};

try {
    const initialResult = await qaCopilot.run("requirements/dang-nhap.md");

    assert.equal(initialResult.status, "AWAITING_AI_CLARIFICATION");
    assert.equal(initialResult.scenarios.length, 0);
    assert.equal(initialResult.testCases.length, 0);

    const { sessionId, artifactId } = initialResult.clarificationReview;
    const initialArtifact = qaCopilot.workflowCoordinator.findArtifact(artifactId);
    const initialArtifactSnapshot = JSON.parse(JSON.stringify(initialArtifact));

    assert.equal(initialArtifact.questions[0].category, "Business Rule");
    assert.deepEqual(
        initialArtifact.questions[0].options,
        ["Khi hợp lệ", "Luôn lưu", "Chưa xác định"]
    );

    qaCopilot.answerClarificationQuestion({
        sessionId,
        artifactId,
        questionId: "CL100",
        answer: "Khi hợp lệ",
        answeredBy: "reviewer"
    });

    const partiallyAnswered = qaCopilot.workflowCoordinator.findArtifact(artifactId);

    assert.equal(partiallyAnswered.questions[0].status, "answered");
    assert.equal(partiallyAnswered.questions[0].category, "Business Rule");
    assert.equal(partiallyAnswered.questions[0].reason, initialArtifact.questions[0].reason);
    assert.deepEqual(partiallyAnswered.questions[0].options, initialArtifact.questions[0].options);
    assert.deepEqual(
        partiallyAnswered.questions[1],
        initialArtifactSnapshot.questions[1]
    );

    assert.throws(
        () =>
            qaCopilot.approveClarification({
                sessionId,
                artifactId,
                approvedBy: "reviewer"
            }),
        /All clarification questions must be answered/
    );

    assert.notEqual(
        qaCopilot.workflowCoordinator.findArtifact(artifactId).approvalStatus,
        "approved"
    );

    qaCopilot.answerClarificationQuestion({
        sessionId,
        artifactId,
        questionId: "CL001",
        answer: "Có",
        answeredBy: "reviewer"
    });
    qaCopilot.reviewClarification({
        sessionId,
        feedback: "Clarifications hợp lệ"
    });
    qaCopilot.approveClarification({
        sessionId,
        artifactId,
        approvedBy: "reviewer"
    });

    const approvedArtifact = qaCopilot.workflowCoordinator.findArtifact(artifactId);

    assert.equal(approvedArtifact.approvalStatus, "approved");
    assert.equal(approvedArtifact.questions[0].category, "Business Rule");
    assert.equal(approvedArtifact.questions[1].category, "Validation");

    const resumedResult = await qaCopilot.run("requirements/dang-nhap.md", {
        workflowContext: initialResult.workflowContext
    });

    assert.equal(resumedResult.status, "AWAITING_REQUIREMENT_REVIEW");
    assert.equal(resumedResult.scenarios.length, 0);
    assert.equal(resumedResult.testCases.length, 0);

    const requirementArtifact = qaCopilot.workflowCoordinator.findArtifact(
        resumedResult.requirementReview.artifactId
    );
    const approvedClarification = requirementArtifact.clarifications[0];

    assert.deepEqual(
        {
            questionId: approvedClarification.questionId,
            category: approvedClarification.category,
            priority: approvedClarification.priority,
            question: approvedClarification.question,
            reason: approvedClarification.reason,
            options: approvedClarification.options,
            answer: approvedClarification.answer,
            status: approvedClarification.status,
            answeredBy: approvedClarification.answeredBy
        },
        {
            questionId: "CL100",
            category: "Business Rule",
            priority: "High",
            question: "Khi nào dữ liệu được phép lưu?",
            reason: "Câu trả lời quyết định expected result.",
            options: ["Khi hợp lệ", "Luôn lưu", "Chưa xác định"],
            answer: "Khi hợp lệ",
            status: "answered",
            answeredBy: "reviewer"
        }
    );
    assert.equal(typeof approvedClarification.answeredAt, "string");
} finally {
    console.log = originalConsoleLog;

    if (originalEnableAI === undefined) {
        delete process.env.ENABLE_AI;
    } else {
        process.env.ENABLE_AI = originalEnableAI;
    }
}

console.log("Structured clarification artifact test PASSED");
