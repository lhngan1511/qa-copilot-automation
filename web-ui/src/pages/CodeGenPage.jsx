import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
    const [browser, setBrowser] = useState("chrome");
    const [mode, setMode] = useState("FULL_FLOW");
    const [scriptText, setScriptText] = useState(""); // source of truth duy nhất
    const [notice, setNotice] = useState("");
    const [runResult, setRunResult] = useState(null);
    const [focusModal, setFocusModal] = useState(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkSearch, setLinkSearch] = useState("");
    const [selectedTestcaseIds, setSelectedTestcaseIds] = useState([]);
    const [searchParams] = useSearchParams();

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

    const handleSaveFile = () => {
        if (!scriptText.trim()) {
            setNotice("Dán script vào textarea trước khi lưu.");
            return;
        }
        downloadScript(scriptText, active?.downloadFileName || "playwright-recording.spec.js");
        setNotice("Đã tải file script.");
    };

    const handleRun = async () => {
        setNotice("");
        setRunResult(null);
        if (!scriptText.trim()) {
            setNotice("Dán script vào textarea trước khi chạy.");
            return;
        }
        if (!activeId) {
            setNotice("Không có recording đang hoạt động để chạy. Hãy Start Recording trước.");
            return;
        }
        try {
            const result = await actions.run.mutateAsync({ recordingId: activeId, script: scriptText });
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

            {/* RECORD */}
            <div className="codegen-card">
                <label className="codegen-label">1. Record trên Playwright Inspector</label>
                <div className="codegen-row">
                    <input
                        className="codegen-input"
                        type="text"
                        placeholder="https://example.com"
                        value={url}
                        disabled={isRecording || actions.start.isPending}
                        onChange={e => setUrl(e.target.value)}
                    />
                    <select className="codegen-input" value={browser} disabled={isRecording} onChange={e => setBrowser(e.target.value)} aria-label="Browser">
                        {BROWSERS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select className="codegen-input" value={mode} disabled={isRecording} onChange={e => setMode(e.target.value)} aria-label="Mode">
                        {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <button className="button button--primary" type="button" disabled={isRecording || busy} onClick={handleStart}>
                        Bắt đầu ghi
                    </button>
                    <button className="button button--danger" type="button" disabled={!isRecording || actions.stop.isPending} onClick={handleStop}>
                        Dừng ghi
                    </button>
                </div>
            </div>

            {/* PASTE */}
            <div className="codegen-card">
                <label className="codegen-label">2. Dán script từ Playwright Inspector</label>
                <p className="codegen-hint">Trong Playwright Inspector bấm Copy, dán vào đây. Đây là nguồn script duy nhất.</p>
                <textarea
                    className="codegen-textarea"
                    rows="12"
                    placeholder="// Dán script Playwright ở đây..."
                    value={scriptText}
                    onChange={e => setScriptText(e.target.value)}
                />
                <div className="codegen-row">
                    <button className="button button--primary" type="button" disabled={!scriptText.trim()} onClick={handleSaveFile}>
                        Lưu file
                    </button>
                    <button className="button button--secondary" type="button" disabled={!scriptText.trim() || actions.run.isPending} onClick={handleRun}>
                        {actions.run.isPending ? "Đang chạy..." : "Chạy thử"}
                    </button>
                    <button className="button button--secondary" type="button" onClick={handleClear}>
                        Xóa nội dung
                    </button>
                </div>
            </div>

            {/* RUN RESULT */}
            {runResult && (
                <div className={`codegen-run ${runResult.passed ? "codegen-run--pass" : "codegen-run--fail"}`}>
                    <strong>{runResult.passed ? "PASS" : "FAIL"}</strong>
                    <span>{runResult.error || runResult.diagnostic || `Mã thoát: ${runResult.status}`}</span>
                    {runResult.output && <pre className="codegen-output">{runResult.output}</pre>}
                </div>
            )}

            {/* ĐỐI CHIẾU TESTCASE (tính năng phụ) */}
            <div className="codegen-card codegen-card--sub">
                <div className="codegen-row codegen-row--between">
                    <span className="codegen-sub-label">
                        {active?.testcaseIds?.length > 0
                            ? `Đã đối chiếu ${active.testcaseIds.length} testcase (${active.testcaseIds.join(", ")})`
                            : "Chưa đối chiếu testcase"}
                    </span>
                    <button className="button button--secondary" type="button" onClick={openLinkModal} disabled={!activeId || !hasReliableContext} title={!hasReliableContext ? "Chỉ khả dụng khi mở CodeGen từ một bộ testcase đã duyệt" : ""}>
                        Đối chiếu testcase
                    </button>
                </div>
                {hasReliableContext ? (
                    <p className="codegen-hint">Liên kết recording với testcase để truy vết. Không ảnh hưởng nội dung script.</p>
                ) : (
                    <p className="codegen-hint">Chỉ khả dụng khi mở CodeGen từ một bộ testcase đã duyệt.</p>
                )}
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

            {linkOpen && (
                <div className="codegen-modal-overlay" role="dialog" aria-modal="true" aria-label="Đối chiếu testcase">
                    <div className="codegen-modal codegen-modal--wide">
                        <h3>Đối chiếu testcase</h3>
                        <p className="codegen-hint">Chọn 0, 1 hoặc nhiều testcase liên quan đến recording này để truy vết. Liên kết không thay đổi nội dung script.</p>
                        <input
                            className="codegen-input"
                            type="text"
                            placeholder="Tìm theo ID / module / chức năng / scenario..."
                            value={linkSearch}
                            onChange={e => setLinkSearch(e.target.value)}
                        />
                        <div className="codegen-testcase-grid">
                            {filteredTestcases.length === 0 && <p className="codegen-empty">Không tìm thấy testcase. (Kiểm tra approved-testcases.json)</p>}
                            {filteredTestcases.map(tc => (
                                <label key={tc.id} className="codegen-testcase-item">
                                    <input type="checkbox" checked={selectedTestcaseIds.includes(tc.id)} onChange={() => toggleTestcase(tc.id)} />
                                    <span>
                                        <strong>{tc.id}</strong> — {tc.title || tc.id}
                                        <small>{tc.module} · {tc.feature}</small>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="codegen-row">
                            <button className="button button--primary" type="button" onClick={handleSaveLink}>Lưu đối chiếu</button>
                            <button className="button button--secondary" type="button" onClick={() => setLinkOpen(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
