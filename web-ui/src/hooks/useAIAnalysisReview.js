import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    answerClarification,
    approveAIAnalysis,
    getAIAnalysisReview,
    resumeWorkflow,
    updateAIAnalysis
} from "../api/workflowApi.js";

const reviewKey = workflowId => ["workflow", workflowId, "ai-analysis-review"];

function useRefreshWorkflow(workflowId) {
    const queryClient = useQueryClient();

    return async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: reviewKey(workflowId) }),
            queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] }),
            queryClient.invalidateQueries({ queryKey: ["workflows"] })
        ]);
    };
}

export function useAIAnalysisReview(workflowId, enabled = true) {
    return useQuery({
        queryKey: reviewKey(workflowId),
        queryFn: ({ signal }) => getAIAnalysisReview(workflowId, { signal }),
        enabled: Boolean(workflowId) && enabled
    });
}

export function useSaveClarifications(workflowId) {
    const refresh = useRefreshWorkflow(workflowId);

    return useMutation({
        mutationFn: async updates => {
            for (const update of updates) {
                await answerClarification({
                    workflowId,
                    questionId: update.questionId,
                    answer: update.answer
                });
            }
        },
        onSuccess: refresh
    });
}

export function useUpdateAIAnalysis(workflowId) {
    const refresh = useRefreshWorkflow(workflowId);

    return useMutation({
        mutationFn: input => updateAIAnalysis({ workflowId, ...input }),
        onSuccess: refresh
    });
}

export function useApproveAIAnalysis(workflowId) {
    const refresh = useRefreshWorkflow(workflowId);

    return useMutation({
        mutationFn: input => approveAIAnalysis({ workflowId, ...input }),
        onSuccess: refresh,
        onError: refresh
    });
}

export function useResumeWorkflow(workflowId) {
    const refresh = useRefreshWorkflow(workflowId);

    return useMutation({
        mutationFn: () => resumeWorkflow(workflowId),
        onSuccess: refresh,
        onError: refresh
    });
}
