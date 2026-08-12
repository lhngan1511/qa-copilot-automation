import { useMemo, useState } from "react";
import { rangesOverlap } from "../../utils/automationV3.js";
import { setRecordingScript, getRecording, createLibraryAction, analyzeRecording, createRecording } from "../../api/codeGenApi.js";
import { ACTION_LABEL } from "../../utils/automationV3.js";

/*
 V3RecordingPreparationPanel — SHARED component (P0 Consolidation).

 OWNER: Codegen (record/paste → parse → cut-many → confirmed actions → save Library).
 REUSE: Automation fallback "Tạo thao tác mới từ bản ghi" (mode secondary; bind LIB vào testcase).

 KIẾN TRÚC (không qua Automation Workspace):
   Record/Paste → GLOBAL Recording (workspaceId=null, /api/codegen) → Parse → Cut → Confirm
   → ActionLibrary.create() (POST /api/codegen/library) → LIB-*
   onConfirmedSegment(blockId, label) — fallback Automation bind LIB vào testcase.
*/

const readableAssertion = a => {
    const matcher = a.matcher || "";
    const target = a.expected || (a.locator ? String(a.locator).replace(/^page\./, "") : "phần tử");
    if (matcher === "toBeHidden") return `${target} không hiển thị`;
    if (matcher === "toHaveURL") return `URL = ${a.expected}`;
    if (matcher === "toHaveValue") return `${target} có giá trị ${a.expected}`;
    if (matcher === "toBeDisabled") return `${target} vô hiệu`;
    return `${target} hiển thị`;
};

const STEP_LABEL = step => {
    const act = ACTION_LABEL[step.actionType] ?? step.actionType ?? "";
    const target = step.target || step.locator || "";
    return `${act}${target ? ` ${target}` : ""}`.trim();
};

export default function V3RecordingPreparationPanel({ workspaceId, onSavedToLibrary, onError, onConfirmedSegment }) {
    const [source, setSource] = useState("");
    const [recordingId, setRecordingId] = useState(null);
    const [steps, setSteps] = useState([]);
    const [assertions, setAssertions] = useState([]);
    const [mode, setMode] = useState("all"); // all | part
    const [startSel, setStartSel] = useState(null);
    const [endSel, setEndSel] = useState(null);
    const [name, setName] = useState("");
    const [confirmed, setConfirmed] = useState([]); // [{ blockId, label, startStep, endStep, stepCount }]
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState("");
    // AI Recording Analysis — proposals (chưa persist; chỉ proposal)
    const [proposals, setProposals] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [showSteps, setShowSteps] = useState(false);

    const notifyError = msg => { setLocalError(msg); onError?.(msg); };

    const handlePasteDone = async () => {
        if (saving || !source.trim()) return;
        setSaving(true);
        setLocalError("");
        try {
            // P0 Cleanup — Paste KHÔNG spawn recorder: tạo global recording trực tiếp (không mở browser).
            const created = await createRecording({ url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
            const recId = created?.data?.recordingId ?? created?.recordingId;
            if (!recId) throw new Error("Không tạo được bản ghi.");
            await setRecordingScript(recId, { script: source });
            const detail = await getRecording(recId);
            const rec = detail?.data ?? detail;
            setRecordingId(recId);
            setSteps(Array.isArray(rec?.steps) ? rec.steps : []);
            setAssertions(Array.isArray(rec?.assertions) ? rec.assertions : []);
            setStartSel(Array.isArray(rec?.steps) && rec.steps.length > 0 ? rec.steps[0].order : null);
            setEndSel(Array.isArray(rec?.steps) && rec.steps.length > 0 ? rec.steps[rec.steps.length - 1].order : null);
            if (!Array.isArray(rec?.steps) || rec.steps.length === 0) notifyError("Bản ghi không có thao tác nào.");
        } catch (e) {
            notifyError(e?.message ?? "Không đọc được bản ghi.");
        } finally {
            setSaving(false);
        }
    };

    const selRange = useMemo(() => {
        if (steps.length === 0) return null;
        if (mode === "all") return { start: steps[0].order, end: steps[steps.length - 1].order, count: steps.length };
        if (!Number.isInteger(startSel) || !Number.isInteger(endSel)) return null;
        return { start: Math.min(startSel, endSel), end: Math.max(startSel, endSel), count: Math.abs(endSel - startSel) + 1 };
    }, [steps, mode, startSel, endSel]);

    // P0 Assertion Scoping — chỉ hiển thị verification thuộc range đang chọn
    // (cùng source-range rule backend: assertion trong phạm vi steps HOẶC trailing ≤120 ký tự sau action cuối).
    const scopedAssertions = useMemo(() => {
        if (!selRange || steps.length === 0) return [];
        const selSteps = steps.filter(s => s.order >= selRange.start && s.order <= selRange.end);
        if (selSteps.length === 0) return [];
        const firstStart = Math.min(...selSteps.map(s => s.sourceStart ?? 0));
        const lastStart = Math.min(...selSteps.map(s => s.sourceStart ?? 0));
        const lastEnd = Math.max(...selSteps.map(s => s.sourceEnd ?? 0));
        return assertions.filter(a => {
            const as = a.sourceStart ?? -1, ae = a.sourceEnd ?? -1;
            if (as >= firstStart && ae <= lastEnd) return true;
            if (as >= lastStart && as <= lastEnd + 120) return true;
            return false;
        });
    }, [assertions, selRange, steps]);

    const handleAnalyze = async () => {
        if (analyzing || !recordingId) return;
        setAnalyzing(true);
        setLocalError("");
        try {
            const res = await analyzeRecording({ recordingId });
            const data = res?.data ?? res;
            setProposals(Array.isArray(data?.proposals) ? data.proposals : []);
            if (!Array.isArray(data?.proposals) || data.proposals.length === 0) setLocalError("Không có đề xuất (AI không khả dụng) — bạn có thể tự chọn đoạn.");
        } catch (e) {
            setLocalError(e?.message ?? "Không phân tích được bản ghi.");
        } finally {
            setAnalyzing(false);
        }
    };

    // Tester xác nhận proposal → framework dùng range (tester có thể chỉnh) + tên (có thể đổi) → Library.
    const applyProposal = async (proposal) => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            const label = proposal.suggestedName?.trim();
            if (!label) { notifyError("Vui lòng đặt tên cho đoạn (hoặc Bỏ qua)."); return; }
            if (!Number.isInteger(proposal.startStep) || !Number.isInteger(proposal.endStep)) { notifyError("Đoạn không hợp lệ."); return; }
            const res = await createLibraryAction({
                recordingId,
                label,
                kind: "ACTION",
                startStep: proposal.startStep,
                endStep: proposal.endStep
            });
            const data = res?.data ?? res;
            const blockId = data?.blockId;
            if (!blockId) throw new Error("Không tạo được thao tác thư viện.");
            setConfirmed(prev => [...prev, {
                blockId,
                label,
                startStep: proposal.startStep,
                endStep: proposal.endStep,
                stepCount: proposal.endStep - proposal.startStep + 1
            }]);
            onConfirmedSegment?.(blockId, label);
            setProposals(prev => prev.filter(p => p !== proposal));
        } catch (e) {
            notifyError(e?.message ?? "Không xác nhận được đoạn.");
        } finally {
            setSaving(false);
        }
    };

    const confirmSegment = async () => {
        if (!selRange || saving) return;
        setSaving(true);
        setLocalError("");
        try {
            const label = name.trim();
            if (!label) { notifyError("Vui lòng đặt tên thao tác."); return; }
            // ActionLibrary.create() — backend slice steps/assertions từ global recording (không tin frontend).
            const res = await createLibraryAction({
                recordingId,
                label,
                kind: "ACTION",
                startStep: selRange.start,
                endStep: selRange.end
            });
            const data = res?.data ?? res;
            const blockId = data?.blockId;
            if (!blockId) throw new Error("Không tạo được thao tác thư viện.");
            setConfirmed(prev => [...prev, {
                blockId,
                label,
                startStep: selRange.start,
                endStep: selRange.end,
                stepCount: selRange.count
            }]);
            // Fallback (Automation): bind LIB vào testcase đang mở.
            onConfirmedSegment?.(blockId, label);
            setName("");
            setMode("all");
            setStartSel(null);
            setEndSel(null);
        } catch (e) {
            notifyError(e?.message ?? "Không xác nhận được đoạn.");
        } finally {
            setSaving(false);
        }
    };

    const saveAllToLibrary = async () => {
        if (saving || confirmed.length === 0) return;
        // Các đoạn đã được tạo thẳng vào Library khi confirm (confirmSegment → createLibraryAction).
        // Nút này chỉ thông báo; không tạo lại (tránh duplicate LIB).
        onSavedToLibrary?.(confirmed.length);
        setConfirmed([]);
    };

    return (
        <div className="v3-rec-prep">
            <div className="v3-exp__row">
                <h4 className="v3-map__h">BẢN GHI PLAYWRIGHT</h4>
                <span className="v3-exp__note">Dán bản ghi — MỘT nguồn canonical (global)</span>
            </div>

            <textarea
                className="v3-input"
                rows={6}
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder={"await page.goto('...');\nawait page.getByRole('button', { name: '...' }).click();\nawait expect(...).toBeVisible();"}
                spellCheck={false}
            />
            {steps.length === 0 ? (
                <button type="button" className="v3-btn v3-btn--primary" onClick={handlePasteDone} disabled={saving || !source.trim()}>
                    {saving ? "Đang đọc…" : "Nhập xong"}
                </button>
            ) : (
                <div className="v3-act__add">
                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={handleAnalyze} disabled={analyzing || saving}>
                        {analyzing ? "Đang phân tích…" : "Phân tích bản ghi"}
                    </button>
                    <span className="v3-exp__note">AI đề xuất cụm thao tác — bạn xác nhận/chỉnh. AI không tự lưu.</span>
                </div>
            )}

            {steps.length > 0 ? (
                <div className="v3-act__summary">
                    <span><b>{steps.length} thao tác</b> · <b>{assertions.length} điều kiện kiểm tra</b></span>
                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setShowSteps(v => !v)}>
                        {showSteps ? "Thu gọn" : "Xem chi tiết"}
                    </button>
                    {showSteps ? (
                        <div className="v3-steps">
                            {steps.map(s => (
                                <div className="v3-step" key={s.order}>
                                    <span className="v3-step__n">{s.order}</span>
                                    <span className="v3-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                                    <span className="v3-step__loc">{s.target || s.locator || "—"}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {localError ? <div className="v3-banner v3-banner--error" role="alert">{localError}</div> : null}

            {proposals.length > 0 ? (
                <div className="v3-act__proposals">
                    <h5 className="v3-map__h">AI đề xuất:</h5>
                    {proposals.map((p, i) => (
                        <div className="v3-cond v3-cond--compact" key={`${p.startStep}-${p.endStep}-${i}`}>
                            <div className="v3-cond__body">
                                <b>{i + 1}. Bước {p.startStep} → {p.endStep} · {p.suggestedName || "(chưa đủ bằng chứng)"}</b>
                                {p.evidence?.length > 0 ? (
                                    <span className="v3-cond__meta">Evidence: {p.evidence.join(" · ")}</span>
                                ) : null}
                                {p.confidence != null ? <span className="v3-cond__meta">Độ tin cậy: {Math.round(p.confidence * 100)}%</span> : null}
                            </div>
                            <div className="v3-cond__actions">
                                <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={() => applyProposal(p)} disabled={saving}>
                                    Xác nhận
                                </button>
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => {
                                    // Chỉnh phạm vi: đổ vào manual range (tester sửa rồi Xác nhận đoạn).
                                    setMode("part");
                                    setStartSel(p.startStep);
                                    setEndSel(p.endStep);
                                    setName(p.suggestedName || "");
                                    setProposals(prev => prev.filter(x => x !== p));
                                }} disabled={saving}>
                                    Chỉnh phạm vi
                                </button>
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setProposals(prev => prev.filter(x => x !== p))} disabled={saving}>
                                    Bỏ qua
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {steps.length > 0 ? (
                <div className="v3-act__range">
                    <p className="v3-act__note">Bạn muốn dùng phần nào?</p>
                    <label className="v3-radio">
                        <input type="radio" name="use-mode" checked={mode === "all"} onChange={() => setMode("all")} />
                        <span>Dùng toàn bộ bản ghi</span>
                    </label>
                    <label className="v3-radio">
                        <input type="radio" name="use-mode" checked={mode === "part"} onChange={() => setMode("part")} />
                        <span>Chọn một phần</span>
                    </label>

                    {mode === "part" ? (
                        <div className="v3-act__part">
                            <label className="v3-map__label">
                                Bắt đầu
                                <select className="v3-input" value={startSel ?? ""} onChange={e => setStartSel(Number(e.target.value))}>
                                    {steps.map(s => <option key={s.order} value={s.order}>{s.order} — {STEP_LABEL(s)}</option>)}
                                </select>
                            </label>
                            <label className="v3-map__label">
                                Kết thúc
                                <select className="v3-input" value={endSel ?? ""} onChange={e => setEndSel(Number(e.target.value))}>
                                    {steps.map(s => <option key={s.order} value={s.order}>{s.order} — {STEP_LABEL(s)}</option>)}
                                </select>
                            </label>
                        </div>
                    ) : null}

                    {selRange ? (
                        <div className="v3-act__preview">
                            <b>Đã chọn bước {selRange.start} → {selRange.end} · {selRange.count} thao tác</b>
                            <div className="v3-steps">
                                {steps
                                    .filter(s => s.order >= selRange.start && s.order <= selRange.end)
                                    .map(s => (
                                        <div className="v3-step" key={s.order}>
                                            <span className="v3-step__n">{s.order}</span>
                                            <span className="v3-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                                            <span className="v3-step__loc">{s.target || s.locator || "—"}</span>
                                        </div>
                                    ))}
                            </div>
                            {scopedAssertions.length > 0 ? (
                                <div className="v3-act__verif">
                                    <span className="v3-act__note">Điều kiện kiểm tra trong đoạn:</span>
                                    {scopedAssertions.map((a, i) => (
                                        <div className="v3-cond v3-cond--compact" key={i}>
                                            <div className="v3-cond__body">
                                                <b>{readableAssertion(a)}</b>
                                                <details className="v3-act__tech">
                                                    <summary>Xem kỹ thuật</summary>
                                                    <code className="v3-exp__stmt">{a.statement || a.matcher}</code>
                                                </details>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="v3-act__note">Không có điều kiện kiểm tra được ghi trong đoạn này.</p>
                            )}
                        </div>
                    ) : null}

                    <div className="v3-act__range-actions">
                        <input className="v3-input v3-act__name" value={name} onChange={e => setName(e.target.value)} placeholder="Tên thao tác (lưu Thư viện)" />
                        <button type="button" className="v3-btn v3-btn--primary" onClick={confirmSegment} disabled={!selRange || saving}>
                            {saving ? "Đang lưu…" : "Xác nhận đoạn"}
                        </button>
                    </div>
                </div>
            ) : null}

            {confirmed.length > 0 ? (
                <div className="v3-act__saved">
                    <p className="v3-act__note">Các đoạn đã xác nhận (đã vào Thư viện):</p>
                    {confirmed.map((seg, i) => (
                        <div className="v3-cond v3-cond--compact" key={seg.blockId}>
                            <div className="v3-cond__body">
                                <b>{i + 1}. {seg.label} · bước {seg.startStep} → {seg.endStep}</b>
                                <span className="v3-cond__meta">{seg.stepCount} thao tác · ✓ Đã lưu (LIB-*)</span>
                            </div>
                        </div>
                    ))}
                    <button type="button" className="v3-btn v3-btn--primary" onClick={saveAllToLibrary} disabled={saving}>
                        Lưu vào thư viện thao tác
                    </button>
                </div>
            ) : null}
        </div>
    );
}
