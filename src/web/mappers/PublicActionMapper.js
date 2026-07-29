import PipelineStatuses from "../../constants/PipelineStatuses.js";

export default class PublicActionMapper {
    map({ internalStatus, sessionStatus, clarification, exports: outputs } = {}) {
        if (internalStatus === PipelineStatuses.AWAITING_AI_CLARIFICATION) {
            if (["approved", "completed"].includes(sessionStatus)) {
                return ["RESUME_WORKFLOW"];
            }

            const actions = ["UPDATE_AI_ANALYSIS"];

            if ((clarification?.remaining ?? 0) > 0) {
                actions.unshift("ANSWER_CLARIFICATIONS");
            } else {
                actions.push("APPROVE_AI_ANALYSIS");
            }

            return actions;
        }

        if (internalStatus === PipelineStatuses.AWAITING_TEST_CASE_REVIEW) {
            if (["approved", "completed"].includes(sessionStatus)) {
                return ["RESUME_WORKFLOW"];
            }

            return ["UPDATE_TEST_CASES", "APPROVE_TEST_CASES"];
        }

        if (internalStatus === PipelineStatuses.COMPLETED) {
            return outputs.map(output => `DOWNLOAD_${output.format.toUpperCase()}`);
        }

        return [];
    }
}
