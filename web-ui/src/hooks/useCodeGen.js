import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    startCodeGen,
    stopCodeGen,
    listRecordings,
    getRecording,
    renameRecording,
    setRecordingScript,
    linkTestcases,
    saveRecording,
    runRecording,
    openFolder,
    openReport,
    deleteRecording,
    getApprovedTestcases,
    getCodeGenStatus,
    focusCodeGenBrowser,
    setRecordingContext,
    startRemoteCodeGen,
    stopRemoteCodeGen
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

export function useRecording(recordingId, { poll = false } = {}) {
    return useQuery({
        queryKey: ["codegen", "recording", recordingId],
        queryFn: ({ signal }) => getRecording(recordingId, { signal }),
        enabled: Boolean(recordingId),
        // Ghi từ xa (Ngân yêu cầu 2026-09-07) — CodeGenPage.jsx poll 1 recording cụ thể trong lúc
        // đang QUEUED_START/RECORDING/STOPPING, thay vì GET /codegen/status (phiên GLOBAL cục bộ,
        // không áp dụng cho recording từ xa — xem RemoteCodeGenService.js).
        refetchInterval: poll ? 1500 : false
    });
}

export function useApprovedTestcases(recordingId) {
    return useQuery({
        queryKey: [testcasesKey, recordingId ?? "none"],
        queryFn: ({ signal }) => getApprovedTestcases({ recordingId, signal }),
        enabled: Boolean(recordingId)
    });
}

export function useCodeGenActions() {
    const refresh = useRefresh();

    const start = useMutation({ mutationFn: input => startCodeGen(input), onSuccess: refresh });
    const stop = useMutation({ mutationFn: input => stopCodeGen(input), onSuccess: refresh });
    const startRemote = useMutation({ mutationFn: input => startRemoteCodeGen(input), onSuccess: refresh });
    const stopRemote = useMutation({ mutationFn: input => stopRemoteCodeGen(input.recordingId), onSuccess: refresh });
    const rename = useMutation({ mutationFn: input => renameRecording(input.recordingId, input), onSuccess: refresh });
    const setScript = useMutation({ mutationFn: input => setRecordingScript(input.recordingId, input), onSuccess: refresh });
    const link = useMutation({ mutationFn: input => linkTestcases(input.recordingId, input), onSuccess: refresh });
    const save = useMutation({ mutationFn: input => saveRecording(input.recordingId, input), onSuccess: refresh });
    const run = useMutation({ mutationFn: input => runRecording(input.recordingId, input), onSuccess: refresh });
    const openFolderMut = useMutation({ mutationFn: input => openFolder(input.recordingId, input) });
    const openReportMut = useMutation({ mutationFn: input => openReport(input.recordingId, input) });
    const remove = useMutation({ mutationFn: input => deleteRecording(input.recordingId, input), onSuccess: refresh });
    const focus = useMutation({ mutationFn: input => focusCodeGenBrowser(input) });
    const setContext = useMutation({ mutationFn: input => setRecordingContext(input.recordingId, input), onSuccess: refresh });

    return { start, stop, startRemote, stopRemote, rename, setScript, link, save, run, openFolder: openFolderMut, openReport: openReportMut, remove, focus, setContext };
}
