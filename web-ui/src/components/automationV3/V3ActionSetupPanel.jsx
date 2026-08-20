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
import { Link } from "react-router-dom";
import { ACTION_LABEL } from "../../utils/automationV3.js";
import { groupLibraryActions, groupDisplayName } from "../../utils/libraryGroups.js";

/*
 V3ActionSetupPanel — Tab "Thao tác" (Checkpoint 6C + 6C.1 + P0 Library/Interaction Correction).

 Mental model: TESTCASE → THAO TÁC.
   - Chưa có thao tác → mở Library (primary) / fallback [Tạo thao tác mới từ bản ghi].
   - Library = MULTI-SELECT (P0): checkbox batch, picker KHÔNG đóng sau mỗi chọn;
     chỉ đóng khi [Thêm N thao tác] hoặc [Hủy]. Cho phép cùng LIB-* xuất hiện nhiều lần (D→E→D).
   - "Thao tác sẽ chạy": compact list; [Xem] expand steps + nguồn; [Xác nhận] khi DRAFT; [Thay thế]; [Xóa]; ↑↓.

 6C.1 fixes:
   - ADD/REPLACE semantics: confirm từ đầu = REPLACE toàn bộ binding (không giữ action cũ không rõ nguồn);
     [+ Thêm thao tác] = APPEND; [Thay thế] = REPLACE đúng item.
   - Status rõ: "✓ Đã xác nhận" (được Generate) / "⚠ Chưa xác nhận" (+ nút [Xác nhận]).

 P0 — LIBRARY + AUTOMATION INTERACTION CORRECTION:
   - TAB STATE: canonical = workspace binding.sequence → Library block. Mỗi lần mount/đổi testcase,
     panel FETCH LẠI binding từ backend (không cache/local-only). Fix stale-closure race trước đây
     (screen rơi về "library" dù binding có action — do đọc binding.length từ closure cũ).
   - BỎ badge "Dùng lại" (Library block đã mặc định reusable); provenance chỉ trong [Xem]:
     "Nguồn: Thư viện thao tác".
   - DETAIL LAYOUT: expanded steps nằm NGOÀI flex row (v3-act__item) → full width, không bị cột
     action ép hẹp (trước đây text dài bị rơi từng ký tự theo chiều dọc).
   - Key item = `${blockId}:${order}` (cùng LIB-* nhiều occurrence không đụng key).
   - [Xóa] truyền order → xóa đúng 1 occurrence (D→E→D không mất cả hai).
*/

const STEP_LABEL = step => {
    const act = ACTION_LABEL[step.actionType] ?? step.actionType ?? "";
    const target = step.target || step.locator || "";
    return `${act}${target ? ` ${target}` : ""}`.trim();
};

export default function V3ActionSetupPanel({ workspaceId, testCase, onChanged, onError }) {
    const [screen, setScreen] = useState("list"); // "list" | "paste" | "library"
    const [addMode, setAddMode] = useState("replaceAll"); // "replaceAll" | "append" | { type: "replaceOne", blockId, order }
    const [binding, setBinding] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState("");
    const [expandedId, setExpandedId] = useState(null); // `${blockId}:${order}`

    // Dán bản ghi
    const [source, setSource] = useState("");
    const [steps, setSteps] = useState([]);
    const [recordingId, setRecordingId] = useState(null);
    const [mode, setMode] = useState("all"); // "all" | "part"
    const [startSel, setStartSel] = useState(null);
    const [endSel, setEndSel] = useState(null);

    // Library reuse — P0: MULTI-SELECT (batch)
    const [library, setLibrary] = useState([]);
    const [libraryLoading, setLibraryLoading] = useState(false); // P0-regression: tránh flash "Chưa có thao tác..."
    const [selectedLib, setSelectedLib] = useState([]); // blockIds theo thứ tự chọn
    // P0-B — picker group-first: null = đang chọn Chức năng; string = đang xem group đó.
    const [pickerGroup, setPickerGroup] = useState(null);

    // Lưu vào thư viện (Boundary — shared asset)
    const [savingReuseId, setSavingReuseId] = useState(null);
    const [reuseName, setReuseName] = useState("");

    const notify = () => onChanged?.();

    /** P0 — canonical: luôn đọc binding từ backend; trả sequence để quyết định screen không dùng closure cũ. */
    const refreshBinding = useCallback(async () => {
        try {
            const data = await getBinding(workspaceId, testCase.testCaseId);
            const seq = Array.isArray(data.sequence) ? data.sequence : [];
            setBinding(seq);
            return seq;
        } catch (e) {
            onError?.(e?.message ?? "Không tải được thao tác.");
            return [];
        } finally {
            setLoading(false);
        }
    }, [workspaceId, testCase.testCaseId, onError]);

    const refreshLibrary = useCallback(async () => {
        try {
            const data = await listLibrary(workspaceId);
            const list = Array.isArray(data) ? data : [];
            setLibrary(list);
            return list;
        } catch {
            setLibrary([]);
            return [];
        }
    }, [workspaceId]);

    // P0 — render lại từ canonical binding mỗi khi mount/đổi testcase (KHÔNG giữ state cũ).
    useEffect(() => {
        setLoading(true);
        setBinding([]);
        setScreen("list");
        setExpandedId(null);
        setSelectedLib([]);
    }, [testCase.testCaseId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const seq = await refreshBinding();
            if (cancelled) return;
            if (seq.length === 0 && screen === "list") {
                // P0-regression — binding rỗng → mở Library nhưng PHẢI đợi list về
                // (tránh "Chưa có thao tác nào..." do race async).
                setScreen("library");
                setLibraryLoading(true);
                await refreshLibrary();
                if (!cancelled) setLibraryLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [refreshBinding, refreshLibrary]);

    /* ---------- Điều hướng nguồn thao tác ---------- */

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

    const openLibrary = async (mode2 = "append") => {
        setLocalError("");
        setAddMode(mode2);
        setSelectedLib([]);
        setPickerGroup(null);
        setScreen("library");
        setLibraryLoading(true);
        await refreshLibrary();
        setLibraryLoading(false);
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
            // P0 — truyền order để xóa ĐÚNG 1 occurrence (D→E→D; cùng LIB-* nhiều lần).
            await unbindBlock(workspaceId, testCase.testCaseId, item.blockId, item.order);
            await refreshBinding();
            notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không gỡ được thao tác.");
        } finally {
            setSaving(false);
        }
    };

    const handleReplace = item => openLibrary({ type: "replaceOne", blockId: item.blockId, order: item.order });

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

    /* ---------- Library (P0 — MULTI-SELECT batch) ---------- */

    const toggleLib = blockId => {
        setSelectedLib(prev => (prev.includes(blockId) ? prev.filter(x => x !== blockId) : [...prev, blockId]));
    };

    const moveSelectedLib = (index, delta) => {
        setSelectedLib(prev => {
            const nextIndex = index + delta;
            if (nextIndex < 0 || nextIndex >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
    };

    const addSelectedLibrary = async () => {
        if (saving || selectedLib.length === 0) return;
        setSaving(true);
        setLocalError("");
        try {
            if (addMode && addMode.type === "replaceOne") {
                // Thay đúng item tại vị trí tester đã sắp, bằng lựa chọn từ Library.
                const oldIndex = binding.findIndex(i => i.blockId === addMode.blockId && i.order === addMode.order);
                await unbindBlock(workspaceId, testCase.testCaseId, addMode.blockId, addMode.order);
                for (const blockId of selectedLib) await bindLibraryBlock(workspaceId, testCase.testCaseId, blockId);
                if (oldIndex >= 0) {
                    const current = (await getBinding(workspaceId, testCase.testCaseId)).sequence.map(i => i.blockId);
                    const replacements = current.splice(current.length - selectedLib.length, selectedLib.length);
                    current.splice(oldIndex, 0, ...replacements);
                    await reorderBinding(workspaceId, testCase.testCaseId, current);
                }
            } else {
                // Bind theo thứ tự chọn — append từng cái (cho phép cùng LIB-* nhiều occurrence).
                for (const blockId of selectedLib) await bindLibraryBlock(workspaceId, testCase.testCaseId, blockId);
            }
            setSelectedLib([]);
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

    // P0 — provenance: Library block mặc định reusable; chỉ hiển thị nguồn trong [Xem].
    const sourceNote = item => {
        const base = String(item.blockId ?? "").startsWith("LIB-")
            ? "Nguồn: Thư viện thao tác"
            : `Nguồn: Bản ghi ${item.sourceRecordingId ?? "—"}`;
        const range = Number.isInteger(item.startStep) && Number.isInteger(item.endStep)
            ? ` · Bước nguồn: ${item.startStep} → ${item.endStep}`
            : "";
        return `${base}${range}`;
    };

    const selectedLibraryItems = selectedLib.map(blockId => library.find(item => item.blockId === blockId)).filter(Boolean);
    const selectedFunctionCount = new Set(selectedLibraryItems.map(item => groupDisplayName(item.groupName))).size;
    const libraryGroups = groupLibraryActions(library);
    const activePickerGroup = pickerGroup ?? (libraryGroups[0]?.rawGroupName ?? "");

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
                        binding.map((item, idx) => {
                            const itemKey = `${item.blockId}:${item.order}`;
                            return (
                                <div className="v3-act__item" key={itemKey}>
                                    <div className="v3-cond v3-cond--compact">
                                        <div className="v3-cond__body">
                                            <div className="v3-cond__line">
                                                <b>{idx + 1}. {blockTitle(item)}</b>
                                                <span className="v3-cond__meta">{item.stepCount} thao tác</span>
                                            </div>
                                        </div>
                                        <div className="v3-cond__actions">
                                            {binding.length > 1 ? (
                                                <>
                                                    <button type="button" className="v3-btn v3-btn--mini" disabled={saving || idx === 0} onClick={() => handleMove(idx, -1)} aria-label="Lên trên">↑</button>
                                                    <button type="button" className="v3-btn v3-btn--mini" disabled={saving || idx === binding.length - 1} onClick={() => handleMove(idx, 1)} aria-label="Xuống dưới">↓</button>
                                                </>
                                            ) : null}
                                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => setExpandedId(expandedId === itemKey ? null : itemKey)}>
                                                {expandedId === itemKey ? "Thu gọn" : "Xem"}
                                            </button>
                                            {item.status === "CONFIRMED" ? (
                                                <span className="v3-cond__status v3-ok">✓ Đã xác nhận</span>
                                            ) : (
                                                <span className="v3-cond__status v3-warn">⚠ Chưa xác nhận</span>
                                            )}
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
                                    {expandedId === itemKey ? (
                                        <div className="v3-act__detail">
                                            <p className="v3-act__note">{sourceNote(item)}</p>
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
                            );
                        })
                    )}
                    <div className="v3-act__add">
                        <button type="button" className="v3-btn v3-btn--ghost v3-act__add-button" onClick={openLibrary} disabled={saving}>
                            + Thêm thao tác từ thư viện
                        </button>
                    </div>
                    <p className="v3-act__note">↑ ↓ để tự sắp thứ tự — hệ thống không tự đổi thứ tự.</p>
                    <p className="v3-act__note">
                        Không có thao tác phù hợp?{" "}
                        <Link className="v3-link" to="/codegen">Mở CodeGen</Link>
                    </p>
                </div>
            ) : null}

            {/* ---------- Library picker (P0 — MULTI-SELECT batch) ---------- */}
            {screen === "library" ? (
                <div className="v3-act__library">
                    <div>
                        <h4 className="v3-map__h">{addMode?.type === "replaceOne" ? "Thay thế bằng thao tác từ thư viện" : "Thêm thao tác từ thư viện"}</h4>
                        <p className="v3-act__note">Chọn thao tác ở nhiều chức năng, sau đó sắp xếp thành luồng sẽ chạy.</p>
                    </div>
                    {libraryLoading ? (
                        <p className="v3-act__note">Đang tải thư viện…</p>
                    ) : library.length === 0 ? (
                        <p className="v3-act__note">Chưa có thao tác nào được lưu để dùng lại.</p>
                    ) : (
                        <div className="v3-lib-composer">
                            <section className="v3-lib-browser" aria-label="Thư viện theo chức năng">
                                <div className="v3-lib-function-tabs" role="tablist" aria-label="Chức năng">
                                    {libraryGroups.map(g => (
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={(g.rawGroupName ?? "") === activePickerGroup}
                                            className={`v3-lib-function-tab ${(g.rawGroupName ?? "") === activePickerGroup ? "is-active" : ""}`}
                                            key={g.rawGroupName ?? ""}
                                            onClick={() => setPickerGroup(g.rawGroupName ?? "")}
                                            disabled={saving}
                                        >
                                            <span>{g.groupName}</span><small>{g.count}</small>
                                        </button>
                                    ))}
                                </div>
                                <div className="v3-lib-browser__actions">
                                    <h5>{groupDisplayName(activePickerGroup)}</h5>
                                    {library.filter(b => (b.groupName ?? "") === activePickerGroup).map(b => {
                                        const inUse = binding.filter(i => i.blockId === b.blockId).length;
                                        return (
                                            <label className="v3-lib-option" key={b.blockId}>
                                                <input type="checkbox" checked={selectedLib.includes(b.blockId)} onChange={() => toggleLib(b.blockId)} disabled={saving} />
                                                <span className="v3-lib-option__body">
                                                    <b>{b.label}</b>
                                                    <span className="v3-cond__meta">
                                                        {b.stepCount} thao tác · {b.recordedAssertionCount} điều kiện · Đang dùng bởi {b.usedByTestCases ?? 0} testcase
                                                        {inUse > 0 ? <span className="v3-warn"> · đã có {inUse} lần</span> : null}
                                                    </span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </section>
                            <aside className="v3-lib-sequence" aria-label="Kịch bản đã chọn">
                                <div className="v3-lib-sequence__head">
                                    <h5>Kịch bản đã chọn</h5>
                                    <span>{selectedLib.length}</span>
                                </div>
                                {selectedLibraryItems.length === 0 ? (
                                    <p className="v3-act__note">Chưa chọn thao tác. Bạn có thể chọn từ nhiều chức năng.</p>
                                ) : selectedLibraryItems.map((item, index) => (
                                    <div className="v3-lib-sequence__item" key={item.blockId}>
                                        <span className="v3-lib-sequence__number">{index + 1}</span>
                                        <span className="v3-lib-sequence__body"><b>{item.label}</b><small>{groupDisplayName(item.groupName)}</small></span>
                                        <span className="v3-lib-sequence__controls">
                                            <button type="button" className="v3-lib-sequence__control" onClick={() => moveSelectedLib(index, -1)} disabled={saving || index === 0} aria-label="Đưa lên">↑</button>
                                            <button type="button" className="v3-lib-sequence__control" onClick={() => moveSelectedLib(index, 1)} disabled={saving || index === selectedLib.length - 1} aria-label="Đưa xuống">↓</button>
                                            <button type="button" className="v3-lib-sequence__control" onClick={() => toggleLib(item.blockId)} disabled={saving} aria-label="Bỏ thao tác">×</button>
                                        </span>
                                    </div>
                                ))}
                            </aside>
                        </div>
                    )}
                    <div className="v3-lib-pick__footer">
                        <span className="v3-act__note">Đã chọn {selectedLib.length} thao tác từ {selectedFunctionCount} chức năng</span>
                        <div className="v3-lib-pick__actions">
                            <button type="button" className="v3-btn v3-btn--ghost" onClick={() => setScreen("list")} disabled={saving}>
                                Hủy
                            </button>
                            <button type="button" className="v3-btn v3-btn--primary" onClick={addSelectedLibrary} disabled={saving || selectedLib.length === 0}>
                                {saving
                                    ? (addMode?.type === "replaceOne" ? "Đang thay thế…" : "Đang thêm…")
                                    : (addMode?.type === "replaceOne"
                                        ? `Thay thế bằng ${selectedLib.length} thao tác`
                                        : `Thêm ${selectedLib.length} thao tác vào testcase`)}
                            </button>
                        </div>
                    </div>
                    <p className="v3-act__note">
                        Không có thao tác phù hợp?{" "}
                        <Link className="v3-link" to="/codegen">Mở CodeGen</Link>
                    </p>
                </div>
            ) : null}
        </div>
    );
}
