export default class PublicTestCaseReviewDto {
    constructor(data = {}) {
        this.workflowId = data.workflowId ?? "";
        this.artifactId = data.artifactId ?? "";
        this.status = data.status ?? "";
        this.step = data.step ?? "";
        this.approvalStatus = data.approvalStatus ?? "";
        this.testCases = Array.isArray(data.testCases)
            ? data.testCases.map(testCase => structuredClone(testCase))
            : [];
        this.summary = {
            total: data.summary?.total ?? 0,
            approved: data.summary?.approved ?? 0,
            needsChanges: data.summary?.needsChanges ?? 0,
            removed: data.summary?.removed ?? 0,
            pending: data.summary?.pending ?? 0,
            byType: { ...(data.summary?.byType ?? {}) },
            ready: data.summary?.ready ?? 0,
            requiresTesterInput: data.summary?.requiresTesterInput ?? 0
        };
        this.allowedActions = Array.isArray(data.allowedActions) ? [...data.allowedActions] : [];
        this.exports = Array.isArray(data.exports)
            ? data.exports.map(output => ({ ...output }))
            : [];
        this.revision = data.revision ?? null;
    }
}
