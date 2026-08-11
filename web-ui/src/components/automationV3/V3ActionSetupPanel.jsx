import { useCallback, useEffect, useMemo, useState } from "react";
import {
    startRecording,
    stopRecording,
    createBlock,
    confirmBlock,
    updateBlock,
    getBinding,
    bindBlock,
    unbindBlock,
    reorderBinding,
    listBlocks
} from "../../api/automationV3Api.js";
import { ACTION_LABEL, segmentStatusLabel } from "../../utils/automationV3.js";

/*
 V3ActionSetupPanel — Tab "Thao tác" (Checkpoint 6C, wireframe 5 màn hình B/C/D đã duyệt).

 Mental model: TESTCASE → THAO TÁC.
   - Chưa có thao tác → [Dán bản ghi Playwright] hoặc [Dùng thao tác đã có].
   - Dán bản ghi → preview steps → (•) Dùng toàn bộ (mặc định) hoặc ( ) Chọn một phần
     (Start/End dropdown + preview rõ) → [Xác nhận thao tác].
   - "Thao tác sẽ chạy" → [ + Thêm thao tác ] (bấm mới hỏi nguồn) · ↑↓ sắp thứ tự ·
     [Lưu thao tác để dùng lại] tùy chọn · [Xóa]/[Thay thế].

 KHÔNG hiển thị thuật ngữ: ActionBlock / Binding / Segment / Snapshot / PRIVATE / REUSABLE.
 Không AI mapping. Không tự reuse.
*/

const STEP_LABEL = step => {
    const act = ACTION_LABEL[step.actionType] ?? step.actionType ?? "";
    const target = step.target || step.locator || "";
    return `${act}${target ? ` ${target}` : ""}`.trim();
};

export default function V3ActionSetupPanel({ workspaceId, testCase, onChanged, onError }) {
    // screen: "source" (chọn nguồn) | "paste" (dán bản ghi) | "library" (dùng thao tác đã có) | "list" (thao tác sẽ chạy)
    const [screen, setScreen] = useState("source");
    const [binding, setBinding] = useState([]); // sequence items (blockDto + order)
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState("");

    // Dán bản ghi
    const [source, setSource] = useState("");
    const [steps, setSteps] = useState([]);
    const [recordingId, setRecordingId] = useState(null);
    const [mode, setMode] = useState("all"); // "all" | "part"
    const [startSel, setStartSel] = useState(null);
    const [endSel, setEndSel] = useState(null);

    // Library reuse
    const [library, setLibrary] = useState([]);

    // Lưu để dùng lại
    const [savingReuseId, setSavingReuseId] = useState(null);
    const [reuseName, setReuseName] = useState("");

    const notify = () => onChanged?.();

    const refreshBinding = useCallback(async () => {
        try {
            const data = await getBinding(workspaceId, testCase.testCaseId);
            setBinding(Array.isArray(data.sequence) ? data.sequence : []);
        } catch (e) {
            onError?.(e?.message ?? "Không tải được thao tác.");
        } finally {
            setLoading(false);
        }
    }, [workspaceId, testCase.testCaseId, onError]);

    const refreshLibrary = useCallback(async () => {
        try {
            const data = await listBlocks(workspaceId, { reusable: true });
            setLibrary(Array.isArray(data) ? data : []);
        } catch {
            setLibrary([]);
        }
    }, [workspaceId]);

    useEffect(() => {
        refreshBinding();
    }, [refreshBinding]);

    /* ---------- Chọn nguồn (màn B) ---------- */

    const choosePaste = () => {
        setLocalError("");
        setSource("");
        setSteps([]);
        setMode("all");
        setStartSel(null);
        setEndSel(null);
        setScreen("paste");
    };

    const chooseLibrary = () => {
        setLocalError("");
        refreshLibrary();
        setScreen("library");
    };

    /* ---------- Dán bản ghi → steps (màn C) ---------- */

    const handlePasteDone = async () => {
        if (saving || !source.trim()) return;
        setSaving(true);
        setLocalError("");
        try {
            const start = await startRecording(workspaceId, { type: "TESTCASE" });
            const stop = await stopRecording(workspaceId, { recordingId: start.recordingId, source });
            setRecordingId(stop.recordingId ?? start.recordingId);
            const parsed = await getStepsAfterStop(workspaceId, stop.recordingId ?? start.recordingId);
            setSteps(parsed);
            setStartSel(parsed.length > 0 ? parsed[0].order : null);
            setEndSel(parsed.length > 0 ? parsed[parsed.length - 1].order : null);
            if (parsed.length === 0) setLocalError("Bản ghi không có thao tác nào.");
        } catch (e) {
            setLocalError(e?.message ?? "Không đọc được bản ghi.");
        } finally {
            setSaving(false);
        }
    };

    const getStepsAfterStop = async (wid, recId) => {
        const { getRecordingDetail } = await import("../../api/automationV3Api.js");
        const detail = await getRecordingDetail(wid, recId);
        return Array.isArray(detail.steps) ? detail.steps : [];
    };

    const selRange = useMemo(() => {
        if (steps.length === 0) return null;
        if (mode === "all") {
            return { start: steps[0].order, end: steps[steps.length - 1].order, count: steps.length };
        }
        if (!Number.isInteger(startSel) || !Number.isInteger(endSel)) return null;
        return { start: Math.min(startSel, endSel), end: Math.max(startSel, endSel), count: Math.abs(endSel - startSel) + 1 };
    }, [steps, mode, startSel, endSel]);

    const confirmAction = async () => {
        if (!selRange || saving) return;
        setSaving(true);
        setLocalError("");
        try {
            // Tạo thao tác (private phía sau) → xác nhận → gắn vào testcase đang mở (KHÔNG hỏi testcase).
            const block = await createBlock(workspaceId, {
                recordingId,
                startStep: selRange.start,
                endStep: selRange.end,
                scope: "PRIVATE"
            });
            await confirmBlock(workspaceId, block.blockId);
            await bindBlock(workspaceId, testCase.testCaseId, block.blockId);
            setScreen("list");
            setSteps([]);
            setSource("");
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không xác nhận được thao tác.");
        } finally {
            setSaving(false);
        }
    };

    /* ---------- Thao tác sẽ chạy (màn D) ---------- */

    const handleRemove = async item => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await unbindBlock(workspaceId, testCase.testCaseId, item.blockId);
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không gỡ được thao tác.");
        } finally {
            setSaving(false);
        }
    };

    const handleReplace = item => {
        // Thay thế = gỡ thao tác này rồi chọn nguồn thao tác mới.
        handleRemove(item).then(() => setScreen("source"));
    };

    const handleMove = async (index, dir) => {
        if (saving) return;
        const next = [...binding];
        const target = index + dir;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setSaving(true);
        setLocalError("");
        try {
            await reorderBinding(workspaceId, testCase.testCaseId, next.map(i => i.blockId));
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không sắp xếp được thao tác.");
        } finally {
            setSaving(false);
        }
    };

    const startSaveReuse = item => {
        setSavingReuseId(item.blockId);
        setReuseName(item.label ?? "");
    };

    const saveReuse = async item => {
        if (saving || !reuseName.trim()) return;
        setSaving(true);
        setLocalError("");
        try {
            await updateBlock(workspaceId, item.blockId, { scope: "REUSABLE", label: reuseName.trim() });
            setSavingReuseId(null);
            setReuseName("");
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không lưu được thao tác.");
        } finally {
            setSaving(false);
        }
    };

    /* ---------- Dùng thao tác đã có (library) ---------- */

    const useLibraryItem = async block => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await bindBlock(workspaceId, testCase.testCaseId, block.blockId);
            setScreen("list");
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không dùng được thao tác.");
        } finally {
            setSaving(false);
        }
    };

    const blockTitle = item => item.label || (Number.isInteger(item.startStep) ? `Bước ${item.startStep} → ${item.endStep}` : "Thao tác");

    if (loading) return <div className="v3-note">Đang tải thao tác…</div>;

    return (
        <div className="v3-act">
            {localError ? <div className="v3-banner v3-banner--error" role="alert">{localError}</div> : null}

            {/* ---------- Màn B: chọn nguồn ---------- */}
            {screen === "source" ? (
                <div className="v3-act__source">
                    {binding.length === 0 ? (
                        <p className="v3-act__note">Testcase này chưa có thao tác automation.</p>
                    ) : null}
                    <div className="v3-act__source-actions">
                        <button type="button" className="v3-btn v3-btn--primary" onClick={choosePaste} disabled={saving}>
                            Dán bản ghi Playwright
                        </button>
                        <button type="button" className="v3-btn v3-btn--secondary" onClick={chooseLibrary} disabled={saving}>
                            Dùng thao tác đã có
                        </button>
                    </div>
                </div>
            ) : null}

            {/* ---------- Màn C: dán bản ghi → toàn bộ / một phần ---------- */}
            {screen === "paste" ? (
                <div className="v3-act__paste">
                    <h4 className="v3-map__h">Bản ghi Playwright</h4>
                    <textarea
                        className="v3-input"
                        rows={6}
                        value={source}
                        onChange={e => setSource(e.target.value)}
                        placeholder={"await page.goto('...');\nawait page.getByRole('button', { name: '...' }).click();\n..."}
                        spellCheck={false}
                    />
                    {steps.length === 0 ? (
                        <button type="button" className="v3-btn v3-btn--primary" onClick={handlePasteDone} disabled={saving || !source.trim()}>
                            {saving ? "Đang đọc…" : "Nhập xong"}
                        </button>
                    ) : null}

                    {steps.length > 0 ? (
                        <div className="v3-act__range">
                            <p className="v3-act__note">Bạn muốn dùng phần nào cho {testCase.testCaseId}?</p>
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
                                </div>
                            ) : null}

                            <div className="v3-act__range-actions">
                                <button type="button" className="v3-btn v3-btn--ghost" onClick={() => { setSteps([]); setSource(""); setScreen("source"); }} disabled={saving}>
                                    Hủy
                                </button>
                                <button type="button" className="v3-btn v3-btn--primary" onClick={confirmAction} disabled={!selRange || saving}>
                                    {saving ? "Đang lưu…" : "Xác nhận thao tác"}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* ---------- Màn library ---------- */}
            {screen === "library" ? (
                <div className="v3-act__library">
                    <h4 className="v3-map__h">Thao tác đã lưu</h4>
                    {library.length === 0 ? (
                        <p className="v3-act__note">Chưa có thao tác nào được lưu để dùng lại.</p>
                    ) : (
                        library.map(b => (
                            <div className="v3-cond" key={b.blockId}>
                                <div className="v3-cond__body">
                                    <b>{b.label}</b>
                                    <div className="v3-cond__meta">
                                        <span>Đang dùng bởi {b.usedByTestCases?.length ?? 0} testcase</span>
                                        {b.kind === "SETUP" ? <span>Bước chuẩn bị</span> : null}
                                    </div>
                                </div>
                                <div className="v3-cond__actions">
                                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={() => useLibraryItem(b)} disabled={saving}>
                                        Dùng
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    <button type="button" className="v3-btn v3-btn--ghost" onClick={() => setScreen("source")} disabled={saving}>
                        Quay lại
                    </button>
                </div>
            ) : null}

            {/* ---------- Màn D: thao tác sẽ chạy ---------- */}
            {screen === "list" ? (
                <div className="v3-act__list">
                    <h4 className="v3-map__h">Thao tác sẽ chạy</h4>
                    {binding.length === 0 ? (
                        <p className="v3-act__note">Testcase này chưa có thao tác automation.</p>
                    ) : (
                        binding.map((item, idx) => (
                            <div className="v3-cond" key={item.blockId}>
                                <div className="v3-cond__body">
                                    <b>{idx + 1}. {blockTitle(item)}</b>
                                    <div className="v3-cond__meta">
                                        {item.kind === "SETUP" ? <span>Bước chuẩn bị</span> : null}
                                        {item.scope === "REUSABLE" ? <span>Dùng lại</span> : null}
                                        <span>{segmentStatusLabel(item.status)}</span>
                                    </div>
                                </div>
                                <div className="v3-cond__actions">
                                    {binding.length > 1 ? (
                                        <>
                                            <button type="button" className="v3-btn v3-btn--mini" disabled={saving || idx === 0} onClick={() => handleMove(idx, -1)} aria-label="Lên trên">↑</button>
                                            <button type="button" className="v3-btn v3-btn--mini" disabled={saving || idx === binding.length - 1} onClick={() => handleMove(idx, 1)} aria-label="Xuống dưới">↓</button>
                                        </>
                                    ) : null}
                                    {item.scope !== "REUSABLE" ? (
                                        savingReuseId === item.blockId ? (
                                            <span className="v3-act__reuse">
                                                <input className="v3-input" value={reuseName} onChange={e => setReuseName(e.target.value)} placeholder="Tên thao tác" />
                                                <button type="button" className="v3-btn v3-btn--mini v3-btn--primary" onClick={() => saveReuse(item)} disabled={saving || !reuseName.trim()}>Lưu</button>
                                            </span>
                                        ) : (
                                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => startSaveReuse(item)} disabled={saving}>
                                                Lưu thao tác để dùng lại
                                            </button>
                                        )
                                    ) : null}
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => handleReplace(item)} disabled={saving}>
                                        Thay thế
                                    </button>
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => handleRemove(item)} disabled={saving}>
                                        Xóa
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    <div className="v3-act__add">
                        <button type="button" className="v3-btn v3-btn--secondary" onClick={() => setScreen("source")} disabled={saving}>
                            + Thêm thao tác
                        </button>
                    </div>
                    <p className="v3-act__note">↑ ↓ để tự sắp thứ tự — hệ thống không tự đổi thứ tự.</p>
                </div>
            ) : null}
        </div>
    );
}
