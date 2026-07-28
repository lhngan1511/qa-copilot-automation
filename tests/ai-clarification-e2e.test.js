import assert from "node:assert/strict";

process.env.NODE_OPTIONS = "--dns-result-order=ipv4first";
process.env.AI_PROVIDER = "gemini";
process.env.AI_FALLBACK_ENABLED = "false";
process.env.ENABLE_AI = "true";

await import("dotenv/config");

const { default: QACopilot } = await import("../src/QACopilot.js");

const qaCopilot = new QACopilot();
const initialResult = await qaCopilot.run("requirements/thiet-bi.md");

assert.equal(initialResult.aiAnalysis?.analysisStatus, "SUCCESS");
assert.equal(initialResult.aiAnalysis?.analysisSource, "gemini");
assert.equal(initialResult.status, "AWAITING_AI_CLARIFICATION");
assert.ok(initialResult.clarificationQuestions.length > 0);
assert.ok(initialResult.clarificationQuestions.length <= 5);
assert.deepEqual(initialResult.scenarios, []);
assert.deepEqual(initialResult.testCases, []);
assert.deepEqual(initialResult.outputs, {});

const { sessionId, artifactId } = initialResult.clarificationReview;
const artifactBeforeAnswers = qaCopilot.workflowCoordinator.findArtifact(artifactId);

artifactBeforeAnswers.questions.forEach(question => {
    assert.match(question.questionId, /^CL\d{3,}$/);
    assert.equal(typeof question.category, "string");
    assert.equal(typeof question.priority, "string");
    assert.equal(typeof question.reason, "string");
    assert.ok(Array.isArray(question.options));
    assert.ok(question.options.length >= 2);
    assert.ok(question.options.includes("Chưa xác định"));
    assert.equal(question.answer, "");
    assert.equal(question.status, "pending");
    assert.equal(question.answeredAt, null);
    assert.equal(question.answeredBy, null);
});

for (const question of artifactBeforeAnswers.questions) {
    const beforeAnswer = qaCopilot.workflowCoordinator.findArtifact(artifactId);
    const beforeSnapshot = JSON.parse(JSON.stringify(beforeAnswer.questions));
    const answer = question.options[0];

    qaCopilot.answerClarificationQuestion({
        sessionId,
        artifactId,
        questionId: question.questionId,
        answer,
        answeredBy: "e2e-reviewer"
    });

    const afterAnswer = qaCopilot.workflowCoordinator.findArtifact(artifactId);
    const updatedQuestion = afterAnswer.questions.find(
        item => item.questionId === question.questionId
    );

    assert.equal(updatedQuestion.answer, answer);
    assert.equal(updatedQuestion.status, "answered");
    assert.equal(updatedQuestion.answeredBy, "e2e-reviewer");
    assert.equal(typeof updatedQuestion.answeredAt, "string");
    assert.equal(updatedQuestion.category, question.category);
    assert.equal(updatedQuestion.priority, question.priority);
    assert.equal(updatedQuestion.reason, question.reason);
    assert.deepEqual(updatedQuestion.options, question.options);
    assert.notEqual(afterAnswer.approvalStatus, "approved");

    beforeSnapshot.forEach(previousQuestion => {
        if (previousQuestion.questionId !== question.questionId) {
            const unchangedQuestion = afterAnswer.questions.find(
                item => item.questionId === previousQuestion.questionId
            );

            assert.deepEqual(unchangedQuestion, previousQuestion);
        }
    });
}

qaCopilot.reviewClarification({
    sessionId,
    feedback: "AI clarification E2E review completed."
});
const approvalResult = qaCopilot.approveClarification({
    sessionId,
    artifactId,
    approvedBy: "e2e-reviewer"
});

assert.equal(approvalResult.artifact.approvalStatus, "approved");
assert.equal(approvalResult.session.status, "completed");

const capturedAIResult = initialResult.aiAnalysis;

qaCopilot.aiEngine = {
    async analyze() {
        return capturedAIResult;
    }
};

const requirementReviewResult = await qaCopilot.run("requirements/thiet-bi.md", {
    workflowContext: initialResult.workflowContext
});

assert.equal(requirementReviewResult.status, "AWAITING_REQUIREMENT_REVIEW");
assert.deepEqual(requirementReviewResult.scenarios, []);
assert.deepEqual(requirementReviewResult.testCases, []);
assert.deepEqual(requirementReviewResult.outputs, {});

const requirementArtifact = qaCopilot.workflowCoordinator.findArtifact(
    requirementReviewResult.requirementReview.artifactId
);

assert.equal(
    requirementArtifact.clarifications.length,
    artifactBeforeAnswers.questions.length
);

requirementArtifact.clarifications.forEach(clarification => {
    assert.match(clarification.questionId, /^CL\d{3,}$/);
    assert.equal(typeof clarification.category, "string");
    assert.equal(typeof clarification.priority, "string");
    assert.equal(typeof clarification.question, "string");
    assert.equal(typeof clarification.reason, "string");
    assert.ok(Array.isArray(clarification.options));
    assert.equal(typeof clarification.answer, "string");
    assert.equal(clarification.status, "answered");
    assert.equal(typeof clarification.answeredAt, "string");
    assert.equal(clarification.answeredBy, "e2e-reviewer");
});

console.log(
    JSON.stringify(
        {
            analysisStatus: capturedAIResult.analysisStatus,
            analysisSource: capturedAIResult.analysisSource,
            featureUnderstanding: capturedAIResult.featureUnderstanding,
            suggestedScenarioCount: capturedAIResult.suggestedScenarios.length,
            clarificationArtifactId: artifactId,
            questions: artifactBeforeAnswers.questions,
            clarificationApprovalStatus: approvalResult.artifact.approvalStatus,
            requirementReviewStatus: requirementReviewResult.status,
            requirementClarifications: requirementArtifact.clarifications,
            scenariosBeforeApproval: initialResult.scenarios.length,
            testCasesBeforeApproval: initialResult.testCases.length,
            outputsBeforeApproval: Object.keys(initialResult.outputs).length,
            scenariosAfterClarificationApproval: requirementReviewResult.scenarios.length,
            testCasesAfterClarificationApproval: requirementReviewResult.testCases.length,
            outputsAfterClarificationApproval:
                Object.keys(requirementReviewResult.outputs).length
        },
        null,
        2
    )
);

console.log("AI clarification E2E test PASSED");
