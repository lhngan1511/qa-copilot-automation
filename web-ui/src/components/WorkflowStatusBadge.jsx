import { getStatusTone, getWorkflowStatusLabel } from "../utils/workflowLabels.js";

export default function WorkflowStatusBadge({ status }) {
    const tone = getStatusTone(status);

    return (
        <span className={`status-badge status-badge--${tone}`}>
            <span className="status-dot" aria-hidden="true" />
            {getWorkflowStatusLabel(status)}
        </span>
    );
}
