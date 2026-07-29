export default function ClarificationQuestionCard({
    clarification,
    value,
    error,
    disabled,
    onChange
}) {
    const answered = clarification.status === "ANSWERED";
    const errorId = `clarification-${clarification.id}-error`;

    return (
        <article className="clarification-card">
            <div className="clarification-card__heading">
                <div>
                    <span className="question-priority">{clarification.priority}</span>
                    <span>{clarification.category}</span>
                </div>
                <span className={`answer-status ${answered ? "answer-status--answered" : ""}`}>
                    {answered ? "Answered" : "Unanswered"}
                </span>
            </div>

            <label htmlFor={`clarification-${clarification.id}`}>
                <strong>{clarification.question}</strong>
                <span className="required-label">
                    {clarification.required ? "Bắt buộc" : "Không bắt buộc"}
                </span>
            </label>

            {clarification.reason && <p className="question-reason">{clarification.reason}</p>}

            <textarea
                id={`clarification-${clarification.id}`}
                rows="4"
                value={value}
                disabled={disabled}
                aria-describedby={error ? errorId : undefined}
                onChange={event => onChange(event.target.value)}
                placeholder="Nhập câu trả lời của tester..."
            />

            {clarification.options.length > 0 && (
                <div className="answer-options" aria-label="Gợi ý lựa chọn">
                    {clarification.options.map(option => (
                        <button
                            key={option}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(option)}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <p id={errorId} className="field-error" role="alert">
                    {error}
                </p>
            )}
        </article>
    );
}
