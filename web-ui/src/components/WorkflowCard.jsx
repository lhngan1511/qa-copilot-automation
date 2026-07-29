import { Link } from "react-router-dom";
import WorkflowStatusBadge from "./WorkflowStatusBadge.jsx";
import formatDate from "../utils/formatDate.js";
import { getWorkflowStepLabel } from "../utils/workflowLabels.js";

function Metric({ value, label }) {
    return (
        <div className="metric">
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    );
}

export default function WorkflowCard({ workflow }) {
    const clarification = workflow.clarification ?? {};
    const testCases = workflow.testCases ?? {};

    return (
        <article className="workflow-card">
            <div className="workflow-card__header">
                <div>
                    <p className="workflow-id">{workflow.id}</p>
                    <h2>{workflow.name || workflow.id || "Workflow chưa đặt tên"}</h2>
                </div>
                <WorkflowStatusBadge status={workflow.status} />
            </div>

            <div className="step-row">
                <span>Bước hiện tại</span>
                <strong>{getWorkflowStepLabel(workflow.step)}</strong>
            </div>

            <div className="metric-grid">
                <Metric value={clarification.remaining ?? 0} label="Câu hỏi còn lại" />
                <Metric value={testCases.total ?? 0} label="Testcase" />
                <Metric value={testCases.requiresTesterInput ?? 0} label="Cần dữ liệu" />
            </div>

            <div className="workflow-card__footer">
                <div className="workflow-flags">
                    {workflow.isBlocking && <span className="flag flag--warning">Đang chặn</span>}
                    {workflow.exportAvailable && <span className="flag">Có output</span>}
                </div>
                <div className="workflow-card__actions">
                    <span className="updated-at">
                        Cập nhật {formatDate(workflow.timestamps?.updatedAt)}
                    </span>
                    <Link className="text-link" to={`/workflows/${workflow.id}`}>
                        Xem chi tiết
                    </Link>
                </div>
            </div>
        </article>
    );
}
