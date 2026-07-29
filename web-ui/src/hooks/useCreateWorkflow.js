import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkflow } from "../api/workflowApi.js";

export default function useCreateWorkflow() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createWorkflow,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workflows"] });
        }
    });
}
