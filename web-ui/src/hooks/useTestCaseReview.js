import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    approveTestCaseReview,
    getTestCaseReview,
    resumeWorkflow,
    updateTestCaseReview
} from "../api/workflowApi.js";

const reviewKey = workflowId => ["workflow", workflowId, "test-case-review"];

function useRefresh(workflowId) {
    const queryClient = useQueryClient();
    return async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: reviewKey(workflowId) }),
            queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] }),
            queryClient.invalidateQueries({ queryKey: ["workflows"] })
        ]);
    };
}

export function useTestCaseReview(workflowId, enabled = true) {
    return useQuery({
        queryKey: reviewKey(workflowId),
        queryFn: ({ signal }) => getTestCaseReview(workflowId, { signal }),
        enabled: Boolean(workflowId) && enabled
    });
}

export function useUpdateTestCaseReview(workflowId) {
    const refresh = useRefresh(workflowId);
    return useMutation({
        mutationFn: input => updateTestCaseReview({ workflowId, ...input }),
        onSuccess: refresh
    });
}

export function useApproveTestCaseReview(workflowId) {
    const refresh = useRefresh(workflowId);
    return useMutation({
        mutationFn: input => approveTestCaseReview({ workflowId, ...input }),
        onSuccess: refresh,
        onError: refresh
    });
}

export function useResumeTestCaseWorkflow(workflowId) {
    const refresh = useRefresh(workflowId);
    return useMutation({
        mutationFn: () => resumeWorkflow(workflowId),
        onSuccess: refresh,
        onError: refresh
    });
}
