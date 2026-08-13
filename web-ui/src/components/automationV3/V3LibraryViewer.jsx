import { useEffect, useMemo, useState } from "react";
import { listLibrary } from "../../api/codeGenApi.js";
import { groupLibraryActions } from "../../utils/libraryGroups.js";
import { libraryStepDetail, readableAssertion } from "../../utils/libraryViewer.js";

/*
 V3LibraryViewer — READ-ONLY Action Library Viewer (P0, trang Playwright CodeGen).

 Mục đích: inspection/debugging Action Library shared — KHÔNG cần record/dán/phân tích
 bản ghi mới để xem thư viện. Tách "Tạo Action mới" khỏi "Xem Action đã lưu".

 Đọc ĐÚNG shared Action Library qua GET /api/codegen/library (cùng instance ActionLibrary
 mà Automation Workspace dùng — không có library thứ hai). READ-ONLY: không sửa/xóa/clone/
 reorder/AI. Recorded literal hiển thị NGUYÊN như persisted (không normalize/parameterize);
 giá trị nhạy cảm đã bị backend mask "••••" (giữ security).

 Reuse: listLibrary API · groupLibraryActions (grouping Chức năng) · semanticStepText
 (readable) · ACTION_LABEL · class v3-drawer / v3-lib-group / v3-steps.
*/

export default function V3LibraryViewer({ onClose }) {
    const [library, setLibrary] = useState(null); // null = đang tải
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [expandedGroup, setExpandedGroup] = useState(null);
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

    const filtered = useMemo(() => {
        const q = String(search ?? "").trim().toLowerCase();
        if (!q) return library ?? [];
        return (library ?? []).filter(b =>
            String(b?.label ?? "").toLowerCase().includes(q) ||
            String(b?.groupName ?? "").toLowerCase().includes(q)
        );
    }, [library, search]);

    const groups = useMemo(() => groupLibraryActions(filtered), [filtered]);
    const selected = useMemo(() => (library ?? []).find(b => b.blockId === selectedId) ?? null, [library, selectedId]);
    const selectedSteps = useMemo(() => (selected?.steps ?? []).map(libraryStepDetail), [selected]);

    return (
        <div className="v3-drawer v3-drawer--wide" role="dialog" aria-modal="true" aria-label="Thư viện thao tác">
            <div className="v3-drawer__head">
                <div>
                    <b>THƯ VIỆN THAO TÁC</b>
                    <div className="v3-drawer__sub">Đọc từ Action Library shared — CodeGen và Automation dùng chung (chỉ xem)</div>
                </div>
                <button type="button" className="v3-drawer__close" onClick={onClose} aria-label="Đóng">✕</button>
            </div>

            <div className="v3-drawer__body">
                {error ? <p className="v3-act__note v3-warn">{error}</p> : null}

                {library === null ? (
                    <p className="v3-act__note">{loading ? "Đang tải thư viện…" : "Đang tải…"}</p>
                ) : library.length === 0 ? (
                    /* CASE 6 — Empty library: empty state rõ, không báo lỗi giả. */
                    <p className="v3-act__note">Thư viện chưa có thao tác nào. Hãy record hoặc dán bản ghi Playwright rồi lưu thao tác đầu tiên.</p>
                ) : (
                    <div className="v3-lib-viewer">
                        {/* Danh sách: tìm kiếm + nhóm theo Chức năng */}
                        <div className="v3-lib-viewer__list">
                            <div className="v3-lib-viewer__search">
                                <input
                                    className="v3-input"
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Tìm thao tác (tên / chức năng)…"
                                />
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={refresh} disabled={loading} title="Làm mới">
                                    {loading ? "…" : "⟳"}
                                </button>
                            </div>
                            {groups.length === 0 ? (
                                <p className="v3-act__note">Không tìm thấy thao tác khớp "{search}".</p>
                            ) : groups.map(g => (
                                <div className="v3-lib-group" key={g.rawGroupName ?? ""}>
                                    <button
                                        type="button"
                                        className="v3-lib-group__head"
                                        onClick={() => setExpandedGroup(expandedGroup === g.groupName ? null : g.groupName)}
                                    >
                                        <span className="v3-lib-group__arrow">{expandedGroup === g.groupName ? "▾" : "▸"}</span>
                                        <b>{g.groupName}</b>
                                        <span className="v3-lib-group__count">· {g.count} thao tác</span>
                                    </button>
                                    {expandedGroup === g.groupName ? g.items.map(b => (
                                        <button
                                            type="button"
                                            className={`v3-lib-viewer__item${selectedId === b.blockId ? " v3-lib-viewer__item--on" : ""}`}
                                            key={b.blockId}
                                            onClick={() => setSelectedId(b.blockId)}
                                        >
                                            <b>{b.label}</b>
                                            <span className="v3-act__note">{b.stepCount} bước · {b.recordedAssertionCount} điều kiện · dùng bởi {b.usedByTestCases ?? 0} testcase</span>
                                        </button>
                                    )) : null}
                                </div>
                            ))}
                        </div>

                        {/* Chi tiết Action đã chọn — READ-ONLY */}
                        <div className="v3-lib-viewer__detail">
                            {selected ? (
                                <>
                                    <h4 className="v3-map__h">{selected.label}</h4>
                                    <div className="v3-info-row"><span>Chức năng</span><b>{selected.groupName || "Chưa phân loại"}</b></div>
                                    <div className="v3-info-row"><span>Nguồn</span><b>Bản ghi {selected.sourceRecordingId ?? "—"}{selected.sourceRange ? ` · Bước ${selected.sourceRange.startStep} → ${selected.sourceRange.endStep}` : ""}</b></div>
                                    <div className="v3-info-row"><span>Số bước</span><b>{selected.stepCount}</b></div>
                                    <div className="v3-info-row"><span>Điều kiện kiểm tra</span><b>{selected.recordedAssertionCount}</b></div>

                                    {/* Steps theo đúng thứ tự — recorded value NGUYÊN (CASE 3/4) */}
                                    <div className="v3-steps">
                                        {selectedSteps.map(s => (
                                            <div className="v3-step" key={s.order}>
                                                <span className="v3-step__n">{s.order}</span>
                                                <span className="v3-step__act">{s.actionLabel}</span>
                                                <span className="v3-step__loc">{s.semantic}</span>
                                                {s.hasRecordedValue ? (
                                                    <code className="v3-lib-viewer__value">
                                                        giá trị bản ghi: {JSON.stringify(s.recordedValue)}
                                                        {s.recordedValue === "••••" ? " (nhạy cảm — đã che)" : ""}
                                                    </code>
                                                ) : null}
                                                {s.locator ? (
                                                    <details className="v3-act__tech"><summary>Xem kỹ thuật</summary><code className="v3-exp__stmt">{s.locator}</code></details>
                                                ) : null}
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
                                </>
                            ) : (
                                <p className="v3-act__note">Chọn một thao tác để xem chi tiết (inspection — chỉ đọc).</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
