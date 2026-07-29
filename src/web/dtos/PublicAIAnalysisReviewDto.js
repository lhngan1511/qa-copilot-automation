export default class PublicAIAnalysisReviewDto {
    static create(data = {}) {
        return {
            workflowId: data.workflowId ?? "",
            artifactId: data.artifactId ?? "",
            status: data.status ?? "UNKNOWN",
            step: data.step ?? "ERROR",
            approvalStatus: data.approvalStatus ?? null,
            analysis: {
                module: data.analysis?.module ?? "",
                purpose: data.analysis?.purpose ?? "",
                functions: Array.isArray(data.analysis?.functions)
                    ? data.analysis.functions.map(item => ({ ...item }))
                    : [],
                risks: Array.isArray(data.analysis?.risks) ? [...data.analysis.risks] : [],
                requirementComplete: data.analysis?.requirementComplete === true,
                source: data.analysis?.source ?? ""
            },
            clarifications: Array.isArray(data.clarifications)
                ? data.clarifications.map(item => ({
                      ...item,
                      options: Array.isArray(item.options) ? [...item.options] : []
                  }))
                : [],
            summary: {
                total: data.summary?.total ?? 0,
                answered: data.summary?.answered ?? 0,
                remaining: data.summary?.remaining ?? 0
            },
            allowedActions: Array.isArray(data.allowedActions) ? [...data.allowedActions] : [],
            revision: data.revision ?? null
        };
    }
}
