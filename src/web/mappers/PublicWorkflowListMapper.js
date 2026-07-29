import PublicWorkflowListItemDto from "../dtos/PublicWorkflowListItemDto.js";
import PublicWorkflowMapper from "./PublicWorkflowMapper.js";

export default class PublicWorkflowListMapper {
    constructor({ workflowMapper = new PublicWorkflowMapper() } = {}) {
        this.workflowMapper = workflowMapper;
    }

    map(records = [], { limit = 20, offset = 0 } = {}) {
        const items = (Array.isArray(records) ? records : [])
            .map(record => {
                const session = record?.session ?? record ?? {};
                const artifacts = Array.isArray(record?.artifacts) ? record.artifacts : [];
                const outputArtifact = artifacts.find(
                    artifact => artifact?.outputs && typeof artifact.outputs === "object"
                );
                const workflow = this.workflowMapper.map({
                    ...session,
                    artifacts,
                    outputs: outputArtifact?.outputs ?? session.outputs ?? {}
                });

                return PublicWorkflowListItemDto.create(workflow);
            })
            .sort((left, right) => this.compare(left, right));
        const page = items.slice(offset, offset + limit);

        return {
            items: page,
            pagination: {
                total: items.length,
                limit,
                offset,
                hasMore: offset + page.length < items.length
            }
        };
    }

    compare(left, right) {
        const leftUpdated = this.timestamp(left.timestamps.updatedAt);
        const rightUpdated = this.timestamp(right.timestamps.updatedAt);
        if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;

        const leftCreated = this.timestamp(left.timestamps.createdAt);
        const rightCreated = this.timestamp(right.timestamps.createdAt);
        if (leftCreated !== rightCreated) return rightCreated - leftCreated;

        return String(left.id).localeCompare(String(right.id));
    }

    timestamp(value) {
        if (typeof value !== "string" || !value.trim()) return 0;
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
}
