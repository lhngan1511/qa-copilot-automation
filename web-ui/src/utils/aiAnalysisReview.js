const QUESTION_TYPES = new Set(["YES_NO", "SINGLE_CHOICE", "FREE_TEXT", "CONFIRM_ASSUMPTION"]);

function normalizeQuestionType(item) {
    const explicit = String(item?.type ?? "").toUpperCase();
    if (QUESTION_TYPES.has(explicit)) return explicit;
    const options = Array.isArray(item?.options) ? item.options : [];
    if (options.length >= 2) {
        const normalized = options.map(option => String(option).trim().toLocaleLowerCase("vi"));
        return normalized.includes("có") && normalized.includes("không")
            ? "YES_NO"
            : "SINGLE_CHOICE";
    }
    return "FREE_TEXT";
}

function normalizeQuestionOptions(item, type) {
    const options = Array.isArray(item?.options) ? [...item.options] : [];
    if (type === "YES_NO" && options.length === 0) return ["Có", "Không"];
    if (type === "CONFIRM_ASSUMPTION" && options.length === 0) {
        return ["Đúng", "Không đúng"];
    }
    return type === "FREE_TEXT" ? [] : options;
}

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
        clarifications: value.clarifications.map(item => {
            const type = normalizeQuestionType(item);
            return {
                ...item,
                type,
                allowNotSpecified:
                    item.allowNotSpecified === true ||
                    normalizeQuestionOptions(item, type).some(option =>
                        /chưa xác định|requirement không (đề cập|nói)/i.test(option)
                    ),
                targetField: typeof item.targetField === "string" ? item.targetField : "",
                targetRule: typeof item.targetRule === "string" ? item.targetRule : "",
                options: normalizeQuestionOptions(item, type)
            };
        }),
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
