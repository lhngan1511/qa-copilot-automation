import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    startCodeGen,
    stopCodeGen,
    getCodeGenStatus,
    runCodeGen,
    cleanupCodeGen
} from "../api/codeGenApi.js";

const codeGenKey = ["codegen", "session"];

export function useCodeGenStatus(enabled = true) {
    return useQuery({
        queryKey: codeGenKey,
        queryFn: ({ signal }) => getCodeGenStatus({ signal }),
        enabled,
        refetchInterval: query => {
            const status = query.state.data?.status;
            // Poll nhanh trong lúc ghi để cập nhật trạng thái.
            return status === "RECORDING" ? 1500 : false;
        }
    });
}

export function useCodeGenActions() {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: codeGenKey });

    const start = useMutation({
        mutationFn: input => startCodeGen(input),
        onSuccess: refresh
    });
    const stop = useMutation({
        mutationFn: input => stopCodeGen(input),
        onSuccess: refresh
    });
    const run = useMutation({
        mutationFn: input => runCodeGen(input)
    });
    const cleanup = useMutation({
        mutationFn: input => cleanupCodeGen(input),
        onSuccess: refresh
    });

    return { start, stop, run, cleanup };
}
