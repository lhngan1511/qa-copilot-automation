export default class PublicWorkflowListItemDto {
    static create(workflow = {}) {
        return {
            id: workflow.id ?? "",
            name: workflow.name ?? "",
            status: workflow.status ?? "UNKNOWN",
            step: workflow.step ?? "ERROR",
            allowedActions: Array.isArray(workflow.allowedActions)
                ? [...workflow.allowedActions]
                : [],
            isBlocking: workflow.isBlocking === true,
            clarification: {
                total: workflow.clarification?.total ?? 0,
                answered: workflow.clarification?.answered ?? 0,
                remaining: workflow.clarification?.remaining ?? 0
            },
            testCases: {
                total: workflow.testCases?.total ?? 0,
                approved: workflow.testCases?.approved ?? 0,
                rejected: workflow.testCases?.rejected ?? 0,
                requiresTesterInput: workflow.testCases?.requiresTesterInput ?? 0
            },
            artifactAvailable: (workflow.artifacts?.length ?? 0) > 0,
            exportAvailable: (workflow.exports?.length ?? 0) > 0,
            timestamps: {
                createdAt: workflow.timestamps?.createdAt ?? null,
                updatedAt: workflow.timestamps?.updatedAt ?? null
            },
            revision: workflow.revision ?? null
        };
    }
}
