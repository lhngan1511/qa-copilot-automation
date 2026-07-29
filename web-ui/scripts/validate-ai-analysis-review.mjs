import assert from "node:assert/strict";
import {
    buildClarificationUpdates,
    canApproveAIAnalysis,
    parseAIAnalysisReview,
    validateClarificationAnswers
} from "../src/utils/aiAnalysisReview.js";

const review = parseAIAnalysisReview({
    workflowId: "SESSION-001",
    artifactId: "ARTIFACT-001",
    status: "AI_ANALYSIS_REVIEW_REQUIRED",
    step: "AI_ANALYSIS_REVIEW",
    approvalStatus: "pending",
    analysis: {
        module: "Module",
        purpose: "Purpose",
        functions: [],
        risks: []
    },
    clarifications: [
        {
            id: "CL001",
            required: true,
            question: "Required?",
            answer: "",
            status: "UNANSWERED",
            options: []
        },
        {
            id: "CL002",
            required: false,
            question: "Optional?",
            answer: "",
            status: "UNANSWERED",
            options: []
        }
    ],
    summary: { total: 2, answered: 0, remaining: 2 },
    allowedActions: ["ANSWER_CLARIFICATIONS", "UPDATE_AI_ANALYSIS"]
});

assert.equal(
    validateClarificationAnswers(review.clarifications, {
        CL001: "   ",
        CL002: ""
    }).CL001,
    "Câu hỏi bắt buộc cần được trả lời."
);
assert.equal(
    "CL002" in
        validateClarificationAnswers(review.clarifications, {
            CL001: "Đã rõ",
            CL002: ""
        }),
    false
);
assert.equal(
    canApproveAIAnalysis({
        review: {
            ...review,
            allowedActions: ["APPROVE_AI_ANALYSIS"],
            clarifications: [
                {
                    ...review.clarifications[0],
                    answer: "Đã rõ",
                    status: "ANSWERED"
                }
            ]
        },
        answers: { CL001: "Đã rõ" }
    }),
    true
);
assert.equal(
    canApproveAIAnalysis({
        review,
        answers: { CL001: "Đã rõ" }
    }),
    false
);
assert.equal(
    validateClarificationAnswers([{ ...review.clarifications[0], status: "UNKNOWN" }], {
        CL001: "Đã rõ"
    }).CL001,
    "Trạng thái câu hỏi không hợp lệ."
);
assert.deepEqual(
    buildClarificationUpdates(review.clarifications, {
        CL001: "  Tester answer  ",
        CL002: ""
    }),
    [{ questionId: "CL001", answer: "Tester answer", changed: true }]
);
assert.throws(
    () => parseAIAnalysisReview({ workflowId: "SESSION-001" }),
    /artifact ID|nội dung analysis/
);

console.log("AI Analysis Review frontend validation PASSED");
