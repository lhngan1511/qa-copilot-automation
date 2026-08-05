import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCodeGenStatus, useCodeGenActions } from "../hooks/useCodeGen.js";

const STATUS_LABEL = {
    IDLE: "Chưa bắt đầu",
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
    const [script, setScript] = useState("");
    const [fileName, setFileName] = useState("");
    const [notice, setNotice] = useState("");
    const [runResult, setRunResult] = useState(null);
    const [localStatus, setLocalStatus] = useState("IDLE");

    const statusQuery = useCodeGenStatus();
    const actions = useCodeGenActions();

    const serverStatus = statusQuery.data?.status ?? null;
    const serverScript = statusQuery.data?.script ?? "";
    const defaultFileName = statusQuery.data?.defaultFileName ?? "playwright-recording.spec.js";

    const status = serverStatus === "RECORDING" ? "RECORDING" : localStatus === "SAVED" ? "SAVED" : serverStatus || localStatus;
    const busy = actions.start.isPending || actions.stop.isPending || actions.run.isPending;

    // Script hiển thị: ưu tiên server (từ stop), rồi local.
    const visibleScript = script || serverScript;

    const downloadName = useMemo(
        () => fileName.trim() || defaultFileName,
        [fileName, defaultFileName]
    );

    const handleStart = async () => {
        setNotice("");
        setRunResult(null);
        if (!url.trim()) {
            setNotice("Vui lòng nhập URL trước khi bắt đầu ghi.");
            return;
        }
        try {
            await actions.start.mutateAsync({ url: url.trim() });
            setLocalStatus("RECORDING");
            setNotice("Đã bắt đầu ghi. Tester thao tác trên trình duyệt CodeGen, sau đó bấm Dừng ghi.");
        } catch (error) {
            setNotice(error.message || "Không thể bắt đầu ghi.");
            setLocalStatus("ERROR");
        }
    };

    const handleStop = async () => {
        setNotice("");
        setRunResult(null);
        try {
            const result = await actions.stop.mutateAsync({});
            setScript(result?.script ?? "");
            setLocalStatus("STOPPED");
            if (result?.warning) setNotice(result.warning);
            else if (result?.script) setNotice("Đã dừng ghi. Xem script bên dưới.");
        } catch (error) {
            setNotice(error.message || "Không thể dừng ghi.");
            setLocalStatus("ERROR");
        }
    };

    const handleSave = () => {
        if (!visibleScript.trim()) {
            setNotice("Không có script để lưu.");
            return;
        }
        downloadScript(visibleScript, downloadName);
        setLocalStatus("SAVED");
        setNotice(`Đã tải script. Bạn có thể lưu vào nơi mong muốn qua hộp thoại lưu của trình duyệt.`);
    };

    const handleRun = async () => {
        setNotice("");
        setRunResult(null);
        try {
            const result = await actions.run.mutateAsync({ script: visibleScript });
            setRunResult(result);
        } catch (error) {
            setRunResult({ status: "ERROR", passed: false, error: error.message, output: "" });
        }
    };

    const handleCleanup = async () => {
        setNotice("");
        setScript("");
        setRunResult(null);
        setLocalStatus("IDLE");
        try {
            await actions.cleanup.mutateAsync({});
            setNotice("Đã dọn dữ liệu phiên CodeGen.");
        } catch (error) {
            setNotice(error.message || "Không thể dọn dữ liệu phiên.");
        }
    };

    return (
        <section className="page codegen-page">
            <Link className="back-link" to="/">
                ← Về Dashboard
            </Link>
            <header className="codegen-page__heading">
                <div>
                    <p className="workflow-id">CODEGEN MVP</p>
                    <h2>Playwright CodeGen</h2>
                    <p>Ghi lại thao tác trên trình duyệt và sinh script Playwright.</p>
                </div>
                <span className={`status-badge ${status === "RECORDING" ? "status-badge--warning" : status === "ERROR" ? "status-badge--danger" : status === "SAVED" ? "status-badge--success" : "status-badge--neutral"}`}>
                    {STATUS_LABEL[status] ?? status}
                </span>
            </header>

            {notice && (
                <div className="automation-notice" role="status">
                    {notice}
                </div>
            )}

            <div className="codegen-card">
                <label className="codegen-label" htmlFor="codegen-url">
                    URL ứng dụng
                </label>
                <div className="codegen-row">
                    <input
                        id="codegen-url"
                        className="codegen-input"
                        type="text"
                        placeholder="https://example.com"
                        value={url}
                        disabled={status === "RECORDING" || actions.start.isPending}
                        onChange={event => setUrl(event.target.value)}
                    />
                    <button
                        className="button button--primary"
                        type="button"
                        disabled={status === "RECORDING" || busy}
                        onClick={handleStart}
                    >
                        Bắt đầu ghi
                    </button>
                    <button
                        className="button button--danger"
                        type="button"
                        disabled={status !== "RECORDING" || actions.stop.isPending}
                        onClick={handleStop}
                    >
                        Dừng ghi
                    </button>
                </div>
            </div>

            <div className="codegen-card">
                <div className="codegen-row codegen-row--between">
                    <label className="codegen-label" htmlFor="codegen-filename">
                        Tên file script
                    </label>
                    <span className="codegen-hint">
                        Mặc định: {defaultFileName} — dùng Save As của trình duyệt để chọn nơi lưu.
                    </span>
                </div>
                <div className="codegen-row">
                    <input
                        id="codegen-filename"
                        className="codegen-input"
                        type="text"
                        placeholder={defaultFileName}
                        value={fileName}
                        disabled={!visibleScript.trim()}
                        onChange={event => setFileName(event.target.value)}
                    />
                    <button
                        className="button button--secondary"
                        type="button"
                        disabled={!visibleScript.trim()}
                        onClick={handleSave}
                    >
                        Lưu script
                    </button>
                    <button
                        className="button button--secondary"
                        type="button"
                        disabled={!visibleScript.trim() || actions.run.isPending}
                        onClick={handleRun}
                    >
                        Chạy thử
                    </button>
                    <button
                        className="button button--secondary"
                        type="button"
                        disabled={busy}
                        onClick={handleCleanup}
                    >
                        Dọn phiên
                    </button>
                </div>
            </div>

            <div className="codegen-card">
                <label className="codegen-label">Script đã sinh</label>
                <pre className="codegen-script" data-testid="codegen-script">
                    {visibleScript.trim() || "// Chưa có script. Bấm \"Bắt đầu ghi\" rồi thao tác trên trình duyệt."}
                </pre>
            </div>

            {runResult && (
                <div className={`codegen-run ${runResult.passed ? "codegen-run--pass" : "codegen-run--fail"}`}>
                    <strong>{runResult.passed ? "PASS" : "FAIL"}</strong>
                    <span>{runResult.error || runResult.diagnostic || `Mã thoát: ${runResult.status}`}</span>
                    {runResult.output && <pre className="codegen-output">{runResult.output}</pre>}
                </div>
            )}
        </section>
    );
}
