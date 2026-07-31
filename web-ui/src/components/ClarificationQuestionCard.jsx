const NOT_SPECIFIED = "Requirement không đề cập";

function questionPrompt(type) {
    if (type === "FREE_TEXT") return "Vui lòng cung cấp thông tin";
    if (type === "CONFIRM_ASSUMPTION") return "Bạn xác nhận giả định này?";
    if (type === "SINGLE_CHOICE") return "Vui lòng chọn một phương án";
    return "Vui lòng chọn câu trả lời";
}

export default function ClarificationQuestionCard({
    clarification,
    questionNumber,
    value,
    error,
    disabled,
    onChange
}) {
    const errorId = `clarification-${clarification.id}-error`;
    const inputId = `clarification-${clarification.id}`;
    const reasonId = clarification.reason ? `clarification-${clarification.id}-reason` : undefined;
    const options = [...(clarification.options ?? [])];
    if (
        clarification.allowNotSpecified &&
        clarification.type !== "FREE_TEXT" &&
        !options.includes(NOT_SPECIFIED)
    ) {
        options.push(NOT_SPECIFIED);
    }

    return (
        <article className="requirement-question-card" aria-labelledby={`${inputId}-title`}>
            <span className="requirement-question-card__badge">✦ Câu hỏi {questionNumber}</span>

            <div className="requirement-question-card__finding">
                <span className="requirement-question-card__avatar" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <rect x="4" y="7" width="16" height="12" rx="5" />
                        <path d="M12 7V4m-2 0h4M8.5 12h.01M15.5 12h.01M9 16h6" />
                    </svg>
                </span>
                <span>
                    <strong>Thông tin cần làm rõ</strong>
                    <p>{clarification.question}</p>
                </span>
            </div>

            {clarification.type === "FREE_TEXT" ? (
                <div className="requirement-question-card__free-text">
                    <label id={`${inputId}-title`} htmlFor={inputId}>
                        {questionPrompt(clarification.type)}
                    </label>
                    <textarea
                        id={inputId}
                        rows="4"
                        value={value}
                        disabled={disabled}
                        aria-describedby={
                            [reasonId, error ? errorId : null].filter(Boolean).join(" ") ||
                            undefined
                        }
                        placeholder="Nhập câu trả lời cụ thể..."
                        onChange={event => onChange(event.target.value)}
                    />
                    {clarification.allowNotSpecified && (
                        <button
                            className="button button--secondary"
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(NOT_SPECIFIED)}
                        >
                            Requirement không đề cập
                        </button>
                    )}
                </div>
            ) : (
                <fieldset
                    className="requirement-question-card__answers"
                    aria-describedby={
                        [reasonId, error ? errorId : null].filter(Boolean).join(" ") || undefined
                    }
                    disabled={disabled}
                >
                    <legend id={`${inputId}-title`}>{questionPrompt(clarification.type)}</legend>
                    {options.map(option => (
                        <label
                            className={`requirement-answer-option ${value === option ? "requirement-answer-option--selected" : ""}`}
                            key={option}
                        >
                            <input
                                type="radio"
                                name={inputId}
                                value={option}
                                checked={value === option}
                                onChange={() => onChange(option)}
                            />
                            <span>{option}</span>
                        </label>
                    ))}
                </fieldset>
            )}

            {clarification.reason && (
                <aside id={reasonId} className="requirement-question-reason">
                    <span aria-hidden="true">i</span>
                    <div>
                        <strong>Vì sao cần thông tin này?</strong>
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
