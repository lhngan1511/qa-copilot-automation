import { useCallback, useEffect, useMemo, useState } from "react";
import {
    startRecording,
    stopRecording,
    getRecordingDetail,
    createBlock,
    confirmBlock,
    updateBlock,
    getBinding,
    bindBlock,
    unbindBlock,
    reorderBinding,
    listBlocks,
    listLibrary,
    saveToLibrary,
    bindLibraryBlock
} from "../../api/automationV3Api.js";
import { ACTION_LABEL } from "../../utils/automationV3.js";
import V3RecordingPreparationPanel from "./V3RecordingPreparationPanel.jsx";

/*
 V3ActionSetupPanel — Tab "Thao tác" (Checkpoint 6C + 6C.1).

 Mental model: TESTCASE → THAO TÁC.
   - Chưa có thao tác → [Dán bản ghi Playwright] / [Dùng thao tác đã có].
   - Dán bản ghi → (•) Dùng toàn bộ (mặc định) / ( ) Chọn một phần → [Xác nhận thao tác].
   - "Thao tác sẽ chạy": compact list; [Xem] expand steps + nguồn; [Xác nhận] khi DRAFT; [Thay thế]; [Xóa]; ↑↓.

 6C.1 fixes:
   - ADD/REPLACE semantics: confirm từ đầu = REPLACE toàn bộ binding (không giữ action cũ không rõ nguồn);
     [+ Thêm thao tác] = APPEND; [Thay thế] = REPLACE đúng item.
   - Status rõ: "✓ Đã xác nhận" (được Generate) / "⚠ Chưa xác nhận" (+ nút [Xác nhận]).
   - Label hiển thị: label đã lưu, hoặc derive từ tên testcase (KHÔNG AI); "Bước 1→8" chỉ hiện khi expand (Nguồn).
   - KHÔNG còn "Duyệt recording" (recording chỉ là source/evidence — read-only trong expand).
*/

const STEP_LABEL = step => {
    const act = ACTION_LABEL[step.actionType] ?? step.actionType ?? "";
    const target = step.target || step.locator || "";
    return `${act}${target ? ` ${target}` : ""}`.trim();
};

export default function V3ActionSetupPanel({ workspaceId, testCase, onChanged, onError }) {
    const [screen, setScreen] = useState("list"); // "list" | "source" | "paste" | "library"
    const [addMode, setAddMode] = useState("replaceAll"); // "replaceAll" | "append" | { type: "replaceOne", blockId }
    const [binding, setBinding] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState("");
    const [expandedId, setExpandedId] = useState(null);

    // Dán bản ghi
    const [source, setSource] = useState("");
    const [steps, setSteps] = useState([]);
    const [recordingId, setRecordingId] = useState(null);
    const [mode, setMode] = useState("all"); // "all" | "part"
    const [startSel, setStartSel] = useState(null);
    const [endSel, setEndSel] = useState(null);

    // Library reuse
    const [library, setLibrary] = useState([]);

    // Lưu vào thư viện (Boundary — shared asset)
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
            const data = await listLibrary(workspaceId);
            setLibrary(Array.isArray(data) ? data : []);
        } catch {
            setLibrary([]);
        }
    }, [workspaceId]);

    useEffect(() => {
        refreshBinding().then(() => {
            // Binding rỗng → mở luôn màn chọn nguồn (replaceAll).
            setScreen(prev => (prev === "list" ? (binding.length === 0 ? "library" : "list") : prev));
        });
    }, [refreshBinding, binding.length]);

    /* ---------- Điều hướng nguồn thao tác ---------- */

    // Phase 1 — Ownership: bỏ màn chọn nguồn ngang hàng.
    // primary = mở Library; fallback = mở paste (cut-many). addMode theo ngữ cảnh append/replaceAll.
    const openSource = (mode2 = "append") => {
        setAddMode(mode2);
        openLibrary();
    };
    const openFallbackPaste = (mode2 = "append") => {
        setAddMode(mode2);
        openPaste();
    };

    const openPaste = () => {
        setSource("");
        setSteps([]);
        setMode("all");
        setStartSel(null);
        setEndSel(null);
        setScreen("paste");
    };

    const openLibrary = () => {
        setLocalError("");
        refreshLibrary();
        setScreen("library");
    };

    /* ---------- Dán bản ghi → steps ---------- */

    const handlePasteDone = async () => {
        if (saving || !source.trim()) return;
        setSaving(true);
        setLocalError("");
        try {
            const start = await startRecording(workspaceId, { type: "TESTCASE" });
            const stop = await stopRecording(workspaceId, { recordingId: start.recordingId, source });
            const recId = stop.recordingId ?? start.recordingId;
            setRecordingId(recId);
            const detail = await getRecordingDetail(workspaceId, recId);
            const parsed = Array.isArray(detail.steps) ? detail.steps : [];
            setSteps(parsed);
            setLastRecording({ recordingId: recId, steps: parsed }); // giữ để cắt tiếp
            setStartSel(parsed.length > 0 ? parsed[0].order : null);
            setEndSel(parsed.length > 0 ? parsed[parsed.length - 1].order : null);
            if (parsed.length === 0) setLocalError("Bản ghi không có thao tác nào.");
        } catch (e) {
            setLocalError(e?.message ?? "Không đọc được bản ghi.");
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

    /* ---------- Xác nhận thao tác — ADD/REPLACE semantics (6C.1) ---------- */

    const confirmAction = async () => {
        if (!selRange || saving) return;
        setSaving(true);
        setLocalError("");
        try {
            // 1. Tạo block mới (PRIVATE) + xác nhận.
            const block = await createBlock(workspaceId, {
                recordingId,
                startStep: selRange.start,
                endStep: selRange.end,
                scope: "PRIVATE"
            });
            await confirmBlock(workspaceId, block.blockId);

            // 2. Áp theo ngữ cảnh ADD/REPLACE.
            if (addMode === "append") {
                await bindBlock(workspaceId, testCase.testCaseId, block.blockId);
            } else if (addMode && addMode.type === "replaceOne") {
                const oldIndex = binding.findIndex(i => i.blockId === addMode.blockId && i.order === addMode.order);
                await unbindBlock(workspaceId, testCase.testCaseId, addMode.blockId, addMode.order);
                await bindBlock(workspaceId, testCase.testCaseId, block.blockId);
                // Giữ vị trí cũ của item được thay thế (tester-owned order).
                if (oldIndex >= 0) {
                    const seq = (await getBinding(workspaceId, testCase.testCaseId)).sequence.map(i => i.blockId);
                    const moved = seq.pop(); // block mới (vừa append ở cuối)
                    seq.splice(oldIndex, 0, moved);
                    await reorderBinding(workspaceId, testCase.testCaseId, seq);
                }
            } else {
                // replaceAll — không giữ action cũ không rõ nguồn (CASE A).
                for (const item of binding) {
                    await unbindBlock(workspaceId, testCase.testCaseId, item.blockId);
                }
                await bindBlock(workspaceId, testCase.testCaseId, block.blockId);
            }

            // Unit-type: KHÔNG reset recording — giữ steps/recordingId để CẮT TIẾP (RECORD ONCE → CUT MANY).
            setMode("all");
            setStartSel(null);
            setEndSel(null);
            setScreen("paste");
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không xác nhận được thao tác.");
        } finally {
            setSaving(false);
        }
    };

    /* ---------- Danh sách thao tác ---------- */

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

    const handleReplace = item => openFallbackPaste({ type: "replaceOne", blockId: item.blockId, order: item.order });

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

    const handleConfirm = async item => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await confirmBlock(workspaceId, item.blockId);
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không xác nhận được thao tác.");
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
            // Boundary — tester chủ động LƯU vào Thư viện (shared asset); block workspace giữ nguyên.
            await saveToLibrary(workspaceId, { blockId: item.blockId, label: reuseName.trim() });
            setSavingReuseId(null);
            setReuseName("");
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không lưu được thao tác vào thư viện.");
        } finally {
            setSaving(false);
        }
    };

    /* ---------- Library ---------- */

    const useLibraryItem = async block => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await bindLibraryBlock(workspaceId, testCase.testCaseId, block.blockId);
            setScreen("list");
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không dùng được thao tác.");
        } finally {
            setSaving(false);
        }
    };

    // Label hiển thị: label đã lưu, hoặc derive từ tên testcase (KHÔNG AI); "Bước x→y" chỉ hiện khi expand.
    const blockTitle = item => {
        if (item.label) return item.label;
        const title = String(testCase?.title ?? "").trim();
        if (title) return title.length > 40 ? `${title.slice(0, 40)}…` : title;
        return "Thao tác";
    };

    if (loading) return <div className="v3-note">Đang tải thao tác…</div>;

    return (
        <div className="v3-act">
            {localError ? <div className="v3-banner v3-banner--error" role="alert">{localError}</div> : null}

            {/* ---------- Danh sách thao tác (compact — màn D) ---------- */}
            {screen === "list" ? (
                <div className="v3-act__list">
                    <h4 className="v3-map__h">Thao tác sẽ chạy</h4>
                    {binding.length === 0 ? (
                        <p className="v3-act__note">Testcase này chưa có thao tác automation.</p>
                    ) : (
                        binding.map((item, idx) => (
                            <div className="v3-cond v3-cond--compact" key={item.blockId}>
                                <div className="v3-cond__body">
                                    <div className="v3-cond__line">
                                        <b>{idx + 1}. {blockTitle(item)}</b>
                                        <span className="v3-cond__meta">
                                            {item.stepCount} thao tác ·
                                            {item.status === "CONFIRMED" ? (
                                                <span className="v3-ok">✓ Đã xác nhận</span>
                                            ) : (
                                                <span className="v3-warn">⚠ Chưa xác nhận</span>
                                            )}
                                            {item.scope === "REUSABLE" ? <span> · Dùng lại</span> : null}
                                        </span>
                                    </div>
                                    {expandedId === item.blockId ? (
                                        <div className="v3-act__detail">
                                            <p className="v3-act__note">
                                                Nguồn: Bản ghi {item.sourceRecordingId ?? "—"} · Bước nguồn: {item.startStep ?? "?"} → {item.endStep ?? "?"}
                                            </p>
                                            <div className="v3-steps">
                                                {(item.steps ?? []).map(s => (
                                                    <div className="v3-step" key={s.order}>
                                                        <span className="v3-step__n">{s.order}</span>
                                                        <span className="v3-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                                                        <span className="v3-step__loc">{s.target || s.locator || "—"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="v3-cond__actions">
                                    {binding.length > 1 ? (
                                        <>
                                            <button type="button" className="v3-btn v3-btn--mini" disabled={saving || idx === 0} onClick={() => handleMove(idx, -1)} aria-label="Lên trên">↑</button>
                                            <button type="button" className="v3-btn v3-btn--mini" disabled={saving || idx === binding.length - 1} onClick={() => handleMove(idx, 1)} aria-label="Xuống dưới">↓</button>
                                        </>
                                    ) : null}
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setExpandedId(expandedId === item.blockId ? null : item.blockId)}>
                                        {expandedId === item.blockId ? "Thu gọn" : "Xem"}
                                    </button>
                                    {item.status !== "CONFIRMED" ? (
                                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={() => handleConfirm(item)} disabled={saving}>
                                            Xác nhận
                                        </button>
                                    ) : null}
                                    {item.scope !== "REUSABLE" ? (
                                        savingReuseId === item.blockId ? (
                                            <span className="v3-act__reuse">
                                                <input className="v3-input" value={reuseName} onChange={e => setReuseName(e.target.value)} placeholder="Tên thao tác" />
                                                <button type="button" className="v3-btn v3-btn--mini v3-btn--primary" onClick={() => saveReuse(item)} disabled={saving || !reuseName.trim()}>Lưu</button>
                                            </span>
                                        ) : (
                                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => startSaveReuse(item)} disabled={saving}>
                                                Lưu vào thư viện
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
                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={openLibrary} disabled={saving}>
                            + Thêm thao tác từ thư viện
                        </button>

                    </div>
                    <p className="v3-act__note">↑ ↓ để tự sắp thứ tự — hệ thống không tự đổi thứ tự.</p>
                    <p className="v3-act__note">
                        Không có thao tác phù hợp?{" "}
                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => openFallbackPaste("append")} disabled={saving}>
                            Tạo thao tác mới từ bản ghi
                        </button>
                    </p>
                </div>
            ) : null}

            {/* Màn chọn nguồn (source) đã BỎ — Phase 1 Ownership: Library primary, paste fallback. */}

            {/* ---------- Màn dán bản ghi (màn C) ---------- */}
            {screen === "paste" ? (
                <div className="v3-act__paste">
                    {/* Phase 1 — REUSE shared RecordingPreparationPanel (Codegen owner; fallback secondary).
                        onConfirmedSegment: bind block vào testcase đang mở (fallback Automation). */}
                    <V3RecordingPreparationPanel
                        workspaceId={workspaceId}
                        onConfirmedSegment={async (blockId) => {
                            // P0 Consolidation — block là LIB-* (ActionLibrary) → bind qua bindLibraryBlock.
                            await bindLibraryBlock(workspaceId, testCase.testCaseId, blockId);
                            await refreshBinding();
                            notify();
                        }}
                        onSavedToLibrary={count => setLocalError(`Đã lưu ${count} thao tác vào Thư viện.`)}
                        onError={setLocalError}
                    />
                </div>
            ) : null}

            {screen === "library" ? (
                <div className="v3-act__library">
                    <h4 className="v3-map__h">Thao tác đã lưu</h4>
                    {library.length === 0 ? (
                        <p className="v3-act__note">Chưa có thao tác nào được lưu để dùng lại.</p>
                    ) : (
                        library.map(b => (
                            <div className="v3-cond v3-cond--compact" key={b.blockId}>
                                <div className="v3-cond__body">
                                    <b>{b.label}</b>
                                    <div className="v3-cond__meta">
                                        <span>Đang dùng bởi {b.usedByTestCases?.length ?? 0} testcase</span>
                                        {b.kind === "SETUP" ? <span>· Bước chuẩn bị</span> : null}
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
                    <button type="button" className="v3-btn v3-btn--ghost" onClick={() => setScreen("list")} disabled={saving}>
                        Quay lại
                    </button>
                </div>
            ) : null}
        </div>
    );
}
