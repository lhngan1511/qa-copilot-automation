import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import V3RecordingPreparationPanel from "../components/automationV3/V3RecordingPreparationPanel.jsx";
import V3LibraryViewer from "../components/automationV3/V3LibraryViewer.jsx";
import V3SavedRecordingsViewer from "../components/automationV3/V3SavedRecordingsViewer.jsx";
import {
    useCodeGenRecordings,
    useCodeGenStatus,
    useCodeGenActions,
    useRecording
} from "../hooks/useCodeGen.js";
import { useRunner } from "../contexts/RunnerContext.jsx";

const BROWSERS = ["chrome", "edge", "chromium"];
const MODES = [
    { value: "FULL_FLOW", label: "Full Flow (cả quy trình/module)" },
    { value: "TESTCASE_SEGMENT", label: "Testcase Segment (đoạn ghi phục vụ testcase)" }
];

export default function CodeGenPage() {
    const [url, setUrl] = useState("");
    const [browser, setBrowser] = useState("chrome");    const [mode, setMode] = useState("FULL_FLOW");
    const [notice, setNotice] = useState("");
    const [focusModal, setFocusModal] = useState(null);
    // P0 — READ-ONLY Action Library Viewer: xem thư viện KHÔNG cần record/dán/phân tích.
    const [libraryViewerOpen, setLibraryViewerOpen] = useState(false);
    // "Bản ghi đã lưu" (2026-08-28) — chọn 1 bản ghi đã đặt tên & lưu để nạp lại vào ô soạn thảo.
    const [savedRecordingsOpen, setSavedRecordingsOpen] = useState(false);
    const recordingPanelRef = useRef(null);
    const [searchParams] = useSearchParams();
    // Ghi từ xa qua Runner Agent đã chọn 1 lần ở AppHeader (Ngân yêu cầu 2026-09-07) — khi có
    // runnerAgentId, Bắt đầu/Dừng ghi dispatch job cho máy Runner đó thay vì spawn CodeGen trên máy
    // chủ. Không chọn Runner (mặc định) -> hành vi cục bộ giữ nguyên 100% như trước.
    const { runnerAgentId } = useRunner();
    const [remoteRecordingId, setRemoteRecordingId] = useState(null);
    const remoteRecordingQuery = useRecording(remoteRecordingId, { poll: Boolean(remoteRecordingId) });

    // P0 Phase 1 — Codegen owner cần workspaceId (chung Action Library). Dùng active workspace từ
    // Automation (localStorage) nếu có; nếu chưa có, tạo workspace nền tối thiểu khi mount.
    const [codeGenWorkspaceId, setCodeGenWorkspaceId] = useState(null);
    useMemo(() => {
        const saved = window.localStorage.getItem("qa-copilot.automation.workspaceId");
        if (saved) { setCodeGenWorkspaceId(saved); return; }
        // Không có active workspace — Codegen vẫn cần workspace để tạo block (shared Library).
        // Tạo workspace nền qua API V3 (approved testcase rỗng sẽ lỗi; dùng workspace đã có qua createWorkspace
        // với 1 testcase tối thiểu? Không — đơn giản: Codegen hiển thị thông báo cần tạo workspace trước).
        setCodeGenWorkspaceId(null);
    }, []);

    // Context từ AI Test Design khi mở CodeGen kèm tham số (module/feature/artifactId).
    const incomingContext = useMemo(() => {
        const ctx = {};
        const module = searchParams.get("module");
        const feature = searchParams.get("feature");
        const artifactId = searchParams.get("artifactId");
        const workflowSessionId = searchParams.get("workflowSessionId");
        if (module) ctx.module = module;
        if (feature) ctx.feature = feature;
        if (artifactId) ctx.artifactId = artifactId;
        if (workflowSessionId) ctx.workflowSessionId = workflowSessionId;
        return Object.keys(ctx).length > 0 ? ctx : null;
    }, [searchParams]);

    const recordingsQuery = useCodeGenRecordings();
    const statusQuery = useCodeGenStatus();
    const actions = useCodeGenActions();

    const remoteStatus = remoteRecordingQuery.data?.status;
    const isRemoteBusy = Boolean(remoteRecordingId) && ["QUEUED_START", "RECORDING", "STOPPING"].includes(remoteStatus);
    const isRecording = runnerAgentId ? isRemoteBusy : statusQuery.data?.status === "RECORDING";
    const busy = actions.start.isPending || actions.stop.isPending || actions.focus.isPending
        || actions.startRemote.isPending || actions.stopRemote.isPending;

    // Nhận kết quả ghi từ xa: SAVED (script tự capture thành công) -> nạp thẳng vào ô soạn thảo
    // (tái dùng loadSavedRecording() đã có, không viết luồng nạp mới); STOPPED (capture rỗng) ->
    // rơi về đúng luồng dán tay đã có sẵn (KHÔNG phải lỗi — Playwright không phải lúc nào cũng kịp
    // flush file khi bị dừng, xem tools/runner/codegenExecution.mjs); ERROR -> báo lỗi rõ.
    useEffect(() => {
        if (!remoteRecordingId || !remoteStatus) return;
        if (remoteStatus === "SAVED") {
            recordingPanelRef.current?.loadSavedRecording({ recordingId: remoteRecordingId });
            setNotice("Đã nhận script từ máy Runner, đã nạp vào ô soạn thảo bên dưới.");
            setRemoteRecordingId(null);
        } else if (remoteStatus === "STOPPED") {
            setNotice("Không nhận được script tự động từ máy Runner. Hãy dán từ Playwright Inspector trên máy đó vào ô bên dưới.");
            setRemoteRecordingId(null);
        } else if (remoteStatus === "ERROR") {
            setNotice(remoteRecordingQuery.data?.lastRunResult?.error || "Không khởi động được CodeGen từ xa.");
            setRemoteRecordingId(null);
        }
    }, [remoteRecordingId, remoteStatus, remoteRecordingQuery.data?.lastRunResult]);

    const handleStart = async () => {
        setNotice("");
        if (!url.trim()) {
            setNotice("Vui lòng nhập URL trước khi bắt đầu ghi.");
            return;
        }
        if (runnerAgentId) {
            try {
                const rec = await actions.startRemote.mutateAsync({ url: url.trim(), browser, mode, context: incomingContext, agentId: runnerAgentId });
                setRemoteRecordingId(rec.recordingId);
                setNotice("Đã gửi yêu cầu ghi tới máy Runner đã chọn — trình duyệt ghi sẽ mở trên máy đó.");
            } catch (error) {
                setNotice(error.message || "Không thể bắt đầu ghi từ xa.");
            }
            return;
        }
        try {
            const rec = await actions.start.mutateAsync({ url: url.trim(), browser, mode, context: incomingContext });
            setNotice("Đã bắt đầu ghi. Thao tác trên Playwright Inspector rồi bấm Dừng ghi.");
            try {
                const focus = await actions.focus.mutateAsync({});
                if (focus?.focused) {
                    setNotice("Đã đưa cửa sổ ghi lên foreground.");
                } else {
                    setFocusModal({ url: url.trim(), browser, pid: rec.pid ?? null, message: focus?.message || "Không thể focus tự động." });
                }
            } catch {
                setFocusModal({ url: url.trim(), browser, pid: rec.pid ?? null, message: "Không thể focus cửa sổ ghi tự động." });
            }
        } catch (error) {
            setNotice(error.message || "Không thể bắt đầu ghi.");
        }
    };

    const handleStop = async () => {
        setNotice("");
        if (runnerAgentId && remoteRecordingId) {
            try {
                await actions.stopRemote.mutateAsync({ recordingId: remoteRecordingId });
                setNotice("Đã gửi yêu cầu dừng ghi tới máy Runner. Đang chờ script…");
            } catch (error) {
                setNotice(error.message || "Không thể dừng ghi từ xa.");
            }
            return;
        }
        try {
            await actions.stop.mutateAsync({});
            setNotice("Đã dừng ghi. Trong Playwright Inspector bấm Copy, rồi dán script vào ô bên dưới.");
        } catch (error) {
            setNotice(error.message || "Không thể dừng ghi.");
        }
    };

    if (recordingsQuery.isPending) return <div className="page"><div className="state-panel" role="status"><span className="loading-spinner" aria-hidden="true" /><p>Đang tải CodeGen…</p></div></div>;

    return (
        <section className="page codegen-page">
            {/* P0 — Header gọn: page title chính + subtitle ngắn; bỏ CODEGEN MVP / badge / mô tả cũ. */}
            <header className="codegen-page__heading">
                <div>
                    <h2>Playwright CodeGen</h2>
                    <p>Ghi hoặc dán bản ghi Playwright, tạo thao tác và lưu vào Thư viện.</p>
                </div>
            </header>

            {notice && <div className="automation-notice" role="status">{notice}</div>}

            {/* P0 Consolidation — MAIN FLOW: Playwright Recording → Phân đoạn → Lưu Library */}
            <div className="codegen-card codegen-card--recorder">
                <label className="codegen-label">Ghi phiên thao tác</label>
                <div className="codegen-row">
                    <input
                        className="codegen-input"
                        type="text"
                        placeholder="URL để ghi (tùy chọn)"
                        value={url}
                        disabled={isRecording || actions.start.isPending || actions.startRemote.isPending}
                        onChange={e => setUrl(e.target.value)}
                    />
                    <select className="codegen-input" value={browser} disabled={isRecording} onChange={e => setBrowser(e.target.value)} aria-label="Browser">
                        {BROWSERS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <button className="button button--primary" type="button" disabled={isRecording || busy} onClick={handleStart}>
                        Bắt đầu ghi
                    </button>
                    <button className="button button--danger" type="button" disabled={!isRecording || actions.stop.isPending || actions.stopRemote.isPending} onClick={handleStop}>
                        Dừng ghi
                    </button>
                    {/* P0 — tách "Xem Action đã lưu" khỏi "Tạo Action mới": luôn bấm được,
                        KHÔNG cần draft/recording (CASE 1). READ-ONLY viewer. */}
                    <button className="button button--tertiary" type="button" onClick={() => setLibraryViewerOpen(true)}>
                        Mở Thư viện thao tác
                    </button>
                    {/* "Bản ghi đã lưu" — chọn lại 1 bản ghi đã đặt tên & lưu trước đó. */}
                    <button className="button button--tertiary" type="button" onClick={() => setSavedRecordingsOpen(true)}>
                        Bản ghi đã lưu
                    </button>
                </div>
                <p className="codegen-hint">
                    {runnerAgentId
                        ? "Đang dùng máy Runner đã chọn (đổi ở menu tài khoản) — Playwright Inspector sẽ mở trên máy đó, không phải máy chủ."
                        : "Bản ghi từ Playwright Inspector sẽ được dùng để phân đoạn và lưu vào Thư viện thao tác."}
                </p>
            </div>

            {/* P0 — READ-ONLY Action Library Viewer (drawer) — mở độc lập với draft. */}
            {libraryViewerOpen ? <V3LibraryViewer onClose={() => setLibraryViewerOpen(false)} /> : null}

            {savedRecordingsOpen ? (
                <V3SavedRecordingsViewer
                    onClose={() => setSavedRecordingsOpen(false)}
                    onSelect={rec => {
                        recordingPanelRef.current?.loadSavedRecording(rec);
                        setSavedRecordingsOpen(false);
                    }}
                />
            ) : null}

            {/* II/III + Thư viện — shared component (global recording).
                P0 — bọc card để padding/margin khớp layout (không dính sát mép phải như các card khác).
                P0-3 — splitLayout: CodeGen = 2 cột (trái recording cố định · phải tạo thao tác). */}
            <div className="codegen-card codegen-card--workspace">
                <V3RecordingPreparationPanel
                    ref={recordingPanelRef}
                    splitLayout
                    onSavedToLibrary={() => setNotice("")}
                    onOpenLibrary={() => setLibraryViewerOpen(true)}
                    onError={msg => setNotice(msg)}
                />
            </div>

            {focusModal && (
                <div className="codegen-modal-overlay" role="dialog" aria-modal="true" aria-label="Cửa sổ ghi">
                    <div className="codegen-modal">
                        <h3>Trình duyệt ghi thao tác đã được mở ở cửa sổ khác</h3>
                        <p>Nhấn <strong>Alt+Tab</strong> và chọn <strong>Chrome / Playwright Inspector</strong> để thao tác.</p>
                        <div className="codegen-modal-meta">
                            <span><strong>Browser:</strong> {focusModal.browser}</span>
                            <span><strong>PID:</strong> {focusModal.pid ?? "?"}</span>
                            <span><strong>URL:</strong> {focusModal.url}</span>
                        </div>
                        {focusModal.message && <p className="codegen-modal-message">{focusModal.message}</p>}
                        <div className="codegen-row">
                            <button className="button button--primary" type="button" disabled={actions.focus.isPending} onClick={async () => {
                                try {
                                    const focus = await actions.focus.mutateAsync({});
                                    if (focus?.focused) { setNotice("Đã focus cửa sổ ghi."); setFocusModal(null); }
                                    else setFocusModal(c => ({ ...c, message: focus?.message || "Vẫn chưa focus được." }));
                                } catch (e) { setFocusModal(c => ({ ...c, message: e.message || "Không thể focus." })); }
                            }}>
                                {actions.focus.isPending ? "Đang focus..." : "Focus browser"}
                            </button>
                            <button className="button button--secondary" type="button" onClick={() => setFocusModal(null)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}

        </section>
    );
}
