import { useEffect, useMemo, useRef, useState } from "react";
import { setRecordingScript, getRecording, createLibraryAction, analyzeRecording, createRecording, listLibrary, deleteLibraryAction } from "../../api/codeGenApi.js";
import { ACTION_LABEL } from "../../utils/automationV3.js";
import { freshAnalysisWorkspace, initializeAnalysisFromSteps, isStepInRange } from "../../utils/recordingPrepState.js";

/*
 V3RecordingPreparationPanel — SHARED (Codegen owner; fallback Automation).

 Mental model (P0-3): Recording = NGUỒN CỐ ĐỊNH của cả phiên tạo thao tác.
   Action = một đoạn Start → End lấy ra từ recording đó.
   Sau khi xác nhận action, recording KHÔNG được đóng/reset/thay thế/biến mất —
   tester tiếp tục chọn range khác từ CÙNG recording (RECORD ONCE → CUT MANY).

 P0-3 — CODEGEN WORKSPACE SPLIT LAYOUT (chỉ áp dụng khi prop splitLayout — CodeGenPage):
   - Parse xong → 2 cột: TRÁI ~60% = I. BẢN GHI (nguồn cố định, quan sát/đối chiếu,
     steps luôn hiển thị, scroll; KHÔNG checkbox/click/multi-select/drag — chọn đoạn
     CHỈ qua Bắt đầu/Kết thúc bên phải); PHẢI ~40% = II. TẠO THAO TÁC + THAO TÁC ĐÃ TẠO.
   - Highlight range bên trái = VISUAL feedback thuần (v3-step--range) — không phải control.
   - AI HỖ TRỢ nằm TRÊN manual; AI chỉ điền Start/End/Tên vào form manual — tester vẫn
     bấm [Xác nhận thao tác].
   - THAO TÁC ĐÃ TẠO compact: `Tên · bước X→Y` + [Sửa][Xóa]; KHÔNG bung steps trong danh sách.
   - splitLayout=false (fallback Automation trong drawer) → giữ bố cục 1 cột cũ.

 P0-1 — Recording context isolation: đổi nội dung textarea → reset TOÀN BỘ analysis
   workspace Phần II (freshAnalysisWorkspace) + gen guard (parseGen) chặn async cũ;
   parse xong init LẠI từ steps mới (initializeAnalysisFromSteps). KHÔNG reset Library.

 P0-2 — Delete confirm Library: confirm NHỎ cạnh action (v3-lib-delete-inline);
   cảnh báo '⚠ N testcase đang phụ thuộc' CHỈ khi usedByTestCases > 0. Không modal,
   không full-width danger box.
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

export default function V3RecordingPreparationPanel({ workspaceId, onSavedToLibrary, onError, onConfirmedSegment, splitLayout = false }) {
    const [source, setSource] = useState("");
    const [recordingId, setRecordingId] = useState(null);
    const [steps, setSteps] = useState([]);
    const [assertions, setAssertions] = useState([]);
    // P0 — source đã parse + trạng thái parse (auto re-parse khi đổi nội dung).
    const [parsedSource, setParsedSource] = useState("");
    const [parsing, setParsing] = useState(false);
    const parseTimer = useRef(null);
    const parseGen = useRef(0);
    // Phần I — collapsed mặc định (chỉ dùng bố cục 1 cột; split layout luôn hiển thị steps)
    const [showRecording, setShowRecording] = useState(false);
    // Phần II — manual
    const [startSel, setStartSel] = useState(null);
    const [endSel, setEndSel] = useState(null);
    const [name, setName] = useState("");
    // AI
    const [proposals, setProposals] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    // P0-3.1 — AI status NGAY trong section AI HỖ TRỢ (không full-width red alert):
    // null = không có thông báo; { kind: "empty" } = AI trả về hợp lệ nhưng không có gợi ý;
    // { kind: "error", message, retryable } = request thật sự fail.
    const [aiStatus, setAiStatus] = useState(null);
    // Đã tạo
    const [confirmed, setConfirmed] = useState([]); // [{ blockId, label, startStep, endStep, stepCount, assertionCount }]
    // P0 Library Visibility
    const [library, setLibrary] = useState([]);
    const [showLibrary, setShowLibrary] = useState(false);
    const [expandedLibId, setExpandedLibId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [saveFeedback, setSaveFeedback] = useState(null); // { count }
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState("");

    const notifyError = msg => { setLocalError(msg); onError?.(msg); };

    /* ---------- P0-1: reset context recording cũ (khi tester nhập bản ghi mới) ---------- */

    /** P0-1 — áp "analysis workspace" Phần II vào state (reset hoặc init từ steps mới). */
    const applyAnalysisWorkspace = ws => {
        setStartSel(ws.startSel);
        setEndSel(ws.endSel);
        setName(ws.name);
        setProposals(ws.proposals);
    };

    const resetRecordingContext = () => {
        clearTimeout(parseTimer.current);
        parseTimer.current = null;
        parseGen.current += 1; // vô hiệu hóa mọi async đang chạy của recording cũ (AI analyze/confirm)
        setRecordingId(null);
        setSteps([]);
        setAssertions([]);
        setAnalyzing(false);
        setAiStatus(null); // P0-3.1 — thông báo AI của bản cũ không rò rỉ sang bản mới.
        // P0-1 — reset TOÀN BỘ analysis workspace Phần II (start/end/name/AI proposals).
        applyAnalysisWorkspace(freshAnalysisWorkspace());
        setConfirmed([]);
        setSaveFeedback(null);
        setShowRecording(false);
        setExpandedLibId(null);
        setDeleteConfirmId(null);
    };

    /* ---------- Phần I: nhận recording (parse) ---------- */

    const doParse = async (src, gen) => {
        setParsing(true);
        setLocalError("");
        try {
            // P0 Cleanup — Paste KHÔNG spawn recorder.
            const created = await createRecording({ url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
            const recId = created?.data?.recordingId ?? created?.recordingId;
            if (!recId) throw new Error("Không tạo được bản ghi.");
            await setRecordingScript(recId, { script: src });
            const detail = await getRecording(recId);
            const rec = detail?.data ?? detail;
            if (gen !== parseGen.current) return; // tester đã đổi nội dung — bỏ kết quả cũ.
            const parsedSteps = Array.isArray(rec?.steps) ? rec.steps : [];
            const parsedAssertions = Array.isArray(rec?.assertions) ? rec.assertions : [];
            setRecordingId(recId);
            setSteps(parsedSteps);
            setAssertions(parsedAssertions);
            // P0-1 — initialize LẠI hoàn toàn analysis workspace Phần II từ steps MỚI.
            applyAnalysisWorkspace(initializeAnalysisFromSteps(parsedSteps));
            setParsedSource(src);
            if (parsedSteps.length === 0) notifyError("Bản ghi không có thao tác nào.");
        } catch (e) {
            if (gen === parseGen.current) notifyError(e?.message ?? "Không đọc được bản ghi.");
        } finally {
            if (gen === parseGen.current) setParsing(false);
        }
    };

    /** P0 — nội dung bản ghi đổi → reset context cũ + TỰ phân tích lại (không cần F5). */
    const handleSourceChange = value => {
        setSource(value);
        if (value.trim() && value.trim() === (parsedSource ?? "").trim()) return;
        resetRecordingContext();
        if (!value.trim()) { setParsedSource(""); return; }
        parseTimer.current = setTimeout(() => doParse(value, parseGen.current), 500);
    };

    const handlePasteDone = async () => {
        if (saving || !source.trim()) return;
        clearTimeout(parseTimer.current);
        parseTimer.current = null;
        await doParse(source, parseGen.current);
    };

    // Dọn timer khi unmount (tránh setState sau khi rời màn).
    useEffect(() => () => clearTimeout(parseTimer.current), []);

    /* ---------- Phần II: range + verification scoped ---------- */

    const selRange = useMemo(() => {
        if (steps.length === 0) return null;
        if (!Number.isInteger(startSel) || !Number.isInteger(endSel)) return null;
        return { start: Math.min(startSel, endSel), end: Math.max(startSel, endSel), count: Math.abs(endSel - startSel) + 1 };
    }, [steps, startSel, endSel]);

    const selSteps = useMemo(() => {
        if (!selRange) return [];
        return steps.filter(s => s.order >= selRange.start && s.order <= selRange.end);
    }, [steps, selRange]);

    const scopedAssertions = useMemo(() => {
        if (!selRange || selSteps.length === 0) return [];
        const firstStart = Math.min(...selSteps.map(s => s.sourceStart ?? 0));
        const lastStart = Math.min(...selSteps.map(s => s.sourceStart ?? 0));
        const lastEnd = Math.max(...selSteps.map(s => s.sourceEnd ?? 0));
        return assertions.filter(a => {
            const as = a.sourceStart ?? -1, ae = a.sourceEnd ?? -1;
            if (as >= firstStart && ae <= lastEnd) return true;
            if (as >= lastStart && as <= lastEnd + 120) return true;
            return false;
        });
    }, [assertions, selSteps, selRange]);

    /* ---------- Phần II: AI ---------- */

    const handleAnalyze = async () => {
        if (analyzing || !recordingId) return;
        const gen = parseGen.current;
        setAnalyzing(true);
        setAiStatus(null);
        try {
            const res = await analyzeRecording({ recordingId });
            if (gen !== parseGen.current) return; // P0-1 — recording đã đổi — bỏ kết quả AI của bản cũ.
            const data = res?.data ?? res;
            // P0-3.1 — backend đính lý do tại body.error (contract `{ success, data, error }`).
            const err = data?.error ?? res?.error;
            const got = Array.isArray(data?.proposals) ? data.proposals : [];
            setProposals(got);
            // P0-3.1 — phân biệt: request fail (có error từ backend) vs empty hợp lệ (error null).
            if (got.length > 0) {
                setAiStatus(null);
            } else if (err) {
                setAiStatus({ kind: "error", message: "Không thể lấy gợi ý lúc này.", retryable: err.retryable !== false });
            } else {
                setAiStatus({ kind: "empty" });
            }
        } catch (e) {
            if (gen !== parseGen.current) return;
            setAiStatus({ kind: "error", message: "Không thể lấy gợi ý lúc này.", retryable: true });
        } finally {
            if (gen === parseGen.current) setAnalyzing(false);
        }
    };

    /* ---------- Phần II: confirm đoạn (manual + AI cùng đường) ---------- */

    const createConfirmedAction = async (s, e, label) => {
        const gen = parseGen.current;
        setSaving(true);
        setLocalError("");
        try {
            const res = await createLibraryAction({ recordingId, label, kind: "ACTION", startStep: s, endStep: e });
            const data = res?.data ?? res;
            const blockId = data?.blockId;
            if (!blockId) throw new Error("Không tạo được thao tác thư viện.");
            if (gen !== parseGen.current) return; // P0-1 — recording đã đổi — không đổ vào working set của bản mới.
            setConfirmed(prev => [...prev, {
                blockId, label, startStep: s, endStep: e,
                stepCount: e - s + 1,
                assertionCount: data?.recordedAssertionCount ?? 0
            }]);
            onConfirmedSegment?.(blockId, label);
            // P0-3 — KHÔNG reset steps/source/recordingId: recording là nguồn cố định,
            // tester tiếp tục chọn range khác từ CÙNG recording. Chỉ xóa form để chọn đoạn mới.
            setName("");
            setStartSel(null);
            setEndSel(null);
        } catch (err) {
            if (gen === parseGen.current) notifyError(err?.message ?? "Không xác nhận được đoạn.");
        } finally {
            if (gen === parseGen.current) setSaving(false);
        }
    };

    const confirmSegment = async () => {
        if (!selRange || saving) return;
        const label = name.trim();
        if (!label) { notifyError("Vui lòng đặt tên thao tác."); return; }
        await createConfirmedAction(selRange.start, selRange.end, label);
    };

    const saveAllToLibrary = async () => {
        if (saving || confirmed.length === 0) return;
        setSaving(true);
        setLocalError("");
        try {
            // Các đoạn đã vào Library khi confirm (createConfirmedAction → createLibraryAction).
            // KHÔNG auto-clear working set — tester vẫn thấy các action vừa tạo.
            const res = await listLibrary();
            const data = res?.data ?? res;
            setLibrary(Array.isArray(data) ? data : []);
            setSaveFeedback({ count: confirmed.length });
            setShowLibrary(true);
            onSavedToLibrary?.(confirmed.length);
        } catch (e) {
            notifyError(e?.message ?? "Không đọc được thư viện.");
        } finally {
            setSaving(false);
        }
    };

    /* ---------- P0-2: Thư viện — Xóa (confirm nhỏ cạnh action, báo rõ usage) ---------- */

    const doDeleteLibrary = async block => {
        if (deletingId) return;
        setDeletingId(block.blockId);
        setLocalError("");
        try {
            await deleteLibraryAction(block.blockId);
            setLibrary(prev => prev.filter(x => x.blockId !== block.blockId));
            setDeleteConfirmId(null);
            if (expandedLibId === block.blockId) setExpandedLibId(null);
        } catch (e) {
            notifyError(e?.message ?? "Không xóa được thao tác thư viện.");
        } finally {
            setDeletingId(null);
        }
    };

    const refreshLibrary = async () => {
        try {
            const res = await listLibrary();
            const data = res?.data ?? res;
            setLibrary(Array.isArray(data) ? data : []);
        } catch {
            /* giữ */
        }
    };

    /** Steps render — highlight range VISUAL khi highlight=true (cột trái split). */
    const renderSteps = (list, highlight = false) => (
        <div className="v3-steps">
            {list.map(s => (
                <div className={`v3-step${highlight && isStepInRange(s.order, startSel, endSel) ? " v3-step--range" : ""}`} key={s.order}>
                    <span className="v3-step__n">{s.order}</span>
                    <span className="v3-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                    <span className="v3-step__loc">{s.target || s.locator || "—"}</span>
                </div>
            ))}
        </div>
    );

    /* ============ Phần II + THAO TÁC ĐÃ TẠO — panel phải (dùng chung 2 bố cục) ============ */

    const renderActionSection = () => (
        <>
            <div className="v3-act__seg">
                <h4 className="v3-map__h">II. TẠO THAO TÁC</h4>
                {/* AI TRÊN manual — AI chỉ điền Start/End/Tên, tester vẫn Xác nhận */}
                <div className="v3-act__ai-help">
                    <span className="v3-act__ai-title">AI HỖ TRỢ</span>
                    <button type="button" className="v3-btn v3-btn--secondary v3-btn--mini" onClick={handleAnalyze} disabled={analyzing || saving}>
                        {analyzing ? "Đang phân tích…" : "Gợi ý cách chia thao tác"}
                    </button>
                </div>
                {/* P0-3.1 — AI status NGAY trong section AI (compact; không full-width red alert;
                    AI là assistant tùy chọn — failure không trình bày như workflow failure). */}
                {aiStatus?.kind === "empty" ? (
                    <p className="v3-act__ai-status">Không nhận được gợi ý. Bạn vẫn có thể tự chọn bên dưới.</p>
                ) : aiStatus?.kind === "error" ? (
                    <p className="v3-act__ai-status v3-act__ai-status--error">
                        {aiStatus.message}
                        {aiStatus.retryable ? (
                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={handleAnalyze} disabled={analyzing || saving}>
                                Thử lại
                            </button>
                        ) : null}
                    </p>
                ) : null}

                {proposals.length > 0 ? (
                    <div className="v3-act__proposals">
                        {proposals.slice(0, 3).map((proposal, idx) => {
                            const overlapItem = confirmed.find(c => c.startStep <= proposal.endStep && c.endStep >= proposal.startStep);
                            const blocked = Boolean(overlapItem);
                            return (
                                <div className="v3-cond v3-cond--compact" key={`${proposal.startStep}-${proposal.endStep}-${idx}`}>
                                    <div className="v3-cond__body">
                                        <b>Gợi ý {idx + 1}/{proposals.length} — {proposal.suggestedName || "(chưa đủ bằng chứng)"}</b>
                                        <span className="v3-cond__meta">Bước {proposal.startStep} → {proposal.endStep}</span>
                                        {blocked ? (
                                            <span className="v3-cond__meta v3-warn">⚠ Trùng với thao tác đã tạo "{overlapItem.label}" — bỏ qua hoặc chọn gợi ý khác.</span>
                                        ) : proposal.evidence?.length > 0 ? (
                                            <span className="v3-cond__meta">Evidence: {proposal.evidence.join(" · ")}</span>
                                        ) : null}
                                    </div>
                                    <div className="v3-cond__actions">
                                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={saving || blocked} onClick={() => {
                                            // AI KHÔNG tự confirm — chỉ điền Start/End/Tên vào form manual.
                                            setStartSel(proposal.startStep); setEndSel(proposal.endStep); setName(proposal.suggestedName || "");
                                            setProposals(prev => prev.filter(x => x !== proposal));
                                        }}>Dùng gợi ý</button>
                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setProposals(prev => prev.filter(x => x !== proposal))} disabled={saving}>Bỏ</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}

                {/* Manual — chọn Start/End (cách duy nhất để chọn đoạn) */}
                <div className="v3-act__manual">HOẶC TỰ CHỌN</div>
                {/* P0-3.1 — thứ tự: Tên thao tác TRƯỚC Start/End (recording readable đã cố định ở cột trái). */}
                <label className="v3-map__label v3-act__name-field">
                    Tên thao tác
                    <input className="v3-input v3-act__name" value={name} onChange={e => setName(e.target.value)} placeholder="VD: Đăng nhập, Mở danh mục…" />
                </label>
                <div className="v3-act__part">
                    <label className="v3-map__label">
                        Bắt đầu
                        <select className="v3-input" value={startSel ?? ""} onChange={e => setStartSel(e.target.value === "" ? null : Number(e.target.value))}>
                            {!Number.isInteger(startSel) ? <option value="">Chọn bước…</option> : null}
                            {steps.map(s => <option key={s.order} value={s.order}>{s.order} — {STEP_LABEL(s)}</option>)}
                        </select>
                    </label>
                    <label className="v3-map__label">
                        Kết thúc
                        <select className="v3-input" value={endSel ?? ""} onChange={e => setEndSel(e.target.value === "" ? null : Number(e.target.value))}>
                            {!Number.isInteger(endSel) ? <option value="">Chọn bước…</option> : null}
                            {steps.map(s => <option key={s.order} value={s.order}>{s.order} — {STEP_LABEL(s)}</option>)}
                        </select>
                    </label>
                </div>

                {selRange ? (
                    <div className="v3-act__preview">
                        <b>ĐOẠN ĐANG CHỌN</b>
                        <p className="v3-act__note">Bước {selRange.start} → {selRange.end} · {selRange.count} thao tác</p>
                        {/* Split layout: steps đã hiện + highlight ở cột trái → không duplicate preview ở đây.
                            Bố cục 1 cột (fallback drawer): giữ preview steps (UX dài 16-30 bước là checkpoint riêng). */}
                        {!splitLayout ? renderSteps(selSteps, true) : null}
                        <div className="v3-act__verif">
                            {scopedAssertions.length > 0 ? (
                                <>
                                    <span className="v3-act__note">Điều kiện kiểm tra:</span>
                                    {scopedAssertions.map((a, i) => (
                                        <div className="v3-cond v3-cond--compact" key={i}>
                                            <div className="v3-cond__body">
                                                <b>✓ {readableAssertion(a)}</b>
                                                <details className="v3-act__tech"><summary>Xem kỹ thuật</summary><code className="v3-exp__stmt">{a.statement || a.matcher}</code></details>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <span className="v3-act__note">Không có điều kiện kiểm tra.</span>
                            )}
                        </div>
                    </div>
                ) : null}

                <div className="v3-act__range-actions">
                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => {
                        if (steps.length === 0) return;
                        setStartSel(steps[0].order); setEndSel(steps[steps.length - 1].order);
                    }} disabled={saving}>
                        Chọn toàn bộ
                    </button>
                    <button type="button" className="v3-btn v3-btn--primary" onClick={confirmSegment} disabled={!selRange || saving}>
                        {saving ? "Đang lưu…" : "Xác nhận thao tác"}
                    </button>
                </div>
            </div>

            {/* THAO TÁC ĐÃ TẠO — compact: Tên · bước X→Y; KHÔNG bung steps trong danh sách */}
            {confirmed.length > 0 ? (
                <div className="v3-act__saved">
                    <h4 className="v3-map__h">THAO TÁC ĐÃ TẠO</h4>
                    {confirmed.map(seg => (
                        <div className="v3-cond v3-cond--compact" key={seg.blockId}>
                            <div className="v3-cond__body">
                                <div className="v3-cond__line">
                                    <b>{seg.label}</b>
                                    <span className="v3-cond__meta">{seg.startStep}→{seg.endStep} · {seg.stepCount} thao tác</span>
                                </div>
                            </div>
                            <div className="v3-cond__actions">
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => { setStartSel(seg.startStep); setEndSel(seg.endStep); setName(seg.label); }} disabled={saving}>Sửa</button>
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setConfirmed(prev => prev.filter(x => x !== seg))} disabled={saving}>Xóa</button>
                            </div>
                        </div>
                    ))}
                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={saveAllToLibrary} disabled={saving}>
                        Lưu vào Thư viện thao tác
                    </button>
                    {saveFeedback ? (
                        <div className="v3-act__save-feedback">
                            <span className="v3-ok">✓ Đã lưu {saveFeedback.count} thao tác vào Thư viện.</span>
                            <button type="button" className="v3-btn v3-btn--secondary v3-btn--mini" onClick={() => setShowLibrary(true)}>
                                Mở Thư viện thao tác
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </>
    );

    /* ============ I. BẢN GHI — bố cục 1 cột (fallback) ============ */

    const renderRecordingSingle = () => (
        <>
            <div className="v3-exp__row">
                <h4 className="v3-map__h">I. BẢN GHI</h4>
                <span className="v3-exp__note">Dán bản ghi Playwright từ Inspector để tạo thao tác.</span>
            </div>
            <textarea
                className="v3-input"
                rows={4}
                value={source}
                onChange={e => handleSourceChange(e.target.value)}
                placeholder={"await page.goto('...');\nawait page.getByRole('button', { name: '...' }).click();\nawait expect(...).toBeVisible();"}
                spellCheck={false}
            />
            <div className="v3-act__summary">
                <span><b>{steps.length} thao tác</b> · <b>{assertions.length} điều kiện kiểm tra</b></span>
                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setShowRecording(v => !v)}>
                    {showRecording ? "Thu gọn" : "Xem bản ghi"}
                </button>
            </div>
            {showRecording ? (
                <>
                    {renderSteps(steps, true)}
                    {assertions.map((a, i) => (
                        <div className="v3-step" key={`a-${i}`}>
                            <span className="v3-step__n">A</span>
                            <span className="v3-step__act">Kiểm tra</span>
                            <span className="v3-step__loc">{readableAssertion(a)}</span>
                        </div>
                    ))}
                </>
            ) : null}
        </>
    );

    return (
        <div className="v3-rec-prep">
            {steps.length === 0 ? (
                /* ---------- Chưa có recording — dán bản ghi (2 bố cục giống nhau) ---------- */
                <>
                    <div className="v3-exp__row">
                        <h4 className="v3-map__h">I. BẢN GHI</h4>
                        <span className="v3-exp__note">Dán bản ghi Playwright từ Inspector để tạo thao tác.</span>
                    </div>
                    <textarea
                        className="v3-input"
                        rows={4}
                        value={source}
                        onChange={e => handleSourceChange(e.target.value)}
                        placeholder={"await page.goto('...');\nawait page.getByRole('button', { name: '...' }).click();\nawait expect(...).toBeVisible();"}
                        spellCheck={false}
                    />
                    <button type="button" className="v3-btn v3-btn--primary" onClick={handlePasteDone} disabled={saving || !source.trim()}>
                        {parsing || saving ? "Đang phân tích…" : "Nhập xong"}
                    </button>
                </>
            ) : splitLayout ? (
                /* ---------- P0-3 — SPLIT: trái = recording cố định · phải = tạo thao tác ---------- */
                <div className="v3-rec-prep__split">
                    <div className="v3-rec-prep__col v3-rec-prep__col--rec">
                        <div className="v3-exp__row">
                            <h4 className="v3-map__h">I. BẢN GHI</h4>
                            <span className="v3-exp__note">Nguồn cố định — quan sát, đối chiếu. Chọn đoạn ở cột phải.</span>
                        </div>
                        <div className="v3-act__summary">
                            <span><b>{steps.length} thao tác</b> · <b>{assertions.length} điều kiện kiểm tra</b></span>
                        </div>
                        {/* P0-3.1 — sau parse, raw source KHÔNG chiếm diện tích thường trực:
                            collapse thành 'Xem mã Playwright ▾' (mở để xem/thay recording — P0-1 vẫn giữ). */}
                        <details className="v3-act__raw">
                            <summary>Xem mã Playwright ▾</summary>
                            <textarea
                                className="v3-input"
                                rows={5}
                                value={source}
                                onChange={e => handleSourceChange(e.target.value)}
                                spellCheck={false}
                                aria-label="Mã Playwright gốc"
                            />
                        </details>
                        {/* Chỉ quan sát/đối chiếu — highlight range là visual feedback, KHÔNG phải control */}
                        <div className="v3-rec-prep__steps">{renderSteps(steps, true)}</div>
                    </div>
                    <div className="v3-rec-prep__col v3-rec-prep__col--actions">
                        {renderActionSection()}
                    </div>
                </div>
            ) : (
                /* ---------- 1 cột (fallback Automation — drawer) ---------- */
                <>
                    {renderRecordingSingle()}
                    {renderActionSection()}
                </>
            )}

            {localError ? <div className="v3-banner v3-banner--error" role="alert">{localError}</div> : null}

            {/* ============ THƯ VIỆN THAO TÁC (shared persisted assets — KHÔNG redesign) ============ */}
            {steps.length > 0 || library.length > 0 ? (
                <div className="v3-act__lib">
                    <div className="v3-exp__row">
                        <h4 className="v3-map__h">THƯ VIỆN THAO TÁC</h4>
                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={async () => {
                            await refreshLibrary();
                            setShowLibrary(v => !v);
                        }}>
                            {showLibrary ? "Thu gọn" : "Xem tất cả"}
                        </button>
                    </div>
                    {showLibrary ? (
                        library.length === 0 ? (
                            <p className="v3-act__note">Thư viện chưa có thao tác nào.</p>
                        ) : (
                            library.map(b => (
                                <div className="v3-act__item" key={b.blockId}>
                                    <div className="v3-cond v3-cond--compact">
                                        <div className="v3-cond__body">
                                            <b>{b.label}</b>
                                            <span className="v3-cond__meta">
                                                {b.stepCount} thao tác · {b.recordedAssertionCount} điều kiện kiểm tra · Dùng bởi {b.usedByTestCases ?? 0} testcase
                                            </span>
                                        </div>
                                        <div className="v3-cond__actions">
                                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setExpandedLibId(expandedLibId === b.blockId ? null : b.blockId)}>
                                                {expandedLibId === b.blockId ? "Thu gọn" : "Xem"}
                                            </button>
                                            {deleteConfirmId === b.blockId ? (
                                                // P0-2 — confirm NHỎ cạnh action (không modal, không full-width danger box).
                                                <span className="v3-lib-delete-inline">
                                                    {b.usedByTestCases > 0 ? (
                                                        <span className="v3-lib-delete-inline__warn">⚠ {b.usedByTestCases} testcase đang phụ thuộc</span>
                                                    ) : null}
                                                    <button type="button" className="v3-btn v3-btn--danger v3-btn--mini" onClick={() => doDeleteLibrary(b)} disabled={deletingId === b.blockId}>
                                                        {deletingId === b.blockId ? "Đang xóa…" : "Xóa"}
                                                    </button>
                                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setDeleteConfirmId(null)} disabled={deletingId === b.blockId}>Hủy</button>
                                                </span>
                                            ) : (
                                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setDeleteConfirmId(b.blockId)} disabled={deletingId === b.blockId}>
                                                    {deletingId === b.blockId ? "Đang xóa…" : "Xóa"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {expandedLibId === b.blockId ? (
                                        <div className="v3-act__detail">
                                            <p className="v3-act__note">
                                                Nguồn: Thư viện thao tác · Bản ghi {b.sourceRecordingId ?? "—"} · Bước {b.sourceRange?.startStep ?? "?"} → {b.sourceRange?.endStep ?? "?"}
                                            </p>
                                            {renderSteps(b.steps ?? [])}
                                            {(b.recordedAssertions ?? []).length > 0 ? (
                                                <div className="v3-act__verif">
                                                    <span className="v3-act__note">Điều kiện kiểm tra:</span>
                                                    {(b.recordedAssertions ?? []).map((a, j) => (
                                                        <div key={j} className="v3-cond v3-cond--compact">
                                                            <b>✓ {readableAssertion(a)}</b>
                                                            <details className="v3-act__tech"><summary>Xem kỹ thuật</summary><code className="v3-exp__stmt">{a.statement || a.matcher}</code></details>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            ))
                        )
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
