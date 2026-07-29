import { useQuery } from "@tanstack/react-query";
import { listWorkflows } from "../api/workflowApi.js";

export default function useWorkflows({ limit, offset }) {
    return useQuery({
        queryKey: ["workflows", { limit, offset }],
        queryFn: ({ signal }) => listWorkflows({ limit, offset, signal }),
        placeholderData: previousData => previousData
    });
}
