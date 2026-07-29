export default function EmptyState({
    title = "Chưa có workflow",
    message = "Workflow mới sẽ xuất hiện tại đây sau khi được khởi tạo."
}) {
    return (
        <div className="state-panel">
            <span className="state-icon state-icon--empty" aria-hidden="true">
                0
            </span>
            <div>
                <h2>{title}</h2>
                <p>{message}</p>
            </div>
        </div>
    );
}
