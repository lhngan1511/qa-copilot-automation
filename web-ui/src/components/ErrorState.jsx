export default function ErrorState({ title = "Không thể tải dữ liệu", error, onRetry }) {
    return (
        <div className="state-panel state-panel--error" role="alert">
            <span className="state-icon" aria-hidden="true">
                !
            </span>
            <div>
                <h2>{title}</h2>
                <p>{error?.message || "Đã xảy ra lỗi ngoài dự kiến."}</p>
                {error?.code && <p className="error-code">Mã lỗi: {error.code}</p>}
            </div>
            {onRetry && (
                <button className="button button--secondary" type="button" onClick={onRetry}>
                    Thử lại
                </button>
            )}
        </div>
    );
}
