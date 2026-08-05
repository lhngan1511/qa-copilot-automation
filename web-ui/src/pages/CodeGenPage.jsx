import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
const STATUS_LABEL = {
    RECORDING: "Đang ghi",
    STOPPED: "Đã dừng",
    SAVED: "Đã lưu",
    ERROR: "Lỗi"
};

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
    const [notice, setNotice] = useState("");
    const [activeId, setActiveId] = useState("");
    const [linkMode, setLinkMode] = useState(false);
    const [selectedTestcaseIds, setSelectedTestcaseIds] = useState([]);

    const recordingsQuery = useCodeGenRecordings();
    const statusQuery = useCodeGenStatus();
    const testcasesQuery = useApprovedTestcases();
    const actions = useCodeGenActions();

    const recordings = recordingsQuery.data ?? [];
    const active = recordings.find(rec => rec.recordingId === activeId) ?? null;
    const isRecording = statusQuery.data?.status === "RECORDING";
    const busy = actions.start.isPending || actions.stop.isPending || actions.run.isPending;

    const testcases = useMemo(() => testcasesQuery.data ?? [], [testcasesQuery.data]);

    const selectRecording = id => {
        setActiveId(id);
        setLinkMode(false);
        const rec = recordings.find(r => r.recordingId === id);
        setSelectedTestcaseIds(rec?.testcaseIds ?? []);
    };

    const handleStart = async () => {
        setNotice("");
        if (!url.trim()) {
            setNotice("Vui lòng nhập URL trước khi bắt đầu ghi.");
            return;
        }
        try {
            const rec = await actions.start.mutateAsync({ url: url.trim(), browser, mode });
            setActiveId(rec.recordingId);
            setNotice("Đã bắt đầu ghi. Thao tác trên trình duyệt CodeGen rồi bấm Dừng ghi.");
        } catch (error) {
            setNotice(error.message || "Không thể bắt đầu ghi.");
        }
    };

    const handleStop = async () => {
        setNotice("");
        try {
            const rec = await actions.stop.mutateAsync({});
            setActiveId(rec.recordingId);
            setNotice("Đã dừng ghi. Xem toàn bộ script và gắn testcase nếu cần.");
        } catch (error) {
            setNotice(error.message || "Không thể dừng ghi.");
        }
    };

    const handleSaveAs = () => {
        if (!active || !active.hasScript) {
            setNotice("Không có script để lưu.");
            return;
        }
        downloadScript(active.scriptContent ?? "", active.downloadFileName || "playwright-recording.spec.js");
        setNotice("Đã tải script. Dùng Save As của trình duyệt để chọn nơi lưu.");
    };

    const handleSaveWorkspace = async () => {
        try {
            await actions.save.mutateAsync({ recordingId: activeId });
            setNotice("Đã lưu script vào workspace (outputs/codegen). Có thể mở thư mục.");
        } catch (error) {
            setNotice(error.message || "Không thể lưu vào workspace.");
        }
    };

    const handleRun = async () => {
        setNotice("");
        try {
            await actions.run.mutateAsync({ recordingId: activeId });
        } catch (error) {
            setNotice(error.message || "Không thể chạy thử.");
        }
    };

    const handleOpenFolder = async () => {
        try {
            const data = await actions.openFolder.mutateAsync({ recordingId: activeId });
            setNotice(`Thư mục: ${data.folderPath}/${data.serverFilePath}`);
        } catch (error) {
            setNotice(error.message || "Không thể mở thư mục.");
        }
    };

    const handleRename = async () => {
        const name = window.prompt("Tên file script:", active?.downloadFileName ?? "");
        if (!name || !name.trim()) return;
        try {
            await actions.rename.mutateAsync({ recordingId: activeId, fileName: name.trim() });
        } catch (error) {
            setNotice(error.message || "Không thể đổi tên.");
        }
    };

    const handleLink = async () => {
        try {
            await actions.link.mutateAsync({ recordingId: activeId, testcaseIds: selectedTestcaseIds });
            setLinkMode(false);
            setNotice("Đã cập nhật liên kết testcase.");
        } catch (error) {
            setNotice(error.message || "Không thể gắn testcase.");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Xoá recording ${active?.recordingId}?`)) return;
        try {
            await actions.remove.mutateAsync({ recordingId: activeId });
            setActiveId("");
            setNotice("Đã xoá recording.");
        } catch (error) {
            setNotice(error.message || "Không thể xoá.");
        }
    };

    const toggleTestcase = id =>
        setSelectedTestcaseIds(ids =>
            ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
        );

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
                    <p>Ghi toàn bộ luồng thao tác trên trình duyệt thành một Recording Session.</p>
                </div>
                <span className={`status-badge ${isRecording ? "status-badge--warning" : "status-badge--neutral"}`}>
                    {isRecording ? "Đang ghi" : "Chưa ghi"}
                </span>
            </header>

            {notice && <div className="automation-notice" role="status">{notice}</div>}

            {/* START RECORDING */}
            <div className="codegen-card">
                <label className="codegen-label">Start Recording (tự do, không bắt buộc testcase)</label>
                <div className="codegen-row">
                    <input
                        className="codegen-input"
                        type="text"
                        placeholder="https://example.com"
                        value={url}
                        disabled={isRecording || actions.start.isPending}
                        onChange={e => setUrl(e.target.value)}
                    />
                    <select
                        className="codegen-input"
                        value={browser}
                        disabled={isRecording}
                        onChange={e => setBrowser(e.target.value)}
                        aria-label="Browser"
                    >
                        {BROWSERS.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                    <select
                        className="codegen-input"
                        value={mode}
                        disabled={isRecording}
                        onChange={e => setMode(e.target.value)}
                        aria-label="Mode"
                    >
                        {MODES.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <button
                        className="button button--primary"
                        type="button"
                        disabled={isRecording || busy}
                        onClick={handleStart}
                    >
                        Bắt đầu ghi
                    </button>
                    <button
                        className="button button--danger"
                        type="button"
                        disabled={!isRecording || actions.stop.isPending}
                        onClick={handleStop}
                    >
                        Dừng ghi
                    </button>
                </div>
            </div>

            <div className="codegen-layout">
                {/* LIST */}
                <div className="codegen-list">
                    <h3>Recording Sessions</h3>
                    {recordings.length === 0 && <p className="codegen-empty">Chưa có recording nào.</p>}
                    {recordings.map(rec => (
                        <button
                            key={rec.recordingId}
                            className={`codegen-list-item ${activeId === rec.recordingId ? "codegen-list-item--active" : ""}`}
                            onClick={() => selectRecording(rec.recordingId)}
                        >
                            <strong>{rec.downloadFileName}</strong>
                            <small>{rec.mode} · {rec.status} · {rec.testcaseIds.length} testcase</small>
                        </button>
                    ))}
                </div>

                {/* DETAIL */}
                <div className="codegen-detail">
                    {!active ? (
                        <p className="codegen-empty">Chọn một recording để xem chi tiết.</p>
                    ) : (
                        <>
                            <div className="codegen-card">
                                <div className="codegen-row codegen-row--between">
                                    <div>
                                        <h3>{active.downloadFileName}</h3>
                                        <p className="codegen-meta">
                                            {active.recordingId} · {active.mode} · {active.browser} · {active.storageMode}
                                        </p>
                                        <p className="codegen-meta">
                                            Testcase: {active.testcaseIds.length > 0 ? active.testcaseIds.join(", ") : "(chưa gắn)"}
                                            {active.mode === "TESTCASE_SEGMENT" && active.testcaseIds.length === 0 && " — cần gắn ít nhất 1 testcase"}
                                        </p>
                                    </div>
                                    <span className={`status-badge ${active.status === "STOPPED" ? "status-badge--success" : "status-badge--neutral"}`}>
                                        {STATUS_LABEL[active.status] ?? active.status}
                                    </span>
                                </div>
                                <div className="codegen-row">
                                    <button className="button button--secondary" type="button" disabled={!active.hasScript} onClick={handleSaveAs}>Save As</button>
                                    <button className="button button--secondary" type="button" disabled={!active.hasScript || actions.save.isPending} onClick={handleSaveWorkspace}>Save to workspace</button>
                                    <button className="button button--secondary" type="button" disabled={!active.hasScript || actions.run.isPending} onClick={handleRun}>Run</button>
                                    <button className="button button--secondary" type="button" onClick={handleRename}>Rename</button>
                                    <button className="button button--secondary" type="button" disabled={active.storageMode !== "SERVER"} onClick={handleOpenFolder}>Open Folder</button>
                                    <button className="button button--danger" type="button" onClick={handleDelete}>Delete</button>
                                </div>
                            </div>

                            {/* SCRIPT */}
                            <div className="codegen-card">
                                <label className="codegen-label">Script (toàn bộ luồng)</label>
                                <pre className="codegen-script">
                                    {active.scriptContent?.trim() || "// Chưa có script."}
                                </pre>
                            </div>

                            {/* RUN RESULT */}
                            {active.lastRunResult && (
                                <div className={`codegen-run ${active.lastRunResult.passed ? "codegen-run--pass" : "codegen-run--fail"}`}>
                                    <strong>{active.lastRunResult.passed ? "PASS" : "FAIL"}</strong>
                                    <span>{active.lastRunResult.error || active.lastRunResult.diagnostic || `Mã thoát: ${active.lastRunResult.status}`}</span>
                                    {active.lastRunResult.reportPath && <span>Report: {active.lastRunResult.reportPath}</span>}
                                    {active.lastRunResult.output && <pre className="codegen-output">{active.lastRunResult.output}</pre>}
                                </div>
                            )}

                            {/* LINK TESTCASES */}
                            <div className="codegen-card">
                                <div className="codegen-row codegen-row--between">
                                    <label className="codegen-label">Link Testcases (0/1/n)</label>
                                    <button className="button button--secondary" type="button" onClick={() => setLinkMode(v => !v)}>
                                        {linkMode ? "Đóng" : "Chọn testcase"}
                                    </button>
                                </div>
                                {linkMode && (
                                    <>
                                        <div className="codegen-testcase-grid">
                                            {testcases.length === 0 && <p className="codegen-empty">Không tìm thấy approved-testcases.json.</p>}
                                            {testcases.map(tc => (
                                                <label key={tc.id} className="codegen-testcase-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTestcaseIds.includes(tc.id)}
                                                        onChange={() => toggleTestcase(tc.id)}
                                                    />
                                                    <span>
                                                        <strong>{tc.id}</strong> — {tc.title || tc.id}
                                                        <small>{tc.module} · {tc.feature}</small>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <button className="button button--primary" type="button" onClick={handleLink}>
                                            Lưu liên kết
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
