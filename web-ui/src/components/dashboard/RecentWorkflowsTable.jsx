import { Link } from "react-router-dom";
import formatDate from "../../utils/formatDate.js";

function visibleStatus(workflow) {
    if (workflow.status === "COMPLETED" || workflow.step === "EXPORT") {
        return { label: "Completed", tone: "success" };
    }
    if (
        workflow.status === "TEST_CASE_REVIEW_REQUIRED" ||
        workflow.step === "TEST_CASE_REVIEW"
    ) {
        return { label: "TestCase Review", tone: "warning" };
    }
    if (
        workflow.status === "AI_ANALYSIS_REVIEW_REQUIRED" ||
        workflow.status === "REVIEW_REQUIRED" ||
        workflow.step === "AI_ANALYSIS_REVIEW"
    ) {
        return { label: "Requirement Review", tone: "primary" };
    }
    return { label: "In progress", tone: "neutral" };
}

export default function RecentWorkflowsTable({ workflows }) {
    return (
        <div className="dashboard-table-wrap">
            <table id="recent-workflows-table" className="dashboard-table">
                <caption className="visually-hidden">Danh sách workflow AI Test Design gần đây</caption>
                <thead>
                    <tr>
                        <th scope="col">Workflow</th>
                        <th scope="col">Status</th>
                        <th scope="col">Last Updated</th>
                        <th scope="col" className="dashboard-table__actions-heading">
                            Action
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
                                <td data-label="Workflow">
                                    <div className="dashboard-table__workflow">
                                        <span className="dashboard-table__file-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24">
                                                <path d="M6 3h8l4 4v14H6V3Zm8 0v5h5M9 13h6M9 17h6" />
                                            </svg>
                                        </span>
                                        <strong title={businessName}>{businessName}</strong>
                                    </div>
                                </td>
                                <td data-label="Status">
                                    <span
                                        className={`dashboard-workflow-status dashboard-workflow-status--${status.tone}`}
                                    >
                                        <span aria-hidden="true" />
                                        {status.label}
                                    </span>
                                </td>
                                <td data-label="Last Updated">
                                    <time dateTime={workflow.timestamps?.updatedAt ?? undefined}>
                                        {formatDate(workflow.timestamps?.updatedAt)}
                                    </time>
                                </td>
                                <td data-label="Action" className="dashboard-table__actions">
                                    <Link
                                        className="dashboard-table__view"
                                        to={`/workflows/${encodeURIComponent(workflow.id)}`}
                                        aria-label={`Mở workflow ${businessName}`}
                                    >
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                                            <circle cx="12" cy="12" r="2.5" />
                                        </svg>
                                        <span>View</span>
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
