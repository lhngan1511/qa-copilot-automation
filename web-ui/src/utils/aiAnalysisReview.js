export function parseAIAnalysisReview(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Phản hồi AI Analysis Review không hợp lệ.");
    }
    if (typeof value.workflowId !== "string" || !value.workflowId.trim()) {
        throw new Error("AI Analysis Review thiếu workflow ID.");
    }
    if (typeof value.artifactId !== "string" || !value.artifactId.trim()) {
        throw new Error("AI Analysis Review thiếu artifact ID.");
    }
    if (!value.analysis || typeof value.analysis !== "object") {
        throw new Error("AI Analysis Review thiếu nội dung analysis.");
    }
    if (!Array.isArray(value.clarifications) || !Array.isArray(value.allowedActions)) {
        throw new Error("AI Analysis Review có collection không hợp lệ.");
    }

    return {
        ...value,
        analysis: {
            ...value.analysis,
            functions: Array.isArray(value.analysis.functions)
                ? value.analysis.functions.map(item => ({ ...item }))
                : [],
            risks: Array.isArray(value.analysis.risks) ? [...value.analysis.risks] : []
        },
        clarifications: value.clarifications.map(item => ({
            ...item,
            options: Array.isArray(item.options) ? [...item.options] : []
        })),
        allowedActions: [...value.allowedActions]
    };
}

export function validateClarificationAnswers(clarifications, answers) {
    const errors = {};

    for (const item of Array.isArray(clarifications) ? clarifications : []) {
        const answer = typeof answers?.[item.id] === "string" ? answers[item.id].trim() : "";
        if (item.required === true && !answer) {
            errors[item.id] = "Câu hỏi bắt buộc cần được trả lời.";
        }
        if (!["ANSWERED", "UNANSWERED"].includes(item.status)) {
            errors[item.id] = errors[item.id] || "Trạng thái câu hỏi không hợp lệ.";
        }
    }

    return errors;
}

export function buildClarificationUpdates(clarifications, answers) {
    return (Array.isArray(clarifications) ? clarifications : [])
        .map(item => {
            const original = typeof item.answer === "string" ? item.answer.trim() : "";
            const answer = typeof answers?.[item.id] === "string" ? answers[item.id].trim() : "";

            return {
                questionId: item.id,
                answer,
                changed: answer !== original
            };
        })
        .filter(item => item.changed && item.answer);
}

export function canApproveAIAnalysis({
    review,
    answers,
    analysisDirty = false,
    pending = false
} = {}) {
    if (!review || pending || analysisDirty) return false;
    if (!review.allowedActions?.includes("APPROVE_AI_ANALYSIS")) return false;

    return (
        Object.keys(validateClarificationAnswers(review.clarifications, answers)).length === 0 &&
        buildClarificationUpdates(review.clarifications, answers).length === 0
    );
}
