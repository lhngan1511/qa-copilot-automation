import { useMemo, useState } from "react";
import { setRecordingScript, getRecording, createLibraryAction } from "../../api/codeGenApi.js";
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

    const notifyError = msg => { setLocalError(msg); onError?.(msg); };

    const handlePasteDone = async () => {
        if (saving || !source.trim()) return;
        setSaving(true);
        setLocalError("");
        try {
            // GLOBAL recording — không workspace: tạo session codegen rồi set script (parse backend).
            const start = await fetch("/api/codegen/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: "about:blank", browser: "chrome", mode: "FULL_FLOW" })
            }).then(r => r.json());
            const recId = start?.data?.recordingId ?? start?.recordingId;
            if (!recId) throw new Error("Không tạo được bản ghi.");
            const saved = await setRecordingScript(recId, { script: source });
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
            ) : null}

            {localError ? <div className="v3-banner v3-banner--error" role="alert">{localError}</div> : null}

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
                            {assertions.length > 0 ? (
                                <p className="v3-act__note">Verification/expect trong bản ghi: {assertions.map(a => a.statement || a.matcher).join(" · ")}</p>
                            ) : null}
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
