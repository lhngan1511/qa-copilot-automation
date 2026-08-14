import { useEffect, useMemo, useRef, useState } from "react";
import { listLibrary, updateLibraryAction, deleteLibraryAction } from "../../api/codeGenApi.js";
import { groupLibraryActions } from "../../utils/libraryGroups.js";
import { libraryStepDetail, readableAssertion } from "../../utils/libraryViewer.js";

/*
 V3LibraryViewer — Action Library Viewer (VIEW + EDIT/DELETE) — UI regression fix 2026-08-14.

 CONTRACT (sau trace — root cause: error/notice là grid child thứ 3 của .v3-lib-modal__body
 làm CSS Grid auto-placement phá bố cục 2 cột; modal height content-driven):
   - Body LUÔN chỉ có ĐÚNG 2 grid children: tree pane + detail pane.
     Success/error/loading nằm ở STATUS ROW trong HEADER (không phải grid child body).
   - Modal height ỔN ĐỊNH (88vh) — không co/giãn theo content.
   - Tree (340px) và Detail scroll RIÊNG; detail min-width:0 (không horizontal overflow).
   - VIEW và EDIT dùng CÙNG step grid 5 cột (STT|Loại|Thao tác|Giá trị bản ghi|Kỹ thuật).
     Edit chỉ thêm checkbox "Sử dụng bước này" trong cell STT — KHÔNG đổi cấu trúc row.
   - Save: PATCH → refresh → re-select SAME blockId → exit edit → detail vẫn cột phải;
     success nhỏ ở status row, tự biến mất (3s).
   - Delete: confirm inline; backend chặn used>0 (409 LIBRARY_IN_USE) — UI disable khi used.

 Không đổi backend contract (delete guard/updateBlock/version/hash/fingerprint).
*/

export default function V3LibraryViewer({ onClose }) {
    const [library, setLibrary] = useState(null);
    const [search, setSearch] = useState("");
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editLabel, setEditLabel] = useState("");
    const [editGroup, setEditGroup] = useState("");
    const [editStepsOn, setEditStepsOn] = useState([]);
    const [editBusy, setEditBusy] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [status, setStatus] = useState(null); // {kind:"ok"|"err", text}
    const statusTimer = useRef(null);

    const showStatus = (kind, text, autoClear = true) => {
        setStatus({ kind, text });
        if (statusTimer.current) clearTimeout(statusTimer.current);
        if (autoClear) statusTimer.current = setTimeout(() => setStatus(null), 3000);
    };

    const refresh = async () => {
        setLoading(true);
        try {
            const res = await listLibrary();
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setLibrary(data);
            if (data.length === 0) setSelectedId(null);
        } catch (e) {
            showStatus("err", e?.message ?? "Không đọc được thư viện thao tác.");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { refresh(); }, []);
    useEffect(() => {
        const h = e => { if (e.key === "Escape") onClose?.(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    const filtered = useMemo(() => {
        const q = String(search ?? "").trim().toLowerCase();
        if (!q) return library ?? [];
        return (library ?? []).filter(b =>
            String(b?.label ?? "").toLowerCase().includes(q) ||
            String(b?.groupName ?? "").toLowerCase().includes(q)
        );
    }, [library, search]);

    const groups = useMemo(() => groupLibraryActions(filtered), [filtered]);
    const totalActions = (library ?? []).length;
    // selected theo blockId — giữ qua refresh (re-select SAME blockId sau save).
    const selected = useMemo(() => (library ?? []).find(b => b.blockId === selectedId) ?? null, [library, selectedId]);
    const selectedSteps = useMemo(() => (selected?.steps ?? []).map(libraryStepDetail), [selected]);
    const usedCount = selected?.usedByTestCases ?? 0;

    const selectAction = b => {
        setSelectedId(b.blockId);
        setEditing(false);
        setDeleteConfirmId(null);
        setStatus(null);
        setExpandedGroup(expandedGroup ?? null);
    };

    const startEdit = () => {
        if (!selected) return;
        setEditing(true);
        setEditLabel(selected.label ?? "");
        setEditGroup(selected.groupName ?? "");
        setEditStepsOn((selected.steps ?? []).map(s => s.order));
        setStatus(null);
    };
    const cancelEdit = () => { setEditing(false); setStatus(null); };

    const saveEdit = async () => {
        if (!selected) return;
        setEditBusy(true);
        try {
            const keptSteps = (selected.steps ?? []).filter(s => editStepsOn.includes(s.order));
            await updateLibraryAction(selected.blockId, { label: editLabel, groupName: editGroup, steps: keptSteps });
            // Refresh rồi RE-SELECT cùng blockId — detail vẫn cột phải; edit=false.
            await refresh();
            setSelectedId(selected.blockId);
            setEditing(false);
            setDeleteConfirmId(null);
            showStatus("ok", keptSteps.length !== (selected.steps ?? []).length
                ? "✓ Đã lưu — testcase đang dùng Action cần Sinh lại"
                : "✓ Đã lưu thay đổi");
        } catch (e) {
            showStatus("err", e?.message ?? "Không lưu được thay đổi.");
        } finally {
            setEditBusy(false);
        }
    };

    const doDelete = async () => {
        if (!selected) return;
        setEditBusy(true);
        try {
            await deleteLibraryAction(selected.blockId);
            setSelectedId(null);
            setDeleteConfirmId(null);
            setEditing(false);
            await refresh();
            showStatus("ok", "✓ Đã xóa thao tác khỏi Thư viện.");
        } catch (e) {
            showStatus("err", e?.message ?? "Không xóa được thao tác.");
        } finally {
            setEditBusy(false);
        }
    };

    const handleBackdrop = e => { if (e.target === e.currentTarget) onClose?.(); };

    // DÙNG CHUNG cho VIEW và EDIT — grid 5 cột; edit thêm checkbox trong cell STT.
    const renderStepRow = (s, withCheckbox) => (
        <div className="v3-lib-modal__step" key={s.order}>
            <span className="v3-lib-step__n">
                {withCheckbox ? (
                    <label className="v3-lib-step__use" title="Sử dụng bước này">
                        <input type="checkbox" checked={editStepsOn.includes(s.order)} disabled={editBusy}
                            onChange={e => setEditStepsOn(list => e.target.checked ? [...list, s.order] : list.filter(o => o !== s.order))} />
                        <span>{s.order}</span>
                    </label>
                ) : s.order}
            </span>
            <span className="v3-lib-step__type">{s.actionLabel}</span>
            <span className="v3-lib-step__desc" title={s.semantic}>{s.semantic}</span>
            <span className="v3-lib-step__val" title={s.hasRecordedValue ? s.recordedValue : ""}>
                {s.hasRecordedValue ? JSON.stringify(s.recordedValue) : "—"}{s.recordedValue === "••••" ? " (nhạy cảm)" : ""}
            </span>
            <span className="v3-lib-step__tech">
                <details className="v3-act__tech"><summary>Xem kỹ thuật</summary>
                    <code className="v3-exp__stmt">{s.locator || "—"}{s.target ? `\ntarget: ${s.target}` : ""}</code>
                </details>
            </span>
        </div>
    );

    return (
        <div className="v3-lib-overlay" onClick={handleBackdrop}>
            <div className="v3-lib-modal" role="dialog" aria-modal="true" aria-label="Thư viện thao tác">
                {/* HEADER — fixed; status row nằm ở đây (KHÔNG phải grid child của body) */}
                <div className="v3-lib-modal__header">
                    <div className="v3-lib-modal__title-row">
                        <b>THƯ VIỆN THAO TÁC</b>
                        <button type="button" className="v3-drawer__close" onClick={onClose} aria-label="Đóng">✕</button>
                    </div>
                    <div className="v3-lib-modal__sub">
                        <span>Đọc từ Action Library shared — CodeGen và Automation dùng chung</span>
                        <span className="v3-act__note">{totalActions > 0 ? `${totalActions} thao tác · ${groups.length} chức năng` : ""}</span>
                    </div>
                    <div className="v3-lib-modal__search">
                        <input className="v3-input" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm thao tác (tên / chức năng)…" />
                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={refresh} disabled={loading} title="Làm mới">{loading ? "…" : "⟳"}</button>
                    </div>
                    {/* Status row — toast/banner nhỏ trong header (không phá body grid) */}
                    {status ? (
                        <div className={`v3-lib-modal__status v3-lib-modal__status--${status.kind}`}>{status.text}</div>
                    ) : null}
                </div>

                {/* BODY — LUÔN chỉ 2 grid children: tree + detail */}
                <div className="v3-lib-modal__body">
                    {library === null ? (
                        <div className="v3-lib-modal__empty">{loading ? "Đang tải thư viện…" : "Đang tải…"}</div>
                    ) : library.length === 0 ? (
                        <div className="v3-lib-modal__empty">Thư viện chưa có thao tác nào. Hãy record hoặc dán bản ghi Playwright rồi lưu thao tác đầu tiên.</div>
                    ) : (
                        <>
                            {/* TREE PANE (fixed 340px, scroll riêng) */}
                            <div className="v3-lib-modal__list">
                                {groups.length === 0 ? (
                                    <p className="v3-act__note">Không tìm thấy thao tác khớp "{search}".</p>
                                ) : groups.map(g => {
                                    const open = expandedGroup === null || expandedGroup === g.groupName;
                                    return (
                                        <div className="v3-lib-group" key={g.rawGroupName ?? ""}>
                                            <button type="button" className="v3-lib-group__head"
                                                onClick={() => setExpandedGroup(open ? (expandedGroup === g.groupName ? null : g.groupName) : g.groupName)}>
                                                <span className="v3-lib-group__arrow">{open ? "▾" : "▸"}</span>
                                                <b>{g.groupName}</b>
                                                <span className="v3-lib-group__count">({g.count})</span>
                                            </button>
                                            {open ? (
                                                <div className="v3-lib-modal__group-body">
                                                    {g.items.map(b => (
                                                        <button type="button"
                                                            className={`v3-lib-viewer__item${selectedId === b.blockId ? " v3-lib-viewer__item--on" : ""}`}
                                                            key={b.blockId} onClick={() => selectAction(b)}>
                                                            <b>{b.label}</b>
                                                            <span className="v3-act__note">{b.stepCount} bước · dùng bởi {b.usedByTestCases ?? 0}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* DETAIL PANE (flexible, scroll riêng, min-width:0) */}
                            <div className="v3-lib-modal__detail">
                                {selected ? (
                                    <>
                                        <div className="v3-lib-modal__detail-head">
                                            {editing ? (
                                                /* EDIT HEADER — inputs thay chips; metadata/steps vẫn đúng vị trí cũ */
                                                <div className="v3-lib-modal__edit-head">
                                                    <div className="v3-lib-modal__edit-row">
                                                        <label className="v3-act__note">Tên Action</label>
                                                        <input className="v3-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} disabled={editBusy} />
                                                    </div>
                                                    <div className="v3-lib-modal__edit-row">
                                                        <label className="v3-act__note">Chức năng</label>
                                                        <input className="v3-input" value={editGroup} onChange={e => setEditGroup(e.target.value)} disabled={editBusy} placeholder="Chưa phân loại" />
                                                    </div>
                                                    <div className="v3-lib-modal__edit-row v3-act__note">
                                                        {selected.stepCount} bước · {selected.recordedAssertionCount} điều kiện · dùng bởi {selected.usedByTestCases ?? 0} testcase
                                                        {usedCount > 0 ? " · ⚠ đang được dùng — nội dung đổi → testcase cần Sinh lại" : ""}
                                                    </div>
                                                    <div className="v3-step-review__actions">
                                                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={editBusy || !editLabel.trim()} onClick={saveEdit}>
                                                            {editBusy ? "Đang lưu…" : "Lưu thay đổi"}
                                                        </button>
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={editBusy} onClick={cancelEdit}>Hủy</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <h4 className="v3-map__h">{selected.label}</h4>
                                                        <div className="v3-lib-modal__chips">
                                                            <span className="v3-lib-modal__chip">Chức năng: {selected.groupName || "Chưa phân loại"}</span>
                                                            <span className="v3-lib-modal__chip">{selected.stepCount} bước</span>
                                                            <span className="v3-lib-modal__chip">{selected.recordedAssertionCount} điều kiện</span>
                                                            <span className="v3-lib-modal__chip">dùng bởi {selected.usedByTestCases ?? 0} testcase</span>
                                                        </div>
                                                        <div className="v3-info-row"><span>Nguồn</span><b>Bản ghi {selected.sourceRecordingId ?? "—"}{selected.sourceRange ? ` · Bước ${selected.sourceRange.startStep} → ${selected.sourceRange.endStep}` : ""}</b></div>
                                                        {usedCount > 0 ? <p className="v3-act__note v3-warn">⚠ Action này đang được dùng bởi {usedCount} testcase.</p> : null}
                                                    </div>
                                                    <div className="v3-lib-modal__detail-actions">
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={startEdit}>Chỉnh sửa</button>
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={usedCount > 0 || editBusy}
                                                            title={usedCount > 0 ? "Đang được testcase dùng — không xóa được" : ""}
                                                            onClick={() => setDeleteConfirmId(selected.blockId)}>Xóa</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {deleteConfirmId === selected.blockId ? (
                                            <div className="v3-lib-modal__delete-confirm">
                                                <p className="v3-act__note">Xóa thao tác '{selected.label}' khỏi Thư viện?{usedCount > 0 ? ` (đang dùng bởi ${usedCount} testcase — sẽ bị chặn)` : ""}</p>
                                                <div className="v3-step-review__actions">
                                                    <button type="button" className="v3-btn v3-btn--danger v3-btn--mini" disabled={usedCount > 0 || editBusy} onClick={doDelete}>{editBusy ? "Đang xóa…" : "Xóa"}</button>
                                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={editBusy} onClick={() => setDeleteConfirmId(null)}>Hủy</button>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* STEP GRID — CÙNG structure cho VIEW và EDIT (5 cột) */}
                                        <div className="v3-lib-modal__steps-head">
                                            <span className="v3-lib-step__n">{editing ? "Dùng" : "STT"}</span>
                                            <span className="v3-lib-step__type">Loại</span>
                                            <span className="v3-lib-step__desc">Thao tác</span>
                                            <span className="v3-lib-step__val">Giá trị bản ghi</span>
                                            <span className="v3-lib-step__tech">Kỹ thuật</span>
                                        </div>
                                        {selectedSteps.map(s => renderStepRow(s, editing))}
                                        {editing ? <p className="v3-act__note">Bỏ chọn "Dùng" = loại bước khỏi Action (ảnh hưởng testcase đang dùng — cần Sinh lại).</p> : null}

                                        {(selected.recordedAssertions ?? []).length > 0 ? (
                                            <div className="v3-act__verif">
                                                <span className="v3-act__note v3-act__verif-label">Điều kiện kiểm tra:</span>
                                                {(selected.recordedAssertions ?? []).map((a, j) => (
                                                    <div key={j} className="v3-cond v3-cond--compact">
                                                        <b>✓ {readableAssertion(a)}</b>
                                                        <details className="v3-act__tech"><summary>Xem kỹ thuật</summary><code className="v3-exp__stmt">{a.statement || a.matcher}</code></details>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                        <p className="v3-act__note">Sửa/xóa tác động shared Action Library (CodeGen + Automation dùng chung).</p>
                                    </>
                                ) : (
                                    <p className="v3-act__note">Chọn một thao tác để xem chi tiết.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
