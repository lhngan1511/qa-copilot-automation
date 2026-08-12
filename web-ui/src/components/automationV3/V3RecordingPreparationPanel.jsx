import { useEffect, useMemo, useRef, useState } from "react";
import { setRecordingScript, getRecording, createLibraryAction, analyzeRecording, createRecording, listLibrary, deleteLibraryAction } from "../../api/codeGenApi.js";
import { ACTION_LABEL } from "../../utils/automationV3.js";

/*
 V3RecordingPreparationPanel — SHARED (P0 Segmentation UX Correction).

 Layout 2 phần (KHÔNG duplicate recording):
   I. BẢN GHI PLAYWRIGHT — summary (N thao tác · M điều kiện) + [Xem bản ghi] (collapsed; review/debug).
      KHÔNG chọn Start/End ở đây. KHÔNG render lại danh sách.
   II. PHÂN TÍCH / TẠO THAO TÁC — nơi duy nhất tạo reusable action:
       Manual: Start/End dropdown → preview (chỉ steps thuộc range) → verification scoped → Tên → [Xác nhận thao tác].
       AI: [Phân tích bản ghi] → proposals đổ vào CÙNG UI tạo đoạn → [Xác nhận]/[Chỉnh]/[Bỏ].
       Sau confirm → "CÁC THAO TÁC ĐÃ TẠO" (compact, collapsed per item) → [+ Tạo thêm] → [Lưu vào Thư viện].
   Bỏ "Dùng toàn bộ bản ghi" default; thay secondary [Chọn toàn bộ].

 P0 — LIBRARY + AUTOMATION INTERACTION CORRECTION:
   - NEW RECORDING MUST RESET: khi nội dung textarea đổi → reset context recording cũ
     (recordingId/steps/assertions/proposals/Start-End/name/working set/save feedback) → TỰ parse lại
     (debounce, KHÔNG cần F5). Không còn cảnh "paste B không phân tích lại".
   - THƯ VIỆN item: Tên · N thao tác · N điều kiện kiểm tra · Dùng bởi N testcase · [Xem] (expand steps) · [Xóa]
     (confirm inline — báo rõ số testcase đang dùng, không silently delete).
   - Expanded detail nằm NGOÀI flex row (v3-act__item) → full width, không bị action column ép hẹp.
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
    // P0 — source đã parse + trạng thái parse (auto re-parse khi đổi nội dung).
    const [parsedSource, setParsedSource] = useState("");
    const [parsing, setParsing] = useState(false);
    const parseTimer = useRef(null);
    const parseGen = useRef(0);
    // Phần I — collapsed mặc định
    const [showRecording, setShowRecording] = useState(false);
    // Phần II — manual
    const [startSel, setStartSel] = useState(null);
    const [endSel, setEndSel] = useState(null);
    const [name, setName] = useState("");
    // AI
    const [proposals, setProposals] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    // Đã tạo
    const [confirmed, setConfirmed] = useState([]); // [{ blockId, label, startStep, endStep, stepCount, assertionCount }]
    const [expandedItem, setExpandedItem] = useState(null);
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

    /* ---------- P0: reset context recording cũ (khi tester nhập bản ghi mới) ---------- */

    const resetRecordingContext = () => {
        clearTimeout(parseTimer.current);
        parseTimer.current = null;
        parseGen.current += 1;
        setRecordingId(null);
        setSteps([]);
        setAssertions([]);
        setProposals([]);
        setStartSel(null);
        setEndSel(null);
        setName("");
        setConfirmed([]);
        setSaveFeedback(null);
        setShowRecording(false);
        setExpandedItem(null);
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
            setStartSel(parsedSteps.length > 0 ? parsedSteps[0].order : null);
            setEndSel(parsedSteps.length > 0 ? parsedSteps[parsedSteps.length - 1].order : null);
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

    /* ---------- Phần II: confirm đoạn (manual + AI cùng đường) ---------- */

    const createConfirmedAction = async (s, e, label) => {
        setSaving(true);
        setLocalError("");
        try {
            const res = await createLibraryAction({ recordingId, label, kind: "ACTION", startStep: s, endStep: e });
            const data = res?.data ?? res;
            const blockId = data?.blockId;
            if (!blockId) throw new Error("Không tạo được thao tác thư viện.");
            setConfirmed(prev => [...prev, {
                blockId, label, startStep: s, endStep: e,
                stepCount: e - s + 1,
                assertionCount: data?.recordedAssertionCount ?? 0
            }]);
            onConfirmedSegment?.(blockId, label);
            setName("");
            setStartSel(null);
            setEndSel(null);
        } catch (err) {
            notifyError(err?.message ?? "Không xác nhận được đoạn.");
        } finally {
            setSaving(false);
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

    /* ---------- P0: Thư viện — Xóa (confirm inline, báo rõ usage) ---------- */

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

    const itemSteps = item => steps.filter(s => s.order >= item.startStep && s.order <= item.endStep);
    const itemAssertions = item => scopedAssertionsFor(item);

    const scopedAssertionsFor = item => {
        const its = steps.filter(s => s.order >= item.startStep && s.order <= item.endStep);
        if (its.length === 0) return [];
        const firstStart = Math.min(...its.map(s => s.sourceStart ?? 0));
        const lastStart = Math.min(...its.map(s => s.sourceStart ?? 0));
        const lastEnd = Math.max(...its.map(s => s.sourceEnd ?? 0));
        return assertions.filter(a => {
            const as = a.sourceStart ?? -1, ae = a.sourceEnd ?? -1;
            if (as >= firstStart && ae <= lastEnd) return true;
            if (as >= lastStart && as <= lastEnd + 120) return true;
            return false;
        });
    };

    const renderSteps = list => (
        <div className="v3-steps">
            {list.map(s => (
                <div className="v3-step" key={s.order}>
                    <span className="v3-step__n">{s.order}</span>
                    <span className="v3-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                    <span className="v3-step__loc">{s.target || s.locator || "—"}</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className="v3-rec-prep">
            {/* ============ I. BẢN GHI PLAYWRIGHT ============ */}
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
            {steps.length === 0 ? (
                <button type="button" className="v3-btn v3-btn--primary" onClick={handlePasteDone} disabled={saving || !source.trim()}>
                    {parsing || saving ? "Đang phân tích…" : "Nhập xong"}
                </button>
            ) : (
                <div className="v3-act__summary">
                    <span><b>{steps.length} thao tác</b> · <b>{assertions.length} điều kiện kiểm tra</b></span>
                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setShowRecording(v => !v)}>
                        {showRecording ? "Thu gọn" : "Xem bản ghi"}
                    </button>
                    {showRecording ? (
                        <div className="v3-steps">
                            {steps.map(s => (
                                <div className="v3-step" key={s.order}>
                                    <span className="v3-step__n">{s.order}</span>
                                    <span className="v3-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                                    <span className="v3-step__loc">{s.target || s.locator || "—"}</span>
                                </div>
                            ))}
                            {assertions.map((a, i) => (
                                <div className="v3-step" key={`a-${i}`}>
                                    <span className="v3-step__n">A</span>
                                    <span className="v3-step__act">Kiểm tra</span>
                                    <span className="v3-step__loc">{readableAssertion(a)}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            )}

            {localError ? <div className="v3-banner v3-banner--error" role="alert">{localError}</div> : null}

            {/* ============ II. TẠO THAO TÁC ============ */}
            {steps.length > 0 ? (
                <div className="v3-act__seg">
                    <h4 className="v3-map__h">II. TẠO THAO TÁC</h4>
                    <p className="v3-act__note">Chọn một phần trong bản ghi để tạo thao tác dùng lại.</p>
                    <div className="v3-act__ai-help">
                        <span className="v3-act__note">Cần hỗ trợ chia bản ghi?</span>
                        <button type="button" className="v3-btn v3-btn--secondary v3-btn--mini" onClick={handleAnalyze} disabled={analyzing || saving}>
                            {analyzing ? "Đang phân tích…" : "Gợi ý bằng AI"}
                        </button>
                    </div>

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
                                                // Dùng gợi ý: CHỈ điền Start/End/Tên — KHÔNG tự lưu/overwrite.
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

                    {/* Manual — chọn Start/End */}
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

                    {selRange ? (
                        <div className="v3-act__preview">
                            <b>ĐOẠN ĐÃ CHỌN</b>
                            <p className="v3-act__note">{selRange.count} thao tác · bước {selRange.start} → {selRange.end}</p>
                            {renderSteps(selSteps)}
                            <div className="v3-act__verif">
                                {scopedAssertions.length > 0 ? (
                                    <>
                                        <span className="v3-act__note">Điều kiện kiểm tra trong đoạn:</span>
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
                        <input className="v3-input v3-act__name" value={name} onChange={e => setName(e.target.value)} placeholder="Tên thao tác" />
                        <button type="button" className="v3-btn v3-btn--primary" onClick={confirmSegment} disabled={!selRange || saving}>
                            {saving ? "Đang lưu…" : "Xác nhận thao tác"}
                        </button>
                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => {
                            if (steps.length === 0) return;
                            setStartSel(steps[0].order); setEndSel(steps[steps.length - 1].order);
                        }} disabled={saving}>
                            Chọn toàn bộ
                        </button>
                    </div>
                </div>
            ) : null}

            {/* ============ CÁC THAO TÁC ĐÃ TẠO (compact, collapsed) ============ */}
            {confirmed.length > 0 ? (
                <div className="v3-act__saved">
                    <h4 className="v3-map__h">III. THAO TÁC ĐÃ TẠO</h4>
                    {confirmed.map(seg => (
                        <div className="v3-act__item" key={seg.blockId}>
                            <div className="v3-cond v3-cond--compact">
                                <div className="v3-cond__body">
                                    <div className="v3-cond__line">
                                        <b>{seg.label} · bước {seg.startStep} → {seg.endStep}</b>
                                        <span className="v3-cond__meta">{seg.stepCount} thao tác · {seg.assertionCount > 0 ? `${seg.assertionCount} điều kiện kiểm tra` : "không điều kiện kiểm tra"}</span>
                                    </div>
                                </div>
                                <div className="v3-cond__actions">
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setExpandedItem(expandedItem === seg.blockId ? null : seg.blockId)}>
                                        {expandedItem === seg.blockId ? "Thu gọn" : "Xem"}
                                    </button>
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => { setStartSel(seg.startStep); setEndSel(seg.endStep); setName(seg.label); }} disabled={saving}>Chỉnh</button>
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setConfirmed(prev => prev.filter(x => x !== seg))} disabled={saving}>Xóa</button>
                                </div>
                            </div>
                            {expandedItem === seg.blockId ? (
                                <div className="v3-act__detail">
                                    <div className="v3-steps">
                                        {itemSteps(seg).map(s => (
                                            <div className="v3-step" key={s.order}>
                                                <span className="v3-step__n">{s.order}</span>
                                                <span className="v3-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                                                <span className="v3-step__loc">{s.target || s.locator || "—"}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {itemAssertions(seg).length > 0 ? (
                                        <div className="v3-act__verif">
                                            <span className="v3-act__note">Điều kiện kiểm tra:</span>
                                            {itemAssertions(seg).map((a, j) => (
                                                <div key={j} className="v3-cond v3-cond--compact">
                                                    <b>✓ {readableAssertion(a)}</b>
                                                    <details className="v3-act__tech"><summary>Xem code kỹ thuật</summary><code className="v3-exp__stmt">{a.statement || a.matcher}</code></details>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ))}
                    <button type="button" className="v3-btn v3-btn--secondary v3-btn--mini" onClick={() => { setStartSel(null); setEndSel(null); setName(""); }} disabled={saving}>
                        + Tạo thêm thao tác
                    </button>
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

            {/* ============ THƯ VIỆN THAO TÁC (shared persisted assets) ============ */}
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
                                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setDeleteConfirmId(b.blockId)} disabled={deletingId === b.blockId}>
                                                {deletingId === b.blockId ? "Đang xóa…" : "Xóa"}
                                            </button>
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
                                    {deleteConfirmId === b.blockId ? (
                                        <div className="v3-lib-delete-confirm" role="alert">
                                            <span>
                                                {b.usedByTestCases > 0
                                                    ? `⚠ Thao tác đang được ${b.usedByTestCases} testcase dùng. Xóa sẽ khiến các testcase đó mất thao tác này.`
                                                    : "Xóa thao tác khỏi Thư viện?"}
                                            </span>
                                            <span className="v3-lib-delete-confirm__actions">
                                                <button type="button" className="v3-btn v3-btn--danger v3-btn--mini" onClick={() => doDeleteLibrary(b)} disabled={deletingId === b.blockId}>
                                                    {deletingId === b.blockId ? "Đang xóa…" : "Xóa"}
                                                </button>
                                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setDeleteConfirmId(null)} disabled={deletingId === b.blockId}>Hủy</button>
                                            </span>
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
