const answerOptions = [
    "Đồng ý, đúng như vậy",
    "Không đúng / Requirement không nói",
    "Requirement chưa rõ, cần AI làm rõ thêm"
];

export default function ClarificationQuestionCard({
    clarification,
    questionNumber,
    value,
    error,
    disabled,
    onChange
}) {
    const errorId = `clarification-${clarification.id}-error`;
    const reasonId = clarification.reason ? `clarification-${clarification.id}-reason` : undefined;

    return (
        <article className="requirement-question-card" aria-labelledby={`clarification-${clarification.id}-title`}>
            <span className="requirement-question-card__badge">✦ Câu hỏi {questionNumber}</span>

            <div className="requirement-question-card__finding">
                <span className="requirement-question-card__avatar" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <rect x="4" y="7" width="16" height="12" rx="5" />
                        <path d="M12 7V4m-2 0h4M8.5 12h.01M15.5 12h.01M9 16h6" />
                    </svg>
                </span>
                <span>
                    <strong>AI nhận thấy</strong>
                    <p>{clarification.question}</p>
                </span>
            </div>

            <fieldset
                className="requirement-question-card__answers"
                aria-describedby={[reasonId, error ? errorId : null].filter(Boolean).join(" ") || undefined}
                disabled={disabled}
            >
                <legend id={`clarification-${clarification.id}-title`}>
                    Bạn xác nhận thông tin này?
                </legend>
                {answerOptions.map(option => (
                    <label
                        className={`requirement-answer-option ${value === option ? "requirement-answer-option--selected" : ""}`}
                        key={option}
                    >
                        <input
                            type="radio"
                            name={`clarification-${clarification.id}`}
                            value={option}
                            checked={value === option}
                            onChange={() => onChange(option)}
                        />
                        <span>{option}</span>
                    </label>
                ))}
            </fieldset>

            {clarification.reason && (
                <aside id={reasonId} className="requirement-question-reason">
                    <span aria-hidden="true">i</span>
                    <div>
                        <strong>Vì sao AI hỏi câu này?</strong>
                        <p>{clarification.reason}</p>
                    </div>
                </aside>
            )}

            {error && (
                <p id={errorId} className="field-error" role="alert">
                    {error}
                </p>
            )}
        </article>
    );
}
