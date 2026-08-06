/*
 V3ConfirmDialog — Xác nhận gọn (không lồng popup) cho thao tác xóa / từ chối.
*/

export default function V3ConfirmDialog({
    open = false,
    title = "",
    message = "",
    confirmLabel = "Xác nhận",
    danger = false,
    busy = false,
    onCancel,
    onConfirm
}) {
    if (!open) return null;
    return (
        <div className="v3-overlay" role="presentation" onClick={onCancel}>
            <div className="v3-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <h4>{title}</h4>
                <p>{message}</p>
                <div className="v3-dialog__actions">
                    <button type="button" className="v3-btn v3-btn--ghost" disabled={busy} onClick={onCancel}>
                        Hủy
                    </button>
                    <button
                        type="button"
                        className={`v3-btn ${danger ? "v3-btn--danger-solid" : "v3-btn--primary"}`}
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
