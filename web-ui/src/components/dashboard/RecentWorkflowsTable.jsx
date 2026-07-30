import { Link } from "react-router-dom";
import WorkflowStatusBadge from "../WorkflowStatusBadge.jsx";
import formatDate from "../../utils/formatDate.js";

function visibleStepLabel(workflow) {
    if (workflow.status === "COMPLETED" || workflow.step === "EXPORT") return "Completed";
    if (
        workflow.status === "TEST_CASE_REVIEW_REQUIRED" ||
        workflow.step === "TEST_CASE_REVIEW"
    ) {
        return "TestCase Review";
    }
    if (
        workflow.status === "AI_ANALYSIS_REVIEW_REQUIRED" ||
        workflow.status === "REVIEW_REQUIRED" ||
        workflow.step === "AI_ANALYSIS_REVIEW"
    ) {
        return "Requirement Review";
    }
    return "Upload File";
}

export default function RecentWorkflowsTable({ workflows }) {
    return (
        <div className="dashboard-table-wrap">
            <table id="recent-workflows-table" className="dashboard-table">
                <caption className="visually-hidden">Danh sách workflow AI Test Design gần đây</caption>
                <thead>
                    <tr>
                        <th scope="col">Tên workflow</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Bước hiện tại</th>
                        <th scope="col">Clarification</th>
                        <th scope="col">Testcases</th>
                        <th scope="col">Cập nhật cuối</th>
                        <th scope="col" className="dashboard-table__actions-heading">
                            Thao tác
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {workflows.map(workflow => {
                        const clarification = workflow.clarification ?? {};
                        const testCases = workflow.testCases ?? {};

                        return (
                            <tr key={workflow.id}>
                                <td data-label="Tên workflow">
                                    <div className="dashboard-table__workflow">
                                        <span className="dashboard-table__file-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24">
                                                <path d="M6 3h8l4 4v14H6V3Zm8 0v5h5M9 13h6M9 17h6" />
                                            </svg>
                                        </span>
                                        <span>
                                            <strong>
                                                {workflow.name || workflow.id || "Workflow chưa đặt tên"}
                                            </strong>
                                            <small>{workflow.id}</small>
                                        </span>
                                    </div>
                                </td>
                                <td data-label="Trạng thái">
                                    <WorkflowStatusBadge status={workflow.status} />
                                </td>
                                <td data-label="Bước hiện tại">
                                    <span className="dashboard-table__step">
                                        {visibleStepLabel(workflow)}
                                    </span>
                                </td>
                                <td data-label="Clarification">
                                    <strong className="dashboard-table__metric">
                                        {clarification.answered ?? 0}/{clarification.total ?? 0}
                                    </strong>
                                    <small className="dashboard-table__metric-note">đã trả lời</small>
                                </td>
                                <td data-label="Testcases">
                                    <strong className="dashboard-table__metric">
                                        {testCases.total ?? 0}
                                    </strong>
                                </td>
                                <td data-label="Cập nhật cuối">
                                    <time dateTime={workflow.timestamps?.updatedAt ?? undefined}>
                                        {formatDate(workflow.timestamps?.updatedAt)}
                                    </time>
                                </td>
                                <td data-label="Thao tác" className="dashboard-table__actions">
                                    <Link
                                        className="dashboard-table__view"
                                        to={`/workflows/${encodeURIComponent(workflow.id)}`}
                                    >
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                                            <circle cx="12" cy="12" r="2.5" />
                                        </svg>
                                        <span>Xem chi tiết</span>
                                    </Link>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
