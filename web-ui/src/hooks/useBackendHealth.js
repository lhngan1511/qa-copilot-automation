import { useQuery } from "@tanstack/react-query";
import { getBackendHealth } from "../api/workflowApi.js";

export default function useBackendHealth() {
    return useQuery({
        queryKey: ["backend-health"],
        queryFn: ({ signal }) => getBackendHealth({ signal }),
        retry: false,
        staleTime: 30_000
    });
}
