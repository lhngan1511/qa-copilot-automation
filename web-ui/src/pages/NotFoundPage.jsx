import { Link } from "react-router-dom";

export default function NotFoundPage() {
    return (
        <section className="not-found">
            <p className="not-found__code">404</p>
            <h2>Không tìm thấy trang</h2>
            <p>Đường dẫn này chưa tồn tại trong QA Copilot workspace.</p>
            <Link className="button button--primary" to="/">
                Về Workflows
            </Link>
        </section>
    );
}
