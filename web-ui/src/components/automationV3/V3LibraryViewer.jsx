import { useEffect, useMemo, useState } from "react";
import { listLibrary } from "../../api/codeGenApi.js";
import { groupLibraryActions } from "../../utils/libraryGroups.js";
import { libraryStepDetail, readableAssertion } from "../../utils/libraryViewer.js";

/*
 V3LibraryViewer — READ-ONLY Action Library Viewer (theo wireframe
 docs/V3_LIBRARY_VIEWER_WIREFRAME.md — large modal/workspace overlay).

 Container: .v3-lib-overlay (backdrop nhẹ, centered) → .v3-lib-modal
   width: min(90vw, 1400px); max-height: 88vh — KHÔNG bóp layout CodeGen.
 Đóng: ✕ header / Escape / click ngoài (click trong modal không đóng).

 2 cột:
   Trái 340px — cây Chức năng → Actions (search + group header + count badge +
     action indent + selected state).
   Phải 1fr (≥55% modal) — Action Detail: tên, chips meta (Chức năng · N bước ·
     N điều kiện · dùng bởi), Nguồn bản ghi + range, steps đúng thứ tự.

 Step rendering: main = "Bước N · <loại>" + "Giá trị bản ghi: <json>" (mono block
 tint, border-left accent — đọc rõ ngay); technical (target/locator) CHỈ trong
 "▸ Xem kỹ thuật" collapse mặc định (pre-wrap / break-word / scroll — không wrap
 từng ký tự). Sensitive vẫn mask "••••".

 Reuse: GET /api/codegen/library (shared Action Library — CodeGen + Automation),
 groupLibraryActions, libraryStepDetail, readableAssertion. READ-ONLY.
*/

const GROUP_COLLAPSED_DEFAULT = false; // mở mọi group mặc định (browse)

export default function V3LibraryViewer({ onClose }) {
    const [library, setLibrary] = useState(null); // null = đang tải
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [expandedGroup, setExpandedGroup] = useState(null); // null = mọi group mở
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);

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
    // Escape đóng
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

    const handleBackdrop = e => {
        if (e.target === e.currentTarget) onClose?.();
    };

    return (
        <div className="v3-lib-overlay" onClick={handleBackdrop}>
            <div className="v3-lib-modal" role="dialog" aria-modal="true" aria-label="Thư viện thao tác">
                {/* Header */}
                <div className="v3-lib-modal__header">
                    <div className="v3-lib-modal__title-row">
                        <b>THƯ VIỆN THAO TÁC</b>
                        <button type="button" className="v3-drawer__close" onClick={onClose} aria-label="Đóng">✕</button>
                    </div>
                    <div className="v3-lib-modal__sub">
                        <span>Đọc từ Action Library shared — CodeGen và Automation dùng chung (chỉ xem)</span>
                        <span className="v3-act__note">{totalActions > 0 ? `${totalActions} thao tác · ${groups.length} chức năng` : ""}</span>
                    </div>
                    <div className="v3-lib-modal__search">
                        <input
                            className="v3-input"
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm thao tác (tên / chức năng)…"
                        />
                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={refresh} disabled={loading} title="Làm mới">{loading ? "…" : "⟳"}</button>
                    </div>
                </div>

                {/* Body */}
                <div className="v3-lib-modal__body">
                    {error ? <p className="v3-act__note v3-warn">{error}</p> : null}

                    {library === null ? (
                        <p className="v3-act__note">{loading ? "Đang tải thư viện…" : "Đang tải…"}</p>
                    ) : library.length === 0 ? (
                        <p className="v3-act__note">Thư viện chưa có thao tác nào. Hãy record hoặc dán bản ghi Playwright rồi lưu thao tác đầu tiên.</p>
                    ) : (
                        <>
                            {/* Cột trái — Chức năng → Actions */}
                            <div className="v3-lib-modal__list">
                                {groups.length === 0 ? (
                                    <p className="v3-act__note">Không tìm thấy thao tác khớp "{search}".</p>
                                ) : groups.map(g => {
                                    const open = expandedGroup === null || expandedGroup === g.groupName;
                                    return (
                                        <div className="v3-lib-group" key={g.rawGroupName ?? ""}>
                                            <button
                                                type="button"
                                                className="v3-lib-group__head"
                                                onClick={() => setExpandedGroup(open ? (expandedGroup === g.groupName ? null : g.groupName) : g.groupName)}
                                            >
                                                <span className="v3-lib-group__arrow">{open ? "▾" : "▸"}</span>
                                                <b>{g.groupName}</b>
                                                <span className="v3-lib-group__count">({g.count})</span>
                                            </button>
                                            {open ? (
                                                <div className="v3-lib-modal__group-body">
                                                    {g.items.map(b => (
                                                        <button
                                                            type="button"
                                                            className={`v3-lib-viewer__item${selectedId === b.blockId ? " v3-lib-viewer__item--on" : ""}`}
                                                            key={b.blockId}
                                                            onClick={() => setSelectedId(b.blockId)}
                                                        >
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

                            {/* Cột phải — Action Detail */}
                            <div className="v3-lib-modal__detail">
                                {selected ? (
                                    <>
                                        <h4 className="v3-map__h">{selected.label}</h4>
                                        <div className="v3-lib-modal__chips">
                                            <span className="v3-lib-modal__chip">Chức năng: {selected.groupName || "Chưa phân loại"}</span>
                                            <span className="v3-lib-modal__chip">{selected.stepCount} bước</span>
                                            <span className="v3-lib-modal__chip">{selected.recordedAssertionCount} điều kiện</span>
                                            <span className="v3-lib-modal__chip">dùng bởi {selected.usedByTestCases ?? 0} testcase</span>
                                        </div>
                                        <div className="v3-info-row"><span>Nguồn</span><b>Bản ghi {selected.sourceRecordingId ?? "—"}{selected.sourceRange ? ` · Bước ${selected.sourceRange.startStep} → ${selected.sourceRange.endStep}` : ""}</b></div>

                                        {/* Steps đúng thứ tự — recorded value đọc rõ, technical collapse */}
                                        <div className="v3-steps">
                                            {selectedSteps.map(s => (
                                                <div className="v3-step" key={s.order}>
                                                    <div className="v3-step__main">
                                                        <span className="v3-step__n">Bước {s.order}</span>
                                                        <span className="v3-step__act">{s.actionLabel}</span>
                                                        <span className="v3-step__loc">{s.semantic}</span>
                                                    </div>
                                                    {s.hasRecordedValue ? (
                                                        <code className="v3-lib-viewer__value">
                                                            Giá trị bản ghi: {JSON.stringify(s.recordedValue)}
                                                            {s.recordedValue === "••••" ? " (nhạy cảm — đã che)" : ""}
                                                        </code>
                                                    ) : null}
                                                    <details className="v3-act__tech"><summary>Xem kỹ thuật</summary>
                                                        <code className="v3-exp__stmt">
                                                            {s.locator || "—"}{s.target ? `\ntarget: ${s.target}` : ""}
                                                        </code>
                                                    </details>
                                                </div>
                                            ))}
                                        </div>

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
                                        <p className="v3-act__note">Chỉ xem (READ-ONLY) — sửa/xóa tại trang CodeGen.</p>
                                    </>
                                ) : (
                                    <p className="v3-act__note">Chọn một thao tác để xem chi tiết (inspection — chỉ đọc).</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
