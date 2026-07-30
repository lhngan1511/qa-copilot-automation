import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorState from "./ErrorState.jsx";
import LoadingState from "./LoadingState.jsx";
import ClarificationQuestionCard from "./ClarificationQuestionCard.jsx";
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

function initialAnswers(review) {
    return Object.fromEntries(
        review.clarifications.map(item => [item.id, typeof item.answer === "string" ? item.answer : ""])
    );
}

function firstQuestionIndex(review) {
    const index = review.clarifications.findIndex(item => !String(item.answer ?? "").trim());
    return index === -1 ? review.clarifications.length : index;
}

function AnalysisReview({ review, purpose, disabled, dirty, onPurposeChange, onSave }) {
    return (
        <section className="requirement-analysis-card" aria-labelledby="requirement-analysis-title">
            <header>
                <div>
                    <p className="eyebrow">Tester review</p>
                    <h3 id="requirement-analysis-title">Review kết quả phân tích</h3>
                    <p>Kiểm tra nội dung AI đề xuất trước khi phê duyệt và tiếp tục workflow.</p>
                </div>
                <span className="status-badge status-badge--warning">{review.approvalStatus}</span>
            </header>

            <dl className="requirement-analysis-card__meta">
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
                rows="4"
                value={purpose}
                disabled={disabled}
                onChange={event => onPurposeChange(event.target.value)}
            />
            {!purpose.trim() && (
                <p className="field-error">Mục đích phân tích không được để trống.</p>
            )}
            <button
                className="button button--secondary"
                type="button"
                disabled={disabled || !dirty || !purpose.trim()}
                onClick={onSave}
            >
                Lưu nội dung phân tích
            </button>

            <div className="requirement-analysis-card__functions">
                {review.analysis.functions.map((item, index) => (
                    <article className="function-card" key={`${item.name}-${index}`}>
                        <h5>{item.name || `Chức năng ${index + 1}`}</h5>
                        {item.description && <p>{item.description}</p>}
                        <AnalysisList title="Business Rules" values={item.businessRules} />
                        <AnalysisList title="Validation Rules" values={item.validationRules} />
                        <AnalysisList title="Permissions" values={item.permissions} />
                    </article>
                ))}
            </div>
            <AnalysisList title="Risks" values={review.analysis.risks} />
        </section>
    );
}

function InteractiveReview({ workflowId, review }) {
    const navigate = useNavigate();
    const errorSummaryRef = useRef(null);
    const artifactRef = useRef(review.artifactId);
    const saveAnswers = useSaveClarifications(workflowId);
    const saveAnalysis = useUpdateAIAnalysis(workflowId);
    const approve = useApproveAIAnalysis(workflowId);
    const resume = useResumeWorkflow(workflowId);
    const [answers, setAnswers] = useState(() => initialAnswers(review));
    const [answerErrors, setAnswerErrors] = useState({});
    const [purpose, setPurpose] = useState(review.analysis.purpose);
    const [questionIndex, setQuestionIndex] = useState(() => firstQuestionIndex(review));
    const [notice, setNotice] = useState("");

    useEffect(() => {
        if (artifactRef.current !== review.artifactId) {
            artifactRef.current = review.artifactId;
            setAnswers(initialAnswers(review));
            setPurpose(review.analysis.purpose);
            setQuestionIndex(firstQuestionIndex(review));
            setAnswerErrors({});
            return;
        }

        setAnswers(current =>
            Object.fromEntries(
                review.clarifications.map(item => [
                    item.id,
                    current[item.id] !== undefined ? current[item.id] : (item.answer ?? "")
                ])
            )
        );
        setQuestionIndex(current => Math.min(current, review.clarifications.length));
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
    const totalQuestions = review.clarifications.length;
    const currentQuestion = review.clarifications[questionIndex] ?? null;
    const answeredCount = review.clarifications.filter(item =>
        String(answers[item.id] ?? "").trim()
    ).length;
    const reviewingQuestions = currentQuestion !== null;

    const saveAllAnswers = async () => {
        if (pending || answerUpdates.length === 0) return;
        setNotice("");
        try {
            await saveAnswers.mutateAsync(answerUpdates);
            setNotice("Đã lưu câu trả lời của tester.");
        } catch {
            setNotice("");
        }
    };

    const saveCurrentAndContinue = async () => {
        if (!currentQuestion || pending) return;
        const value = String(answers[currentQuestion.id] ?? "").trim();
        if (currentQuestion.required && !value) {
            setAnswerErrors(current => ({
                ...current,
                [currentQuestion.id]: "Vui lòng chọn một câu trả lời trước khi tiếp tục."
            }));
            return;
        }

        const original = String(currentQuestion.answer ?? "").trim();
        setNotice("");
        try {
            if (value && value !== original) {
                await saveAnswers.mutateAsync([
                    { questionId: currentQuestion.id, answer: value, changed: true }
                ]);
            }
            setQuestionIndex(index => Math.min(index + 1, totalQuestions));
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
            setNotice("Đã lưu nội dung phân tích.");
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
            await approve.mutateAsync({ artifactId: review.artifactId });
            setNotice("Requirement Review đã được phê duyệt. Tester có thể tiếp tục workflow.");
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
        <div className="requirement-review">
            <header className="requirement-review__header">
                <div>
                    <h2>Requirement Review</h2>
                    <p>
                        AI đã phân tích requirement và đặt câu hỏi. Vui lòng xác nhận để tiếp tục.
                    </p>
                </div>
                <div className="requirement-review__progress" aria-label={`${answeredCount} trên ${totalQuestions} câu hỏi đã trả lời`}>
                    <strong>{answeredCount} / {totalQuestions} câu hỏi</strong>
                    <span>
                        <span
                            style={{
                                width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 100}%`
                            }}
                        />
                    </span>
                </div>
            </header>

            {Object.keys(answerErrors).length > 0 && !reviewingQuestions && (
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

            {reviewingQuestions ? (
                <>
                    <ClarificationQuestionCard
                        clarification={currentQuestion}
                        questionNumber={questionIndex + 1}
                        value={answers[currentQuestion.id] ?? ""}
                        error={answerErrors[currentQuestion.id]}
                        disabled={pending || review.approvalStatus !== "pending"}
                        onChange={value => {
                            setAnswers(current => ({ ...current, [currentQuestion.id]: value }));
                            setAnswerErrors(current => {
                                const next = { ...current };
                                delete next[currentQuestion.id];
                                return next;
                            });
                        }}
                    />

                    <nav className="requirement-question-navigation" aria-label="Điều hướng câu hỏi">
                        <button
                            className="button button--secondary"
                            type="button"
                            disabled={questionIndex === 0 || pending}
                            onClick={() => setQuestionIndex(index => Math.max(0, index - 1))}
                        >
                            ← Trước đó
                        </button>
                        <div>
                            <button
                                className="button button--secondary"
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                    setQuestionIndex(index => Math.min(index + 1, totalQuestions))
                                }
                            >
                                Bỏ qua
                            </button>
                            <button
                                className="button button--primary"
                                type="button"
                                disabled={pending}
                                onClick={saveCurrentAndContinue}
                            >
                                {saveAnswers.isPending ? "Đang lưu..." : "Tiếp theo →"}
                            </button>
                        </div>
                    </nav>
                </>
            ) : (
                <>
                    <AnalysisReview
                        review={review}
                        purpose={purpose}
                        dirty={analysisDirty}
                        disabled={pending || review.approvalStatus !== "pending"}
                        onPurposeChange={setPurpose}
                        onSave={saveAnalysisPurpose}
                    />

                    <div className="requirement-review__completion-actions">
                        <div>
                            {totalQuestions > 0 && (
                                <button
                                    className="button button--secondary"
                                    type="button"
                                    disabled={pending}
                                    onClick={() => setQuestionIndex(totalQuestions - 1)}
                                >
                                    ← Xem lại câu hỏi
                                </button>
                            )}
                            {answerUpdates.length > 0 && (
                                <button
                                    className="button button--secondary"
                                    type="button"
                                    disabled={pending}
                                    onClick={saveAllAnswers}
                                >
                                    {saveAnswers.isPending ? "Đang lưu..." : "Lưu câu trả lời"}
                                </button>
                            )}
                        </div>
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
                                {approve.isPending ? "Đang phê duyệt..." : "Phê duyệt Requirement Review"}
                            </button>
                        )}
                    </div>
                </>
            )}

            <p className="requirement-review__privacy-note">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="6" y="10" width="12" height="10" rx="2" />
                    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
                </svg>
                Mọi xác nhận của bạn sẽ được lưu và sử dụng để sinh test case chính xác hơn.
            </p>
        </div>
    );
}

export default function AIAnalysisReviewPanel({ workflow }) {
    const enabled =
        workflow.status === "AI_ANALYSIS_REVIEW_REQUIRED" ||
        workflow.step === "AI_ANALYSIS_REVIEW";
    const query = useAIAnalysisReview(workflow.id, enabled);

    if (query.isPending) {
        return <LoadingState message="Đang tải Requirement Review..." />;
    }
    if (query.isError) {
        return (
            <ErrorState
                title="Không thể tải Requirement Review"
                error={query.error}
                onRetry={() => query.refetch()}
            />
        );
    }

    return <InteractiveReview workflowId={workflow.id} review={query.data} />;
}
