import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listRecordings, getRecording, renameRecording, deleteRecording } from "../../api/codeGenApi.js";

/*
 V3SavedRecordingsViewer — "Bản ghi đã lưu" (2026-08-28, theo yêu cầu Ngân).

 Cùng pattern hiển thị với V3LibraryViewer (overlay/portal, list trái · detail phải, search) —
 KHÁC ở chỗ đây là danh sách RECORDING (script Playwright thô đã đặt tên & lưu), không phải
 Action đã xác nhận vào Thư viện. Chỉ hiện recording có `savedByUser === true` — recording tự
 tạo lúc parse draft (mỗi lần sửa nội dung ô dán, xem doParse trong V3RecordingPreparationPanel)
 không có tên thật/chưa được tester chủ động lưu thì KHÔNG xuất hiện ở đây (tránh rác).
*/

const formatDateTime = value => {
    const date = new Date(value ?? "");
    if (!Number.isFinite(date.getTime())) return "Không rõ ngày";
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    }).format(date);
};

export default function V3SavedRecordingsViewer({ onClose, onSelect }) {
    const [recordings, setRecordings] = useState(null);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [scriptPreview, setScriptPreview] = useState("");
    const [renaming, setRenaming] = useState(false);
    const [renameDraft, setRenameDraft] = useState("");
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState(null);
    const statusTimer = useRef(null);

    const showStatus = (kind, text, autoClear = true) => {
        setStatus({ kind, text });
        if (statusTimer.current) clearTimeout(statusTimer.current);
        if (autoClear) statusTimer.current = setTimeout(() => setStatus(null), 3000);
    };

    const refresh = async () => {
        setLoading(true);
        try {
            const res = await listRecordings();
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setRecordings(data.filter(r => r?.savedByUser));
        } catch (e) {
            showStatus("err", e?.message ?? "Không đọc được danh sách bản ghi đã lưu.");
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
        if (!q) return recordings ?? [];
        return (recordings ?? []).filter(r => String(r?.label ?? r?.downloadFileName ?? "").toLowerCase().includes(q));
    }, [recordings, search]);

    const selected = useMemo(() => (recordings ?? []).find(r => r.recordingId === selectedId) ?? null, [recordings, selectedId]);

    const selectRecording = async r => {
        setSelectedId(r.recordingId);
        setRenaming(false);
        setDeleteConfirmId(null);
        setStatus(null);
        setScriptPreview("");
        try {
            const detail = await getRecording(r.recordingId);
            const rec = detail?.data ?? detail;
            setScriptPreview(String(rec?.scriptContent ?? ""));
        } catch {
            setScriptPreview("");
        }
    };

    const startRename = () => {
        if (!selected) return;
        setRenameDraft(selected.label ?? selected.downloadFileName ?? "");
        setRenaming(true);
    };

    const confirmRename = async () => {
        if (!selected || !renameDraft.trim()) return;
        setBusy(true);
        try {
            await renameRecording(selected.recordingId, { fileName: renameDraft.trim() });
            await refresh();
            setSelectedId(selected.recordingId);
            setRenaming(false);
            showStatus("ok", "✓ Đã đổi tên.");
        } catch (e) {
            showStatus("err", e?.message ?? "Không đổi được tên.");
        } finally {
            setBusy(false);
        }
    };

    const doDelete = async () => {
        if (!selected) return;
        setBusy(true);
        try {
            await deleteRecording(selected.recordingId);
            setSelectedId(null);
            setDeleteConfirmId(null);
            await refresh();
            showStatus("ok", "✓ Đã xóa bản ghi.");
        } catch (e) {
            showStatus("err", e?.message ?? "Không xóa được bản ghi.");
        } finally {
            setBusy(false);
        }
    };

    const chooseSelected = () => {
        if (!selected) return;
        onSelect?.(selected);
    };

    const empty = Array.isArray(recordings) && recordings.length === 0;
    const compactState = recordings === null || empty;
    const searchEmpty = Boolean(search.trim()) && filtered.length === 0;

    return createPortal((
        <div className="v3-lib-overlay">
            <div className={`v3-lib-modal${compactState ? " v3-lib-modal--compact" : ""}`} role="dialog" aria-modal="true" aria-label="Bản ghi đã lưu">
                <div className="v3-lib-modal__header">
                    <div className="v3-lib-modal__title-row">
                        <div className="v3-lib-modal__heading">
                            <b>BẢN GHI ĐÃ LƯU</b>
                            <span>{(recordings ?? []).length > 0 ? `${recordings.length} bản ghi` : ""}</span>
                        </div>
                        <button type="button" className="v3-drawer__close" onClick={onClose} aria-label="Đóng">✕</button>
                    </div>
                    <div className="v3-lib-modal__sub">
                        <span>Script Playwright đã đặt tên & lưu — chọn để nạp lại vào ô soạn thảo</span>
                    </div>
                    {!compactState ? (
                        <div className="v3-lib-modal__search">
                            <input className="v3-input" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên bản ghi…" />
                        </div>
                    ) : null}
                    {status ? (
                        <div className={`v3-lib-modal__status v3-lib-modal__status--${status.kind}`}>{status.text}</div>
                    ) : null}
                </div>

                <div className="v3-lib-modal__body">
                    {recordings === null ? (
                        <div className="v3-lib-modal__empty v3-lib-modal__empty--loading">
                            <span className="loading-spinner" aria-hidden="true" />
                            <strong>{loading ? "Đang tải…" : "Đang tải…"}</strong>
                        </div>
                    ) : empty ? (
                        <div className="v3-lib-modal__empty v3-lib-modal__empty--library">
                            <strong>Chưa có bản ghi nào được lưu</strong>
                            <p>Dán script ở CodeGen, bấm "Đặt tên & Lưu" để lưu bản ghi vào đây và chọn lại sau này.</p>
                            <button type="button" className="v3-btn v3-btn--secondary" onClick={onClose}>Quay lại CodeGen</button>
                        </div>
                    ) : (
                        <>
                            <div className="v3-lib-modal__list">
                                {searchEmpty ? (
                                    <p className="v3-act__note">Không tìm thấy bản ghi khớp "{search}".</p>
                                ) : filtered.map(r => (
                                    <button type="button"
                                        className={`v3-lib-viewer__item${selectedId === r.recordingId ? " v3-lib-viewer__item--on" : ""}`}
                                        key={r.recordingId} onClick={() => selectRecording(r)}>
                                        <b>{r.label ?? r.downloadFileName}</b>
                                        <span className="v3-act__note">{(r.steps ?? []).length} thao tác · {formatDateTime(r.updatedAt ?? r.createdAt)}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="v3-lib-modal__detail">
                                {selected ? (
                                    <>
                                        <div className="v3-lib-modal__detail-head">
                                            {renaming ? (
                                                <div className="v3-lib-modal__edit-head">
                                                    <div className="v3-lib-modal__edit-row">
                                                        <label className="v3-act__note">Tên bản ghi</label>
                                                        <input className="v3-input" value={renameDraft} onChange={e => setRenameDraft(e.target.value)} disabled={busy} />
                                                    </div>
                                                    <div className="v3-step-review__actions v3-lib-modal__edit-actions">
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => setRenaming(false)}>Hủy</button>
                                                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={busy || !renameDraft.trim()} onClick={confirmRename}>
                                                            {busy ? "Đang lưu…" : "Lưu tên"}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <h4 className="v3-map__h">{selected.label ?? selected.downloadFileName}</h4>
                                                        <div className="v3-info-row"><span>Số thao tác</span><b>{(selected.steps ?? []).length}</b></div>
                                                        <div className="v3-info-row"><span>Lưu lúc</span><b>{formatDateTime(selected.updatedAt ?? selected.createdAt)}</b></div>
                                                    </div>
                                                    <div className="v3-lib-modal__detail-actions">
                                                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={chooseSelected}>Chọn bản ghi này</button>
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={startRename}>Đổi tên</button>
                                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => setDeleteConfirmId(selected.recordingId)}>Xóa</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {deleteConfirmId === selected.recordingId ? (
                                            <div className="v3-lib-modal__delete-confirm">
                                                <p className="v3-act__note">Xóa bản ghi "{selected.label ?? selected.downloadFileName}"? Không thể hoàn tác.</p>
                                                <div className="v3-step-review__actions">
                                                    <button type="button" className="v3-btn v3-btn--danger v3-btn--mini" disabled={busy} onClick={doDelete}>{busy ? "Đang xóa…" : "Xóa"}</button>
                                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => setDeleteConfirmId(null)}>Hủy</button>
                                                </div>
                                            </div>
                                        ) : null}

                                        <details className="v3-act__raw">
                                            <summary>Xem mã Playwright</summary>
                                            <pre className="v3-exp__stmt" style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto" }}>{scriptPreview || "(đang tải…)"}</pre>
                                        </details>
                                    </>
                                ) : (
                                    <p className="v3-act__note">Chọn một bản ghi để xem chi tiết.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    ), document.body);
}
