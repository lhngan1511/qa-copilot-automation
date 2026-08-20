import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listLibrary, updateLibraryAction, deleteLibraryAction } from "../../api/codeGenApi.js";
import { groupLibraryActions, groupLibraryActionsByCreatedDate } from "../../utils/libraryGroups.js";
import { libraryStepDetail, readableAssertion } from "../../utils/libraryViewer.js";

const formatRecordedDateTime = value => {
    const date = new Date(value ?? "");
    if (!Number.isFinite(date.getTime())) return "Không rõ ngày ghi";
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    }).format(date);
};

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
    const [applyGroupToRecording, setApplyGroupToRecording] = useState(false);
    const [editStepsOn, setEditStepsOn] = useState([]);
    const [editValues, setEditValues] = useState({});
    const [dirtySensitiveValues, setDirtySensitiveValues] = useState([]);
    const [editBusy, setEditBusy] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [expandedTechnicalStep, setExpandedTechnicalStep] = useState(null);
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
    const searchEmpty = String(search ?? "").trim().length > 0 && filtered.length === 0;
    const totalActions = (library ?? []).length;
    const libraryEmpty = Array.isArray(library) && library.length === 0;
    const compactState = library === null || libraryEmpty;
    // selected theo blockId — giữ qua refresh (re-select SAME blockId sau save).
    const selected = useMemo(() => (library ?? []).find(b => b.blockId === selectedId) ?? null, [library, selectedId]);
    const selectedSteps = useMemo(() => (selected?.steps ?? []).map(libraryStepDetail), [selected]);
    const usedCount = selected?.usedByTestCases ?? 0;
    const sameRecordingActions = useMemo(() => {
        const sourceId = String(selected?.sourceRecordingId ?? "").trim();
        if (!sourceId) return selected ? [selected] : [];
        return (library ?? []).filter(item => String(item?.sourceRecordingId ?? "").trim() === sourceId);
    }, [library, selected]);

    const selectAction = b => {
        setSelectedId(b.blockId);
        setEditing(false);
        setDeleteConfirmId(null);
        setExpandedTechnicalStep(null);
        setStatus(null);
        setExpandedGroup(expandedGroup ?? null);
    };

    const startEdit = () => {
        if (!selected) return;
        setEditing(true);
        setEditLabel(selected.label ?? "");
        setEditGroup(selected.groupName ?? "");
        setApplyGroupToRecording(sameRecordingActions.length > 1);
        setEditStepsOn((selected.steps ?? []).map(s => s.order));
        setEditValues(Object.fromEntries((selected.steps ?? []).map(s => [s.order, s.sensitive ? "" : String(s.recordedValue ?? "")])));
        setDirtySensitiveValues([]);
        setStatus(null);
    };
    const cancelEdit = () => { setEditing(false); setStatus(null); };

    const saveEdit = async () => {
        if (!selected) return;
        setEditBusy(true);
        try {
            const keptSteps = (selected.steps ?? []).filter(s => editStepsOn.includes(s.order)).map(s => ({
                ...s,
                recordedValue: s.sensitive && !dirtySensitiveValues.includes(s.order) ? undefined : (editValues[s.order] ?? ""),
                preserveRecordedValue: Boolean(s.sensitive && !dirtySensitiveValues.includes(s.order))
            }));
            await updateLibraryAction(selected.blockId, { label: editLabel, groupName: editGroup, steps: keptSteps });
            if (applyGroupToRecording && sameRecordingActions.length > 1) {
                await Promise.all(sameRecordingActions
                    .filter(item => item.blockId !== selected.blockId)
                    .map(item => updateLibraryAction(item.blockId, { groupName: editGroup })));
            }
            // Refresh rồi RE-SELECT cùng blockId — detail vẫn cột phải; edit=false.
            await refresh();
            setSelectedId(selected.blockId);
            setEditing(false);
            setDeleteConfirmId(null);
            showStatus("ok", applyGroupToRecording && sameRecordingActions.length > 1
                ? `✓ Đã cập nhật Chức năng cho ${sameRecordingActions.length} thao tác cùng bản ghi`
                : keptSteps.length !== (selected.steps ?? []).length
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

    // DÙNG CHUNG cho VIEW và EDIT — grid 5 cột; edit thêm checkbox trong cell STT.
    // STT là thứ tự cục bộ trong Action (1..N). s.order vẫn là định danh bước nguồn
    // dùng cho edit/expand/persistence, không được ghi đè bằng số hiển thị.
    const renderStepRow = (s, withCheckbox, displayOrder) => (
        <Fragment key={s.order}>
        <div className="v3-lib-modal__step">
            <span className="v3-lib-step__n">
                {withCheckbox ? (
                    <label className="v3-lib-step__use" title="Bỏ chọn để loại bước khỏi Action">
                        <input type="checkbox" checked={editStepsOn.includes(s.order)} disabled={editBusy}
                            onChange={e => setEditStepsOn(list => e.target.checked ? [...list, s.order] : list.filter(o => o !== s.order))} />
                        <span>{displayOrder}</span>
                    </label>
                ) : displayOrder}
            </span>
            <span className="v3-lib-step__type">{s.actionLabel}</span>
            <span className="v3-lib-step__desc" title={s.semantic}>{s.semantic}</span>
            <span className="v3-lib-step__val" title={!withCheckbox && s.hasRecordedValue ? s.recordedValue : ""}>
                {withCheckbox ? (
                    <input
                        className="v3-input v3-lib-step__value-input"
                        type={s.sensitive ? "password" : "text"}
                        value={editValues[s.order] ?? ""}
                        disabled={editBusy || !editStepsOn.includes(s.order)}
                        placeholder={s.sensitive ? "Để trống để giữ nguyên" : "Không có giá trị"}
                        aria-label={`Giá trị bản ghi bước ${displayOrder}`}
                        onChange={e => {
                            setEditValues(values => ({ ...values, [s.order]: e.target.value }));
                            if (s.sensitive) setDirtySensitiveValues(list => list.includes(s.order) ? list : [...list, s.order]);
                        }}
                    />
                ) : (
                    <>{s.hasRecordedValue ? JSON.stringify(s.recordedValue) : "Không có"}{s.sensitive ? " (nhạy cảm)" : ""}</>
                )}
            </span>
            <span className="v3-lib-step__tech">
                <button type="button" className="v3-lib-step__tech-toggle"
                    aria-expanded={expandedTechnicalStep === s.order}
                    onClick={() => setExpandedTechnicalStep(current => current === s.order ? null : s.order)}>
                    {expandedTechnicalStep === s.order ? "▾ Ẩn" : "▸ Xem"}
                </button>
            </span>
        </div>
        {expandedTechnicalStep === s.order ? (
            <div className="v3-lib-step__technical-row">
                <code className="v3-exp__stmt">{s.locator || "Không có locator"}{s.target ? `\ntarget: ${s.target}` : ""}</code>
            </div>
        ) : null}
        </Fragment>
    );

    return createPortal((
        <div className="v3-lib-overlay">
            <div className={`v3-lib-modal${compactState ? " v3-lib-modal--compact" : ""}`} role="dialog" aria-modal="true" aria-label="Thư viện thao tác">
                {/* HEADER — fixed; status row nằm ở đây (KHÔNG phải grid child của body) */}
                <div className="v3-lib-modal__header">
                    <div className="v3-lib-modal__title-row">
                        <div className="v3-lib-modal__heading">
                            <b>THƯ VIỆN THAO TÁC</b>
                            <span>{totalActions > 0 ? `${totalActions} thao tác` : ""}</span>
                        </div>
                        <button type="button" className="v3-drawer__close" onClick={onClose} aria-label="Đóng">✕</button>
                    </div>
                    <div className="v3-lib-modal__sub">
                        <span>Dùng chung cho CodeGen và Automation</span>
                    </div>
                    {!compactState ? (
                        <div className="v3-lib-modal__search">
                            <input className="v3-input" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm thao tác (tên / chức năng)…" />
                        </div>
                    ) : null}
                    {/* Status row — toast/banner nhỏ trong header (không phá body grid) */}
                    {status ? (
                        <div className={`v3-lib-modal__status v3-lib-modal__status--${status.kind}`}>{status.text}</div>
                    ) : null}
                </div>

                {/* BODY — LUÔN chỉ 2 grid children: tree + detail */}
                <div className="v3-lib-modal__body">
                    {library === null ? (
                        <div className="v3-lib-modal__empty v3-lib-modal__empty--loading">
                            <span className="loading-spinner" aria-hidden="true" />
                            <strong>{loading ? "Đang tải thư viện…" : "Đang tải…"}</strong>
                        </div>
                    ) : library.length === 0 ? (
                        <div className="v3-lib-modal__empty v3-lib-modal__empty--library">
                            <span className="v3-lib-modal__empty-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5v-16Z" /><path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19M9 7h6M9 11h4" /></svg>
                            </span>
                            <strong>Thư viện chưa có thao tác</strong>
                            <p>Ghi hoặc dán bản ghi Playwright trong CodeGen, sau đó lưu thao tác đầu tiên vào thư viện.</p>
                            <button type="button" className="v3-btn v3-btn--secondary" onClick={onClose}>Quay lại CodeGen</button>
                        </div>
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
                                                aria-expanded={open}
                                                onClick={() => setExpandedGroup(open ? (expandedGroup === g.groupName ? null : g.groupName) : g.groupName)}>
                                                <span className={`v3-lib-group__arrow${open ? " is-open" : ""}`} aria-hidden="true">›</span>
                                                <b>{g.groupName}</b>
                                            </button>
                                            {open ? (
                                                <div className="v3-lib-modal__group-body">
                                                    {groupLibraryActionsByCreatedDate(g.items).map(day => (
                                                        <div className="v3-lib-date-group" key={day.key}>
                                                            <div className="v3-lib-date-group__label">{day.label}</div>
                                                            {day.items.map(b => (
                                                                <button type="button"
                                                                    className={`v3-lib-viewer__item${selectedId === b.blockId ? " v3-lib-viewer__item--on" : ""}`}
                                                                    key={b.blockId} onClick={() => selectAction(b)}>
                                                                    <b>{b.label}</b>
                                                                    <span className="v3-act__note">
                                                                        {b.stepCount} bước · {formatRecordedDateTime(b.createdAt)}{(b.usedByTestCases ?? 0) > 0 ? ` · ${b.usedByTestCases} testcase` : ""}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* DETAIL PANE (flexible, scroll riêng, min-width:0) */}
                            <div className="v3-lib-modal__detail">
                                {searchEmpty ? (
                                    <div className="v3-lib-modal__detail-empty">
                                        <strong>Không tìm thấy thao tác phù hợp</strong>
                                        <span>Thử tìm theo tên Action hoặc chức năng.</span>
                                    </div>
                                ) : selected ? (
                                    <>
                                        <div className="v3-lib-modal__detail-head">
                                            {editing ? (
                                                /* EDIT HEADER — inputs thay chips; metadata/steps vẫn đúng vị trí cũ */
                                                <div className="v3-lib-modal__edit-head">
                                                    <div className="v3-lib-modal__edit-row">
                                                        <label className="v3-act__note">Tên thao tác</label>
                                                        <input className="v3-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} disabled={editBusy} />
                                                    </div>
                                                    <div className="v3-lib-modal__edit-row">
                                                        <label className="v3-act__note">Chức năng</label>
                                                        <input className="v3-input" value={editGroup} onChange={e => setEditGroup(e.target.value)} disabled={editBusy} placeholder="Chưa phân loại" />
                                                    </div>
                                                    {sameRecordingActions.length > 1 ? (
                                                        <label className="v3-lib-modal__batch-group">
                                                            <input
                                                                type="checkbox"
                                                                checked={applyGroupToRecording}
                                                                onChange={e => setApplyGroupToRecording(e.target.checked)}
                                                                disabled={editBusy}
                                                            />
                                                            <span>Áp dụng Chức năng cho {sameRecordingActions.length} thao tác cùng bản ghi</span>
                                                        </label>
                                                    ) : null}
                                                    <div className="v3-lib-modal__edit-row v3-act__note">
                                                        {selected.stepCount} bước · {selected.recordedAssertionCount} điều kiện
                                                        {usedCount > 0 ? ` · ${usedCount} testcase đang sử dụng` : ""}
                                                    </div>
                                                    <div className="v3-step-review__actions v3-lib-modal__edit-actions">
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={editBusy} onClick={cancelEdit}>Hủy</button>
                                                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={editBusy || !editLabel.trim()} onClick={saveEdit}>
                                                            {editBusy ? "Đang lưu…" : "Lưu thay đổi"}
                                                        </button>
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
                                                            {usedCount > 0 ? <span className="v3-lib-modal__chip">{usedCount} testcase đang dùng</span> : null}
                                                        </div>
                                                        <div className="v3-info-row"><span>Nguồn</span><b>Bản ghi {selected.sourceRecordingId ?? "—"}{selected.sourceRange ? ` · Bước ${selected.sourceRange.startStep} → ${selected.sourceRange.endStep}` : ""}</b></div>
                                                        <div className="v3-info-row"><span>Ngày ghi</span><b>{formatRecordedDateTime(selected.createdAt)}</b></div>
                                                        {usedCount > 0 ? <p className="v3-act__note v3-warn">⚠ Action này đang được dùng bởi {usedCount} testcase.</p> : null}
                                                    </div>
                                                    <div className="v3-lib-modal__detail-actions">
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={startEdit}>Chỉnh sửa</button>
                                                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={usedCount > 0 || editBusy}
                                                            title={usedCount > 0 ? "Không thể xóa vì Action đang được testcase sử dụng." : ""}
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
                                        {selectedSteps.map((s, index) => renderStepRow(s, editing, index + 1))}
                                        {(selected.recordedAssertions ?? []).length > 0 ? (
                                            <div className="v3-act__verif">
                                                <span className="v3-act__note v3-act__verif-label">Điều kiện kiểm tra:</span>
                                                {(selected.recordedAssertions ?? []).map((a, j) => (
                                                    <div key={j} className="v3-cond v3-cond--compact">
                                                        <b>✓ {readableAssertion(a)}</b>
                                                    </div>
                                                ))}
                                                <details className="v3-act__tech v3-lib-assertions__tech">
                                                    <summary>Xem thông tin kỹ thuật</summary>
                                                    <code className="v3-exp__stmt">
                                                        {(selected.recordedAssertions ?? []).map(a => a.statement || a.matcher).join("\n")}
                                                    </code>
                                                </details>
                                            </div>
                                        ) : null}
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
    ), document.body);
}
