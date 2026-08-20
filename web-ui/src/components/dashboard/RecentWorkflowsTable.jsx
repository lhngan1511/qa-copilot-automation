import { Link } from "react-router-dom";
import formatDate from "../../utils/formatDate.js";

function visibleStatus(workflow) {
    if (workflow.status === "COMPLETED" || workflow.step === "EXPORT") {
        return { label: "Hoàn thành", tone: "success" };
    }
    if (
        workflow.status === "TEST_CASE_REVIEW_REQUIRED" ||
        workflow.step === "TEST_CASE_REVIEW"
    ) {
        return { label: "Duyệt testcase", tone: "warning" };
    }
    if (
        workflow.status === "AI_ANALYSIS_REVIEW_REQUIRED" ||
        workflow.status === "REVIEW_REQUIRED" ||
        workflow.step === "AI_ANALYSIS_REVIEW"
    ) {
        return { label: "Duyệt yêu cầu", tone: "primary" };
    }
    return { label: "Đang xử lý", tone: "neutral" };
}

export default function RecentWorkflowsTable({ workflows, deletingId = "", onDelete }) {
    return (
        <div className="dashboard-table-wrap">
            <table id="recent-workflows-table" className="dashboard-table">
                <caption className="visually-hidden">Danh sách workflow AI Test Design gần đây</caption>
                <colgroup>
                    <col className="dashboard-table__col-workflow" />
                    <col className="dashboard-table__col-status" />
                    <col className="dashboard-table__col-updated" />
                    <col className="dashboard-table__col-action" />
                </colgroup>
                <thead>
                    <tr>
                        <th scope="col">Tên yêu cầu</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Cập nhật gần nhất</th>
                        <th scope="col" className="dashboard-table__actions-heading">
                            Thao tác
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {workflows.map(workflow => {
                        const name = workflow.name?.trim();
                        const businessName = name && name !== workflow.id ? name : "Chưa có tên";
                        const status = visibleStatus(workflow);

                        return (
                            <tr key={workflow.id}>
                                <td data-label="Tên yêu cầu">
                                    <div className="dashboard-table__workflow">
                                        <span className="dashboard-table__file-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24">
                                                <path d="M6 3h8l4 4v14H6V3Zm8 0v5h5M9 13h6M9 17h6" />
                                            </svg>
                                        </span>
                                        <strong title={businessName}>{businessName}</strong>
                                    </div>
                                </td>
                                <td data-label="Trạng thái">
                                    <span
                                        className={`dashboard-workflow-status dashboard-workflow-status--${status.tone}`}
                                    >
                                        <span aria-hidden="true" />
                                        {status.label}
                                    </span>
                                </td>
                                <td data-label="Cập nhật gần nhất">
                                    <time dateTime={workflow.timestamps?.updatedAt ?? undefined}>
                                        {formatDate(workflow.timestamps?.updatedAt)}
                                    </time>
                                </td>
                                <td data-label="Thao tác" className="dashboard-table__actions">
                                    <div className="dashboard-table__action-group">
                                        <Link
                                            className="dashboard-table__view"
                                            to={`/workflows/${encodeURIComponent(workflow.id)}?view=testcases`}
                                            aria-label={`Mở workflow ${businessName}`}
                                        >
                                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                                                <circle cx="12" cy="12" r="2.5" />
                                            </svg>
                                            <span>Mở</span>
                                        </Link>
                                        <button
                                            className="dashboard-table__delete"
                                            type="button"
                                            disabled={deletingId === workflow.id}
                                            onClick={() => onDelete?.(workflow)}
                                            aria-label={`Xóa workflow ${businessName}`}
                                            title="Xóa phiên testcase"
                                        >
                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
