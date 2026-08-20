import { Link } from "react-router-dom";
import { getWorkflowOutputUrl } from "../api/workflowApi.js";

const downloads = [
    { format: "excel", label: "Tải Excel" },
    { format: "json", label: "Tải JSON" },
    { format: "markdown", label: "Tải Markdown" }
];

export default function CompletedWorkflowPanel({ workflow }) {
    const availableFormats = new Set((workflow.exports ?? []).map(output => output.format));
    const approvedCount = workflow.testCases?.approved ?? 0;

    return (
        <section className="completed-workflow" aria-labelledby="completed-workflow-title">
            <span className="completed-workflow__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                    <path d="m7 12 3 3 7-7" />
                    <circle cx="12" cy="12" r="9" />
                </svg>
            </span>
            <div className="completed-workflow__heading">
                <h2 id="completed-workflow-title">Hoàn tất tạo Test Case</h2>
                <p>Các test case đã được tester phê duyệt và sẵn sàng để xuất file.</p>
            </div>

            <div className="completed-workflow__count">
                <strong>{approvedCount}</strong>
                <span>test case đã duyệt</span>
            </div>

            <div className="completed-workflow__downloads" aria-label="Tải test case đã duyệt">
                {downloads.map(download =>
                    availableFormats.has(download.format) ? (
                        <a
                            className="button button--primary"
                            href={getWorkflowOutputUrl(workflow.id, download.format)}
                            key={download.format}
                        >
                            {download.label}
                        </a>
                    ) : (
                        <button
                            className="button button--primary"
                            type="button"
                            disabled
                            key={download.format}
                            title="Định dạng này chưa sẵn sàng"
                        >
                            {download.label}
                        </button>
                    )
                )}
            </div>

            <Link
                className="button button--secondary"
                to={`/workflows/${encodeURIComponent(workflow.id)}?view=testcases`}
            >
                Xem danh sách testcase
            </Link>
        </section>
    );
}
