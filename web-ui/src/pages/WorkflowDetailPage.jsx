import { Link, useParams } from "react-router-dom";
import AIAnalysisReviewPanel from "../components/AIAnalysisReviewPanel.jsx";
import TestCaseReviewPanel from "../components/TestCaseReviewPanel.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import WorkflowStatusBadge from "../components/WorkflowStatusBadge.jsx";
import useWorkflow from "../hooks/useWorkflow.js";
import formatDate from "../utils/formatDate.js";
import { getWorkflowActionLabel, getWorkflowStepLabel } from "../utils/workflowLabels.js";

function SummaryCard({ value, label, detail }) {
    return (
        <div className="summary-card">
            <strong>{value}</strong>
            <span>{label}</span>
            {detail && <small>{detail}</small>}
        </div>
    );
}

export default function WorkflowDetailPage() {
    const { workflowId } = useParams();
    const query = useWorkflow(workflowId);

    if (query.isPending) {
        return <LoadingState message="Đang tải chi tiết workflow..." />;
    }

    if (query.isError) {
        return (
            <section className="page">
                <Link className="back-link" to="/">
                    ← Quay lại Workflows
                </Link>
                <ErrorState
                    title={query.error?.status === 404 ? "Không tìm thấy workflow" : undefined}
                    error={query.error}
                    onRetry={() => query.refetch()}
                />
            </section>
        );
    }

    const workflow = query.data;
    const isRequirementReview =
        workflow.status === "AI_ANALYSIS_REVIEW_REQUIRED" ||
        workflow.step === "AI_ANALYSIS_REVIEW";

    if (isRequirementReview) {
        return (
            <section className="page requirement-review-page">
                <AIAnalysisReviewPanel workflow={workflow} />
            </section>
        );
    }

    const clarification = workflow?.clarification ?? {};
    const testCases = workflow?.testCases ?? {};
    const actions = workflow?.allowedActions ?? [];
    const artifacts = workflow?.artifacts ?? [];
    const exports = workflow?.exports ?? [];

    return (
        <section className="page">
            <Link className="back-link" to="/">
                ← Quay lại Workflows
            </Link>

            <div className="detail-heading">
                <div>
                    <p className="workflow-id">{workflow.id}</p>
                    <h2>{workflow.name || workflow.id}</h2>
                    <p>
                        Bước hiện tại: <strong>{getWorkflowStepLabel(workflow.step)}</strong>
                    </p>
                </div>
                <WorkflowStatusBadge status={workflow.status} />
            </div>

            <div className="summary-grid">
                <SummaryCard
                    value={`${clarification.answered ?? 0}/${clarification.total ?? 0}`}
                    label="Clarification đã trả lời"
                    detail={`${clarification.remaining ?? 0} câu hỏi còn lại`}
                />
                <SummaryCard
                    value={testCases.total ?? 0}
                    label="Testcase"
                    detail={`${testCases.approved ?? 0} đã duyệt`}
                />
                <SummaryCard
                    value={testCases.requiresTesterInput ?? 0}
                    label="Cần tester nhập data"
                />
                <SummaryCard
                    value={exports.length}
                    label="Output khả dụng"
                    detail={`${artifacts.length} artifact`}
                />
            </div>

            {(workflow.status === "TEST_CASE_REVIEW_REQUIRED" ||
                workflow.step === "TEST_CASE_REVIEW") && (
                <TestCaseReviewPanel workflow={workflow} />
            )}

            {workflow.isBlocking && (
                <section className="detail-panel detail-panel--warning">
                    <div className="panel-heading">
                        <h3>Workflow đang chờ</h3>
                        <span>{workflow.blockingReasons?.length ?? 0} lý do</span>
                    </div>
                    <ul className="reason-list">
                        {(workflow.blockingReasons ?? []).map(reason => (
                            <li key={`${reason.code}-${reason.message}`}>
                                <strong>{reason.code}</strong>
                                <span>{reason.message}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="detail-columns">
                <section className="detail-panel">
                    <div className="panel-heading">
                        <h3>Actions được phép</h3>
                        <span>Read-only</span>
                    </div>
                    {actions.length > 0 ? (
                        <div className="action-list">
                            {actions.map(action => (
                                <span className="action-chip" key={action}>
                                    {getWorkflowActionLabel(action)}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="muted-copy">Không có action khả dụng.</p>
                    )}
                </section>

                <section className="detail-panel">
                    <div className="panel-heading">
                        <h3>Artifact & export</h3>
                        {workflow.revision !== null && <span>Revision {workflow.revision}</span>}
                    </div>
                    <dl className="detail-list">
                        <div>
                            <dt>Artifacts</dt>
                            <dd>{artifacts.length}</dd>
                        </div>
                        <div>
                            <dt>Exports</dt>
                            <dd>
                                {exports.length
                                    ? exports.map(output => output.format).join(", ")
                                    : "Chưa có"}
                            </dd>
                        </div>
                        <div>
                            <dt>Cập nhật</dt>
                            <dd>{formatDate(workflow.timestamps?.updatedAt)}</dd>
                        </div>
                    </dl>
                </section>
            </div>

            {false && (
                <aside className="coming-soon-panel">
                    <div className="coming-soon-panel__mark">Next</div>
                    <div>
                        <h3>Review workspace</h3>
                        <p>Sẽ được triển khai ở bước tiếp theo. Trang này hiện chỉ đọc.</p>
                    </div>
                </aside>
            )}
        </section>
    );
}
