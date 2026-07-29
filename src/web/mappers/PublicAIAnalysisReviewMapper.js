import PublicAIAnalysisReviewDto from "../dtos/PublicAIAnalysisReviewDto.js";

export default class PublicAIAnalysisReviewMapper {
    map({ review = {}, workflow = {} } = {}) {
        const artifact = review.artifact;

        if (!artifact || artifact.artifactType !== "AI_ANALYSIS_REVIEW") {
            const error = new Error("AI Analysis Review artifact not found.");
            error.code = "AI_ANALYSIS_REVIEW_NOT_FOUND";
            error.statusCode = 404;
            throw error;
        }

        const aiAnalysis =
            artifact.aiAnalysis && typeof artifact.aiAnalysis === "object"
                ? artifact.aiAnalysis
                : {};
        const questions = Array.isArray(artifact.questions) ? artifact.questions : [];
        const clarifications = questions.map(question => {
            const answer = typeof question?.answer === "string" ? question.answer : "";
            const answered = question?.status === "answered" && answer.trim() !== "";

            return {
                id: question?.questionId ?? "",
                category: question?.category ?? "General",
                priority: question?.priority ?? "Medium",
                question: question?.question ?? "",
                reason: question?.reason ?? "",
                required: true,
                options: Array.isArray(question?.options) ? [...question.options] : [],
                answer,
                status: answered ? "ANSWERED" : "UNANSWERED",
                answeredAt: answered ? (question?.answeredAt ?? null) : null,
                answeredBy: answered ? (question?.answeredBy ?? null) : null
            };
        });
        const answered = clarifications.filter(item => item.status === "ANSWERED").length;

        return PublicAIAnalysisReviewDto.create({
            workflowId: workflow.id,
            artifactId: artifact.artifactId,
            status: workflow.status,
            step: workflow.step,
            approvalStatus: artifact.approvalStatus ?? null,
            analysis: {
                module: artifact.requirement?.module ?? "",
                purpose: aiAnalysis.purpose ?? artifact.purpose ?? "",
                functions: this.mapFunctions(aiAnalysis.functions),
                risks: this.mapStrings(aiAnalysis.risks),
                requirementComplete: aiAnalysis.requirementComplete === true,
                source: aiAnalysis.analysisSource ?? ""
            },
            clarifications,
            summary: {
                total: clarifications.length,
                answered,
                remaining: clarifications.length - answered
            },
            allowedActions: workflow.allowedActions,
            revision: Number.isFinite(artifact.revision)
                ? artifact.revision
                : (workflow.revision ?? null)
        });
    }

    mapFunctions(functions) {
        if (!Array.isArray(functions)) return [];

        return functions
            .filter(item => item && typeof item === "object" && !Array.isArray(item))
            .map(item => ({
                name: typeof item.name === "string" ? item.name : "",
                description: typeof item.description === "string" ? item.description : "",
                businessRules: this.mapStrings(item.businessRules),
                validationRules: this.mapStrings(item.validationRules),
                permissions: this.mapStrings(item.permissions),
                dependencies: this.mapStrings(item.dependencies),
                assumptions: this.mapStrings(item.assumptions),
                requirementReferences: this.mapStrings(item.requirementReferences)
            }));
    }

    mapStrings(values) {
        return Array.isArray(values)
            ? values.filter(value => typeof value === "string").map(value => value.trim())
            : [];
    }
}
