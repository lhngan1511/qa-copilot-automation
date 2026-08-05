import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    startCodeGen,
    stopCodeGen,
    listRecordings,
    getRecording,
    renameRecording,
    linkTestcases,
    saveRecording,
    runRecording,
    openFolder,
    openReport,
    deleteRecording,
    getApprovedTestcases,
    getCodeGenStatus
} from "../api/codeGenApi.js";

const recordingsKey = ["codegen", "recordings"];
const statusKey = ["codegen", "status"];
const testcasesKey = ["codegen", "testcases"];

function useRefresh() {
    const queryClient = useQueryClient();
    return async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: recordingsKey }),
            queryClient.invalidateQueries({ queryKey: statusKey })
        ]);
    };
}

export function useCodeGenStatus() {
    return useQuery({
        queryKey: statusKey,
        queryFn: ({ signal }) => getCodeGenStatus({ signal }),
        refetchInterval: query =>
            query.state.data?.status === "RECORDING" ? 1500 : false
    });
}

export function useCodeGenRecordings() {
    return useQuery({
        queryKey: recordingsKey,
        queryFn: ({ signal }) => listRecordings({ signal })
    });
}

export function useRecording(recordingId) {
    return useQuery({
        queryKey: ["codegen", "recording", recordingId],
        queryFn: ({ signal }) => getRecording(recordingId, { signal }),
        enabled: Boolean(recordingId)
    });
}

export function useApprovedTestcases() {
    return useQuery({
        queryKey: testcasesKey,
        queryFn: ({ signal }) => getApprovedTestcases({ signal })
    });
}

export function useCodeGenActions() {
    const refresh = useRefresh();

    const start = useMutation({ mutationFn: input => startCodeGen(input), onSuccess: refresh });
    const stop = useMutation({ mutationFn: input => stopCodeGen(input), onSuccess: refresh });
    const rename = useMutation({ mutationFn: input => renameRecording(input.recordingId, input), onSuccess: refresh });
    const link = useMutation({ mutationFn: input => linkTestcases(input.recordingId, input), onSuccess: refresh });
    const save = useMutation({ mutationFn: input => saveRecording(input.recordingId, input), onSuccess: refresh });
    const run = useMutation({ mutationFn: input => runRecording(input.recordingId, input), onSuccess: refresh });
    const openFolderMut = useMutation({ mutationFn: input => openFolder(input.recordingId, input) });
    const openReportMut = useMutation({ mutationFn: input => openReport(input.recordingId, input) });
    const remove = useMutation({ mutationFn: input => deleteRecording(input.recordingId, input), onSuccess: refresh });

    return { start, stop, rename, link, save, run, openFolder: openFolderMut, openReport: openReportMut, remove };
}
