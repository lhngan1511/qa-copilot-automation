import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorState from "./ErrorState.jsx";
import LoadingState from "./LoadingState.jsx";
import ClarificationQuestionCard from "./ClarificationQuestionCard.jsx";
import {
    useAIAnalysisReview,
    useApproveAIAnalysis,
    useResumeWorkflow,
    useSaveClarifications
} from "../hooks/useAIAnalysisReview.js";
import {
    buildClarificationUpdates,
    validateClarificationAnswers
} from "../utils/aiAnalysisReview.js";

function initialAnswers(review) {
    return Object.fromEntries(
        review.clarifications.map(item => [
            item.id,
            typeof item.answer === "string" ? item.answer : ""
        ])
    );
}

function firstQuestionIndex(review) {
    const index = review.clarifications.findIndex(item => !String(item.answer ?? "").trim());
    return index === -1 ? review.clarifications.length : index;
}

function InteractiveReview({ workflowId, review }) {
    const navigate = useNavigate();
    const errorSummaryRef = useRef(null);
    const artifactRef = useRef(review.artifactId);
    const saveAnswers = useSaveClarifications(workflowId);
    const approve = useApproveAIAnalysis(workflowId);
    const resume = useResumeWorkflow(workflowId);
    const [answers, setAnswers] = useState(() => initialAnswers(review));
    const [answerErrors, setAnswerErrors] = useState({});
    const [questionIndex, setQuestionIndex] = useState(() => firstQuestionIndex(review));
    const [notice, setNotice] = useState("");

    useEffect(() => {
        if (artifactRef.current !== review.artifactId) {
            artifactRef.current = review.artifactId;
            setAnswers(initialAnswers(review));
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
    const pending = saveAnswers.isPending || approve.isPending || resume.isPending;
    const totalQuestions = review.clarifications.length;
    const currentQuestion = review.clarifications[questionIndex] ?? null;
    const answeredCount = review.clarifications.filter(item =>
        String(answers[item.id] ?? "").trim()
    ).length;

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

    const confirmRequirementAndGenerate = async () => {
        if (pending) return;
        const errors = validateClarificationAnswers(review.clarifications, answers);
        setAnswerErrors(errors);
        if (Object.keys(errors).length > 0) {
            const firstInvalid = review.clarifications.findIndex(item => errors[item.id]);
            if (firstInvalid >= 0) setQuestionIndex(firstInvalid);
            errorSummaryRef.current?.focus();
            return;
        }
        if (!window.confirm("Xác nhận requirement và bắt đầu tạo test case?")) return;

        setNotice("");
        try {
            if (answerUpdates.length > 0) await saveAnswers.mutateAsync(answerUpdates);
            if (!review.allowedActions.includes("RESUME_WORKFLOW")) {
                await approve.mutateAsync({ artifactId: review.artifactId });
            }
            const result = await resume.mutateAsync();
            navigate(`/workflows/${encodeURIComponent(result.workflowId)}`, { replace: true });
        } catch {
            setNotice("");
        }
    };

    const mutationError = saveAnswers.error || approve.error || resume.error;

    return (
        <div className="requirement-review">
            <header className="requirement-review__header">
                <div>
                    <h2>Requirement Review</h2>
                    <p>
                        AI đã phân tích requirement và đặt câu hỏi. Vui lòng xác nhận để tiếp tục.
                    </p>
                </div>
                <div
                    className="requirement-review__progress"
                    aria-label={`${answeredCount} trên ${totalQuestions} câu hỏi đã trả lời`}
                >
                    <strong>
                        {answeredCount} / {totalQuestions} câu hỏi
                    </strong>
                    <span>
                        <span
                            style={{
                                width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 100}%`
                            }}
                        />
                    </span>
                </div>
            </header>

            {mutationError && (
                <div className="inline-alert" role="alert">
                    <strong>Không thể hoàn tất thao tác</strong>
                    <span>{mutationError.message}</span>
                    {mutationError.code && <small>Mã lỗi: {mutationError.code}</small>}
                </div>
            )}
            {notice && <div className="success-notice">{notice}</div>}

            {currentQuestion ? (
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
                    <nav
                        className="requirement-question-navigation"
                        aria-label="Điều hướng câu hỏi"
                    >
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
                <section className="requirement-confirmation-card">
                    <span className="requirement-confirmation-card__icon" aria-hidden="true">
                        ✓
                    </span>
                    <h3>Sẵn sàng tạo test case</h3>
                    <p>
                        Tester đã hoàn tất câu hỏi clarification. Hãy xác nhận requirement để hệ
                        thống tạo test case cho bước review tiếp theo.
                    </p>
                    <div
                        ref={errorSummaryRef}
                        className="visually-hidden"
                        role="alert"
                        tabIndex="-1"
                    >
                        Vui lòng hoàn tất các câu hỏi bắt buộc.
                    </div>
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
                    <button
                        className="button button--primary"
                        type="button"
                        disabled={pending || answeredCount < totalQuestions}
                        onClick={confirmRequirementAndGenerate}
                    >
                        {pending ? "Đang tạo test case..." : "Xác nhận Requirement & tạo testcase"}
                    </button>
                </section>
            )}

            <p className="requirement-review__privacy-note">
                Mọi xác nhận của bạn sẽ được lưu để tạo test case chính xác hơn.
            </p>
        </div>
    );
}

export default function AIAnalysisReviewPanel({ workflow }) {
    const enabled =
        workflow.status === "AI_ANALYSIS_REVIEW_REQUIRED" || workflow.step === "AI_ANALYSIS_REVIEW";
    const query = useAIAnalysisReview(workflow.id, enabled);

    if (query.isPending) return <LoadingState message="Đang tải Requirement Review..." />;
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
