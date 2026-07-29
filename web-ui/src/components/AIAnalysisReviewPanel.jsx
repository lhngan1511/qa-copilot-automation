import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorState from "./ErrorState.jsx";
import LoadingState from "./LoadingState.jsx";
import ClarificationQuestionCard from "./ClarificationQuestionCard.jsx";
import WorkflowStatusBadge from "./WorkflowStatusBadge.jsx";
import {
    useAIAnalysisReview,
    useApproveAIAnalysis,
    useResumeWorkflow,
    useSaveClarifications,
    useUpdateAIAnalysis
} from "../hooks/useAIAnalysisReview.js";
import {
    buildClarificationUpdates,
    canApproveAIAnalysis,
    validateClarificationAnswers
} from "../utils/aiAnalysisReview.js";

function AnalysisList({ title, values }) {
    if (!values?.length) return null;

    return (
        <section className="analysis-group">
            <h5>{title}</h5>
            <ul>
                {values.map((value, index) => (
                    <li key={`${title}-${index}`}>{value}</li>
                ))}
            </ul>
        </section>
    );
}

function InteractiveReview({ workflowId, review }) {
    const navigate = useNavigate();
    const errorSummaryRef = useRef(null);
    const saveAnswers = useSaveClarifications(workflowId);
    const saveAnalysis = useUpdateAIAnalysis(workflowId);
    const approve = useApproveAIAnalysis(workflowId);
    const resume = useResumeWorkflow(workflowId);
    const [answers, setAnswers] = useState({});
    const [answerErrors, setAnswerErrors] = useState({});
    const [purpose, setPurpose] = useState(review.analysis.purpose);
    const [notice, setNotice] = useState("");

    useEffect(() => {
        setAnswers(
            Object.fromEntries(review.clarifications.map(item => [item.id, item.answer ?? ""]))
        );
        setPurpose(review.analysis.purpose);
        setAnswerErrors({});
    }, [review]);

    const answerUpdates = useMemo(
        () => buildClarificationUpdates(review.clarifications, answers),
        [answers, review.clarifications]
    );
    const analysisDirty = purpose.trim() !== review.analysis.purpose.trim();
    const pending =
        saveAnswers.isPending || saveAnalysis.isPending || approve.isPending || resume.isPending;
    const approvalEnabled = canApproveAIAnalysis({
        review,
        answers,
        analysisDirty,
        pending
    });

    const saveClarificationAnswers = async () => {
        if (pending || answerUpdates.length === 0) return;
        setNotice("");

        try {
            await saveAnswers.mutateAsync(answerUpdates);
            setNotice("Đã lưu câu trả lời.");
        } catch {
            setNotice("");
        }
    };

    const saveAnalysisPurpose = async () => {
        if (pending || !analysisDirty || !purpose.trim()) return;
        setNotice("");

        try {
            await saveAnalysis.mutateAsync({
                artifactId: review.artifactId,
                analysis: { purpose }
            });
            setNotice("Đã lưu nội dung analysis.");
        } catch {
            setNotice("");
        }
    };

    const approveReview = async () => {
        const errors = validateClarificationAnswers(review.clarifications, answers);
        setAnswerErrors(errors);
        if (Object.keys(errors).length > 0) {
            errorSummaryRef.current?.focus();
            return;
        }
        if (
            !approvalEnabled ||
            !window.confirm("Xác nhận dùng kết quả đã review để tiếp tục sinh testcase?")
        ) {
            return;
        }

        setNotice("");
        try {
            await approve.mutateAsync({
                artifactId: review.artifactId
            });
            setNotice("AI Analysis Review đã được phê duyệt. Chọn Tiếp tục để sinh testcase.");
        } catch {
            setNotice("");
        }
    };

    const continueWorkflow = async () => {
        if (pending || !review.allowedActions.includes("RESUME_WORKFLOW")) return;
        setNotice("");

        try {
            const result = await resume.mutateAsync();
            navigate(`/workflows/${encodeURIComponent(result.workflowId)}`);
        } catch {
            setNotice("");
        }
    };

    const mutationError = saveAnswers.error || saveAnalysis.error || approve.error || resume.error;

    return (
        <section className="review-workspace">
            <div className="review-workspace__header">
                <div>
                    <p className="eyebrow">Review workspace</p>
                    <h3>Review phân tích AI</h3>
                    <p>
                        Trả lời clarification, kiểm tra nội dung analysis rồi phê duyệt. Workflow
                        chỉ tiếp tục khi tester bấm action tương ứng.
                    </p>
                </div>
                <WorkflowStatusBadge status={review.status} />
            </div>

            <div className="review-workspace__summary">
                <div>
                    <strong>{review.summary.total}</strong>
                    <span>Tổng câu hỏi</span>
                </div>
                <div>
                    <strong>{review.summary.answered}</strong>
                    <span>Đã trả lời</span>
                </div>
                <div>
                    <strong>{review.summary.remaining}</strong>
                    <span>Còn lại</span>
                </div>
            </div>

            {Object.keys(answerErrors).length > 0 && (
                <div ref={errorSummaryRef} className="inline-alert" role="alert" tabIndex="-1">
                    <strong>Chưa thể phê duyệt</strong>
                    <span>Vui lòng trả lời đầy đủ các câu hỏi bắt buộc.</span>
                </div>
            )}

            {mutationError && (
                <div className="inline-alert" role="alert">
                    <strong>Không thể hoàn tất thao tác</strong>
                    <span>
                        {mutationError.status === 409
                            ? "Dữ liệu review đã thay đổi hoặc action không còn hợp lệ. Trạng thái máy chủ đã được tải lại."
                            : mutationError.message}
                    </span>
                    {mutationError.code && <small>Mã lỗi: {mutationError.code}</small>}
                </div>
            )}

            {notice && (
                <div className="success-notice" role="status" aria-live="polite">
                    {notice}
                </div>
            )}

            <div className="review-workspace__columns">
                <section className="review-column">
                    <div className="review-column__heading">
                        <h4>Clarification Questions</h4>
                        <span>{review.summary.remaining} chưa trả lời</span>
                    </div>
                    {review.clarifications.length === 0 ? (
                        <p className="muted-copy">Không có clarification question.</p>
                    ) : (
                        <div className="clarification-list">
                            {review.clarifications.map(item => (
                                <ClarificationQuestionCard
                                    key={item.id}
                                    clarification={item}
                                    value={answers[item.id] ?? ""}
                                    error={answerErrors[item.id]}
                                    disabled={pending || review.approvalStatus !== "pending"}
                                    onChange={value => {
                                        setAnswers(current => ({
                                            ...current,
                                            [item.id]: value
                                        }));
                                        setAnswerErrors(current => ({
                                            ...current,
                                            [item.id]: undefined
                                        }));
                                    }}
                                />
                            ))}
                        </div>
                    )}
                    <button
                        className="button button--secondary"
                        type="button"
                        disabled={
                            pending ||
                            answerUpdates.length === 0 ||
                            review.approvalStatus !== "pending"
                        }
                        onClick={saveClarificationAnswers}
                    >
                        {saveAnswers.isPending ? "Đang lưu..." : "Lưu câu trả lời"}
                    </button>
                </section>

                <section className="review-column">
                    <div className="review-column__heading">
                        <h4>AI Analysis</h4>
                        {review.analysis.source && <span>{review.analysis.source}</span>}
                    </div>
                    <dl className="analysis-meta">
                        <div>
                            <dt>Module</dt>
                            <dd>{review.analysis.module || "Chưa xác định"}</dd>
                        </div>
                        <div>
                            <dt>Requirement complete</dt>
                            <dd>{review.analysis.requirementComplete ? "Có" : "Chưa"}</dd>
                        </div>
                    </dl>

                    <label className="field-label" htmlFor="analysis-purpose">
                        Mục đích phân tích
                    </label>
                    <textarea
                        id="analysis-purpose"
                        rows="5"
                        value={purpose}
                        disabled={pending || review.approvalStatus !== "pending"}
                        onChange={event => setPurpose(event.target.value)}
                    />
                    {!purpose.trim() && (
                        <p className="field-error">Mục đích phân tích không được để trống.</p>
                    )}
                    <button
                        className="button button--secondary"
                        type="button"
                        disabled={
                            pending ||
                            !analysisDirty ||
                            !purpose.trim() ||
                            review.approvalStatus !== "pending"
                        }
                        onClick={saveAnalysisPurpose}
                    >
                        {saveAnalysis.isPending ? "Đang lưu..." : "Lưu analysis"}
                    </button>

                    <div className="function-list">
                        {review.analysis.functions.map((item, index) => (
                            <article className="function-card" key={`${item.name}-${index}`}>
                                <h5>{item.name || `Chức năng ${index + 1}`}</h5>
                                {item.description && <p>{item.description}</p>}
                                <AnalysisList title="Business Rules" values={item.businessRules} />
                                <AnalysisList
                                    title="Validation Rules"
                                    values={item.validationRules}
                                />
                                <AnalysisList title="Permissions" values={item.permissions} />
                            </article>
                        ))}
                    </div>
                    <AnalysisList title="Risks" values={review.analysis.risks} />
                </section>
            </div>

            <div className="review-action-bar">
                <div>
                    <strong>Review gate</strong>
                    <span>
                        {review.allowedActions.includes("RESUME_WORKFLOW")
                            ? "Đã approve. Workflow đang chờ tester tiếp tục."
                            : `${review.summary.remaining} câu hỏi còn lại.`}
                    </span>
                </div>
                <div>
                    {review.allowedActions.includes("RESUME_WORKFLOW") ? (
                        <button
                            className="button button--primary"
                            type="button"
                            disabled={pending}
                            onClick={continueWorkflow}
                        >
                            {resume.isPending ? "Đang tiếp tục..." : "Tiếp tục sinh testcase"}
                        </button>
                    ) : (
                        <button
                            className="button button--primary"
                            type="button"
                            disabled={!approvalEnabled}
                            onClick={approveReview}
                        >
                            {approve.isPending ? "Đang phê duyệt..." : "Approve AI Analysis"}
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}

export default function AIAnalysisReviewPanel({ workflow }) {
    const query = useAIAnalysisReview(workflow.id, workflow.step === "AI_ANALYSIS_REVIEW");

    if (query.isPending) {
        return <LoadingState message="Đang tải AI Analysis Review..." />;
    }
    if (query.isError) {
        return (
            <ErrorState
                title="Không thể tải AI Analysis Review"
                error={query.error}
                onRetry={() => query.refetch()}
            />
        );
    }

    return (
        <InteractiveReview
            key={`${query.data.artifactId}-${query.data.summary.answered}-${query.data.analysis.purpose}-${query.data.allowedActions.join(",")}`}
            workflowId={workflow.id}
            review={query.data}
        />
    );
}
