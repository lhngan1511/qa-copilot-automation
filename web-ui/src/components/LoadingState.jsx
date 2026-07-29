export default function LoadingState({ message = "Đang tải dữ liệu..." }) {
    return (
        <div className="state-panel" role="status" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            <p>{message}</p>
        </div>
    );
}
