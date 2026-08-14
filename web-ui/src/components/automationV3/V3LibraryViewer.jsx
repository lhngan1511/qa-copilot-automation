import { useEffect, useMemo, useState } from "react";
import { listLibrary, updateLibraryAction, deleteLibraryAction } from "../../api/codeGenApi.js";
import { groupLibraryActions } from "../../utils/libraryGroups.js";
import { libraryStepDetail, readableAssertion } from "../../utils/libraryViewer.js";
import { ACTION_LABEL } from "../../utils/automationV3.js";

/*
 V3LibraryViewer — READ-ONLY + EDIT/DELETE Action Library Viewer (theo wireframe
 docs/V3_LIBRARY_VIEWER_WIREFRAME.md — large modal/workspace overlay).

 Container: .v3-lib-overlay → .v3-lib-modal (min(90vw,1400px), max-height 88vh).
 Đóng: ✕ / Escape / click ngoài.

 2 cột: trái 340px (Chức năng → Actions: search + group + count + selected)
        phải 1fr (Action Detail).

 PHẦN A — STEP GRID 5 cột (CSS grid):
   STT | Loại | Thao tác (1fr) | Giá trị bản ghi | Technical (collapse)
   - STT/Loại width cố định; mô tả 1fr; recorded value ổn định + ellipsis (title=full);
   - sensitive mask "••••"; technical "▸ Xem kỹ thuật" collapse; không wrap từng ký tự;
   - responsive: dưới 900px chuyển 1 cột (grid template đơn giản).

 PHẦN B/C — Action header [Chỉnh sửa][Xóa] + warning used; edit composition:
   rename / đổi Chức năng / include-exclude step (KHÔNG raw Playwright). Lưu → PATCH
   /codegen/library/:id (updateBlock + confirm: content change → version++ + hash mới →
   fingerprint testcase đang dùng đổi → stale → bắt Generate lại).

 PHẦN D — Delete: backend chặn khi usedByTestCases > 0 (409 LIBRARY_IN_USE); UI hiện
   warning + disable. unused → confirm inline → DELETE.

 Reuse: GET/PATCH/DELETE /codegen/library (shared Action Library — CodeGen + Automation),
 groupLibraryActions, libraryStepDetail, readableAssertion.
*/

export default function V3LibraryViewer({ onClose }) {
    const [library, setLibrary] = useState(null);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editLabel, setEditLabel] = useState("");
    const [editGroup, setEditGroup] = useState("");
    const [editStepsOn, setEditStepsOn] = useState([]); // orders được include
    const [editBusy, setEditBusy] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [notice, setNotice] = useState("");

    const refresh = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await listLibrary();
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setLibrary(data);
            if (data.length === 0) setSelectedId(null);
        } catch (e) {
            setError(e?.message ?? "Không đọc được thư viện thao tác.");
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
    const selected = useMemo(() => (library ?? []).find(b => b.blockId === selectedId) ?? null, [library, selectedId]);
    const selectedSteps = useMemo(() => (selected?.steps ?? []).map(libraryStepDetail), [selected]);
    const usedCount = selected?.usedByTestCases ?? 0;

    const startEdit = () => {
        if (!selected) return;
        setEditing(true);
        setEditLabel(selected.label ?? "");
        setEditGroup(selected.groupName ?? "");
        setEditStepsOn((selected.steps ?? []).map(s => s.order));
        setNotice("");
    };
    const cancelEdit = () => { setEditing(false); setNotice(""); };

    const saveEdit = async () => {
        if (!selected) return;
        setEditBusy(true);
        setError("");
        try {
            const keptSteps = (selected.steps ?? []).filter(s => editStepsOn.includes(s.order));
            await updateLibraryAction(selected.blockId, { label: editLabel, groupName: editGroup, steps: keptSteps });
            setNotice(keptSteps.length !== (selected.steps ?? []).length
                ? "Đã lưu. Testcase đang dùng Action này cần Sinh lại (nội dung thay đổi)."
                : "Đã lưu thay đổi.");
            setEditing(false);
            await refresh();
        } catch (e) {
            setError(e?.message ?? "Không lưu được thay đổi.");
        } finally {
            setEditBusy(false);
        }
    };

    const doDelete = async () => {
        if (!selected) return;
        setEditBusy(true);
        setError("");
        try {
            await deleteLibraryAction(selected.blockId);
            setNotice("Đã xóa thao tác khỏi Thư viện.");
            setDeleteConfirmId(null);
            setSelectedId(null);
            await refresh();
        } catch (e) {
            setError(e?.message ?? "Không xóa được thao tác.");
        } finally {
            setEditBusy(false);
        }
    };

    const handleBackdrop = e => { if (e.target === e.currentTarget) onClose?.(); };

    return (
        <div className="v3-lib-overlay" onClick={handleBackdrop}>
            <div className="v3-lib-modal" role="dialog" aria-modal="true" aria-label="Thư viện thao tác">
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
                </div>

                <div className="v3-lib-modal__body">
                    {error ? <p className="v3-act__note v3-warn">{error}</p> : null}
                    {notice ? <p className="v3-act__note v3-ok">{notice}</p> : null}

                    {library === null ? (
                        <p className="v3-act__note">{loading ? "Đang tải thư viện…" : "Đang tải…"}</p>
                    ) : library.length === 0 ? (
                        <p className="v3-act__note">Thư viện chưa có thao tác nào. Hãy record hoặc dán bản ghi Playwright rồi lưu thao tác đầu tiên.</p>
                    ) : (
                        <>
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
                                                            key={b.blockId} onClick={() => { setSelectedId(b.blockId); setEditing(false); setDeleteConfirmId(null); setNotice(""); }}>
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

                            <div className="v3-lib-modal__detail">
                                {selected ? (
                                    <>
                                        <div className="v3-lib-modal__detail-head">
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
                                                {!editing ? (
                                                    <>
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={startEdit}>Chỉnh sửa</button>
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={usedCount > 0 || editBusy} title={usedCount > 0 ? "Đang được testcase dùng — không xóa được" : ""} onClick={() => setDeleteConfirmId(selected.blockId)}>Xóa</button>
                                                    </>
                                                ) : null}
                                            </div>
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

                                        {editing ? (
                                            <div className="v3-lib-modal__edit">
                                                <div className="v3-lib-modal__edit-row">
                                                    <label className="v3-act__note">Tên Action</label>
                                                    <input className="v3-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} disabled={editBusy} />
                                                </div>
                                                <div className="v3-lib-modal__edit-row">
                                                    <label className="v3-act__note">Chức năng</label>
                                                    <input className="v3-input" value={editGroup} onChange={e => setEditGroup(e.target.value)} disabled={editBusy} placeholder="Chưa phân loại" />
                                                </div>
                                                <div className="v3-lib-modal__edit-row">
                                                    <span className="v3-act__note">Bước (bỏ chọn = loại khỏi Action — ảnh hưởng testcase đang dùng, cần Sinh lại)</span>
                                                    {(selected.steps ?? []).map(s => (
                                                        <label className="v3-lib-modal__edit-step" key={s.order}>
                                                            <input type="checkbox" checked={editStepsOn.includes(s.order)} disabled={editBusy}
                                                                onChange={e => setEditStepsOn(list => e.target.checked ? [...list, s.order] : list.filter(o => o !== s.order))} />
                                                            <span className="v3-step__n">Bước {s.order}</span>
                                                            <span className="v3-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                                                            <span className="v3-step__loc">{s.target || s.locator || ""}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className="v3-step-review__actions">
                                                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={editBusy || !editLabel.trim()} onClick={saveEdit}>{editBusy ? "Đang lưu…" : "Lưu"}</button>
                                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={editBusy} onClick={cancelEdit}>Hủy</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="v3-lib-modal__steps-head">
                                                    <span className="v3-lib-step__n">STT</span>
                                                    <span className="v3-lib-step__type">Loại</span>
                                                    <span className="v3-lib-step__desc">Thao tác</span>
                                                    <span className="v3-lib-step__val">Giá trị bản ghi</span>
                                                    <span className="v3-lib-step__tech">Technical</span>
                                                </div>
                                                {selectedSteps.map(s => (
                                                    <div className="v3-lib-modal__step" key={s.order}>
                                                        <span className="v3-lib-step__n">{s.order}</span>
                                                        <span className="v3-lib-step__type">{s.actionLabel}</span>
                                                        <span className="v3-lib-step__desc">{s.semantic}</span>
                                                        <span className="v3-lib-step__val" title={s.hasRecordedValue ? s.recordedValue : ""}>
                                                            {s.hasRecordedValue ? JSON.stringify(s.recordedValue) : "—"}{s.recordedValue === "••••" ? " (nhạy cảm)" : ""}
                                                        </span>
                                                        <span className="v3-lib-step__tech">
                                                            <details className="v3-act__tech"><summary>Xem kỹ thuật</summary>
                                                                <code className="v3-exp__stmt">{s.locator || "—"}{s.target ? `\ntarget: ${s.target}` : ""}</code>
                                                            </details>
                                                        </span>
                                                    </div>
                                                ))}
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
                                            </>
                                        )}
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
