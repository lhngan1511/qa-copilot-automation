import { useQuery } from "@tanstack/react-query";
import { getWorkflow } from "../api/workflowApi.js";

export default function useWorkflow(workflowId) {
    return useQuery({
        queryKey: ["workflow", workflowId],
        queryFn: ({ signal }) => getWorkflow(workflowId, { signal }),
        enabled: Boolean(workflowId)
    });
}
