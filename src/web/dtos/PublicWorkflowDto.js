export default class PublicWorkflowDto {
    static create(data = {}) {
        return {
            id: data.id ?? "",
            name: data.name ?? "",
            status: data.status ?? "UNKNOWN",
            step: data.step ?? "ERROR",
            allowedActions: Array.isArray(data.allowedActions) ? [...data.allowedActions] : [],
            isBlocking: data.isBlocking === true,
            blockingReasons: Array.isArray(data.blockingReasons)
                ? data.blockingReasons.map(reason => ({ ...reason }))
                : [],
            clarification: {
                total: data.clarification?.total ?? 0,
                answered: data.clarification?.answered ?? 0,
                remaining: data.clarification?.remaining ?? 0
            },
            testCases: {
                total: data.testCases?.total ?? 0,
                approved: data.testCases?.approved ?? 0,
                rejected: data.testCases?.rejected ?? 0,
                requiresTesterInput: data.testCases?.requiresTesterInput ?? 0
            },
            artifacts: Array.isArray(data.artifacts)
                ? data.artifacts.map(artifact => ({ ...artifact }))
                : [],
            exports: Array.isArray(data.exports) ? data.exports.map(output => ({ ...output })) : [],
            timestamps: {
                createdAt: data.timestamps?.createdAt ?? null,
                updatedAt: data.timestamps?.updatedAt ?? null
            },
            revision: data.revision ?? null
        };
    }
}
