import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import V3RecordingPreparationPanel from "../components/automationV3/V3RecordingPreparationPanel.jsx";
import {
    useCodeGenRecordings,
    useCodeGenStatus,
    useApprovedTestcases,
    useCodeGenActions
} from "../hooks/useCodeGen.js";

const BROWSERS = ["chrome", "edge", "chromium"];
const MODES = [
    { value: "FULL_FLOW", label: "Full Flow (cả quy trình/module)" },
    { value: "TESTCASE_SEGMENT", label: "Testcase Segment (đoạn ghi phục vụ testcase)" }
];

function downloadScript(content, fileName) {
    const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "playwright-recording.spec.js";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export default function CodeGenPage() {
    const [url, setUrl] = useState("");
    const [browser, setBrowser] = useState("chrome");    const [mode, setMode] = useState("FULL_FLOW");
    const [scriptText, setScriptText] = useState(""); // source of truth duy nhất
    const [notice, setNotice] = useState("");
    const [runResult, setRunResult] = useState(null);
    const [focusModal, setFocusModal] = useState(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkSearch, setLinkSearch] = useState("");
    const [selectedTestcaseIds, setSelectedTestcaseIds] = useState([]);
    const [searchParams] = useSearchParams();

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

    const recordings = recordingsQuery.data ?? [];
    // Recording mới nhất = recording đang active/session hiện tại.
    const active = recordings[0] ?? null;
    const activeId = active?.recordingId ?? "";
    const isRecording = statusQuery.data?.status === "RECORDING";
    const busy = actions.start.isPending || actions.stop.isPending || actions.run.isPending;

    // Chỉ đối chiếu khi recording có context đáng tin cậy (có module/feature/artifactId...).
    const hasReliableContext = Boolean(
        active?.context &&
            (active.context.module ||
                active.context.feature ||
                active.context.moduleId ||
                active.context.functionId ||
                active.context.artifactId ||
                active.context.workflowSessionId)
    );
    const testcasesQuery = useApprovedTestcases(hasReliableContext ? activeId : null);
    const testcases = useMemo(() => testcasesQuery.data?.testcases ?? [], [testcasesQuery.data]);
    const filteredTestcases = useMemo(() => {
        const q = linkSearch.trim().toLocaleLowerCase("vi");
        if (!q) return testcases;
        return testcases.filter(tc =>
            [tc.id, tc.title, tc.module, tc.feature, tc.scenario]
                .map(v => String(v ?? "").toLocaleLowerCase("vi"))
                .some(v => v.includes(q))
        );
    }, [testcases, linkSearch]);

    const handleStart = async () => {
        setNotice("");
        if (!url.trim()) {
            setNotice("Vui lòng nhập URL trước khi bắt đầu ghi.");
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
        try {
            await actions.stop.mutateAsync({});
            setNotice("Đã dừng ghi. Trong Playwright Inspector bấm Copy, rồi dán script vào ô bên dưới.");
        } catch (error) {
            setNotice(error.message || "Không thể dừng ghi.");
        }
    };

    const handleCopyScript = async () => {
        const content = active?.scriptContent ?? "";
        if (!content.trim()) {
            setNotice("Bản ghi hiện tại chưa có script.");
            return;
        }
        try {
            await navigator.clipboard.writeText(content);
            setNotice("Đã sao chép mã Playwright gốc.");
        } catch {
            setNotice("Không sao chép được (trình duyệt chặn clipboard).");
        }
    };

    const handleSaveFile = () => {
        const content = active?.scriptContent ?? "";
        if (!content.trim()) {
            setNotice("Bản ghi hiện tại chưa có script (hãy dán ở khu vực PHÂN ĐOẠN).");
            return;
        }
        downloadScript(content, active?.downloadFileName || "playwright-recording.spec.js");
        setNotice("Đã tải file script (từ bản ghi canonical).");
    };

    const handleRun = async () => {
        setNotice("");
        setRunResult(null);
        const content = active?.scriptContent ?? "";
        if (!content.trim()) {
            setNotice("Bản ghi hiện tại chưa có script (hãy dán ở khu vực PHÂN ĐOẠN).");
            return;
        }
        if (!activeId) {
            setNotice("Không có recording đang hoạt động để chạy. Hãy Start Recording trước.");
            return;
        }
        try {
            const result = await actions.run.mutateAsync({ recordingId: activeId, script: content });
            setRunResult(result);
        } catch (error) {
            setRunResult({ status: "ERROR", passed: false, error: error.message, output: "" });
        }
    };

    const handleClear = () => {
        setScriptText("");
        setRunResult(null);
        setNotice("Đã xoá nội dung.");
    };

    const openLinkModal = () => {
        setSelectedTestcaseIds(active?.testcaseIds ?? []);
        setLinkSearch("");
        setLinkOpen(true);
    };

    const toggleTestcase = id =>
        setSelectedTestcaseIds(ids =>
            ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
        );

    const handleSaveLink = async () => {
        try {
            await actions.link.mutateAsync({ recordingId: activeId, testcaseIds: selectedTestcaseIds });
            setLinkOpen(false);
            setNotice("Đã lưu đối chiếu testcase.");
        } catch (error) {
            setNotice(error.message || "Không thể lưu đối chiếu.");
        }
    };

    if (recordingsQuery.isPending) return <div className="page">Đang tải...</div>;

    return (
        <section className="page codegen-page">
            <Link className="back-link" to="/">
                ← Về Dashboard
            </Link>
            <header className="codegen-page__heading">
                <div>
                    <p className="workflow-id">CODEGEN MVP</p>
                    <h2>Playwright CodeGen</h2>
                    <p>Ghi lại thao tác, dán script, lưu và chạy thử.</p>
                </div>
                <span className={`status-badge ${isRecording ? "status-badge--warning" : "status-badge--neutral"}`}>
                    {isRecording ? "Đang ghi" : "Chưa ghi"}
                </span>
            </header>

            {notice && <div className="automation-notice" role="status">{notice}</div>}

            {/* P0 Consolidation — MAIN FLOW: Playwright Recording → Phân đoạn → Lưu Library */}
            <div className="codegen-card">
                <label className="codegen-label">I. BẢN GHI</label>
                <div className="codegen-row">
                    <input
                        className="codegen-input"
                        type="text"
                        placeholder="URL để ghi (tùy chọn)"
                        value={url}
                        disabled={isRecording || actions.start.isPending}
                        onChange={e => setUrl(e.target.value)}
                    />
                    <select className="codegen-input" value={browser} disabled={isRecording} onChange={e => setBrowser(e.target.value)} aria-label="Browser">
                        {BROWSERS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <button className="button button--primary" type="button" disabled={isRecording || busy} onClick={handleStart}>
                        Bắt đầu ghi
                    </button>
                    <button className="button button--danger" type="button" disabled={!isRecording || actions.stop.isPending} onClick={handleStop}>
                        Dừng ghi
                    </button>
                </div>
                <p className="codegen-hint">Record hoặc dán bản ghi đều đổ vào MỘT nguồn — cắt đoạn → lưu Thư viện thao tác (shared).</p>
            </div>

            {/* II/III + Thư viện — shared component (global recording) */}
            <V3RecordingPreparationPanel
                onSavedToLibrary={count => setNotice(`Đã lưu ${count} thao tác vào Thư viện.`)}
                onError={msg => setNotice(msg)}
            />

            {/* CÔNG CỤ KỸ THUẬT (collapse — consume canonical recording, không textarea thứ hai) */}
            <div className="codegen-card codegen-card--sub">
                <details className="codegen-details">
                    <summary className="codegen-label">Công cụ kỹ thuật ▾</summary>
                    <div className="codegen-row">
                        <button className="button button--secondary" type="button" disabled={!activeId} onClick={handleCopyScript}>
                            Sao chép mã
                        </button>
                        <button className="button button--secondary" type="button" disabled={!activeId} onClick={handleSaveFile}>
                            Tải/Lưu script
                        </button>
                    </div>
                    {active?.scriptContent ? (
                        <details className="codegen-details">
                            <summary>Xem script gốc (read-only)</summary>
                            <pre className="codegen-output">{active.scriptContent}</pre>
                        </details>
                    ) : (
                        <p className="codegen-hint">Chưa có script trong bản ghi hiện tại.</p>
                    )}
                {runResult && (
                    <div className={`codegen-run ${runResult.passed ? "codegen-run--pass" : "codegen-run--fail"}`}>
                        <strong>{runResult.passed ? "PASS" : "FAIL"}</strong>
                        <span>{runResult.error || runResult.diagnostic || `Mã thoát: ${runResult.status}`}</span>
                        {runResult.output && <pre className="codegen-output">{runResult.output}</pre>}
                    </div>
                )}
                </details>
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
