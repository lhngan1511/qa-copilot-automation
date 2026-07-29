import PipelineStatuses from "../../constants/PipelineStatuses.js";

export default class PublicStatusMapper {
    map(internalStatus) {
        const mappings = {
            [PipelineStatuses.AWAITING_AI_CLARIFICATION]: {
                status: "AI_ANALYSIS_REVIEW_REQUIRED",
                step: "AI_ANALYSIS_REVIEW",
                isBlocking: true
            },
            [PipelineStatuses.AWAITING_TEST_CASE_REVIEW]: {
                status: "TEST_CASE_REVIEW_REQUIRED",
                step: "TEST_CASE_REVIEW",
                isBlocking: true
            },
            [PipelineStatuses.COMPLETED]: {
                status: "COMPLETED",
                step: "EXPORT",
                isBlocking: false
            },
            [PipelineStatuses.FAILED]: {
                status: "FAILED",
                step: "ERROR",
                isBlocking: true
            },
            [PipelineStatuses.AWAITING_REQUIREMENT_REVIEW]: {
                status: "REVIEW_REQUIRED",
                step: "AI_ANALYSIS_REVIEW",
                isBlocking: true
            },
            [PipelineStatuses.AWAITING_MODULE_REVIEW]: {
                status: "REVIEW_REQUIRED",
                step: "AI_ANALYSIS_REVIEW",
                isBlocking: true
            },
            [PipelineStatuses.AWAITING_SCENARIO_REVIEW]: {
                status: "REVIEW_REQUIRED",
                step: "AI_ANALYSIS_REVIEW",
                isBlocking: true
            }
        };

        return (
            mappings[internalStatus] ?? {
                status: "UNKNOWN",
                step: "ERROR",
                isBlocking: true
            }
        );
    }
}
