import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import V3RecordingPreparationPanel from "../components/automationV3/V3RecordingPreparationPanel.jsx";
import {
    useCodeGenRecordings,
    useCodeGenStatus,
    useCodeGenActions
} from "../hooks/useCodeGen.js";

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

    const isRecording = statusQuery.data?.status === "RECORDING";
    const busy = actions.start.isPending || actions.stop.isPending || actions.focus.isPending;

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

    if (recordingsQuery.isPending) return <div className="page">Đang tải...</div>;

    return (
        <section className="page codegen-page">
            <Link className="back-link" to="/">
                ← Về Dashboard
            </Link>
            {/* P0 — Header gọn: page title chính + subtitle ngắn; bỏ CODEGEN MVP / badge / mô tả cũ. */}
            <header className="codegen-page__heading">
                <div>
                    <h2>Playwright CodeGen</h2>
                    <p>Ghi hoặc dán bản ghi Playwright, tạo thao tác và lưu vào Thư viện.</p>
                </div>
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

            {/* II/III + Thư viện — shared component (global recording).
                P0 — bọc card để padding/margin khớp layout (không dính sát mép phải như các card khác).
                P0-3 — splitLayout: CodeGen = 2 cột (trái recording cố định · phải tạo thao tác). */}
            <div className="codegen-card">
                <V3RecordingPreparationPanel
                    splitLayout
                    onSavedToLibrary={count => setNotice(`Đã lưu ${count} thao tác vào Thư viện.`)}
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
