const steps = [
    { id: "upload", label: "Upload File", description: "Tải file requirement (.md)" },
    {
        id: "requirement-review",
        label: "Requirement Review",
        description: "Review và xác nhận yêu cầu"
    },
    {
        id: "testcase-review",
        label: "TestCase Review",
        description: "Review và phê duyệt testcase"
    },
    { id: "completed", label: "Completed", description: "Xuất báo cáo & testcase" }
];

export function getVisibleWorkflowStep({ status, step } = {}) {
    if (status === "COMPLETED" || step === "EXPORT") return "completed";
    if (status === "TEST_CASE_REVIEW_REQUIRED" || step === "TEST_CASE_REVIEW") {
        return "testcase-review";
    }
    if (
        status === "AI_ANALYSIS_REVIEW_REQUIRED" ||
        status === "REVIEW_REQUIRED" ||
        step === "AI_ANALYSIS_REVIEW"
    ) {
        return "requirement-review";
    }
    return "upload";
}

export default function WorkflowStepper({ currentStep = "upload", className = "" }) {
    const currentIndex = Math.max(
        0,
        steps.findIndex(item => item.id === currentStep)
    );

    return (
        <ol className={`workflow-stepper ${className}`.trim()} aria-label="Tiến trình AI Test Design">
            {steps.map((item, index) => {
                const state =
                    index < currentIndex
                        ? "complete"
                        : index === currentIndex
                          ? "active"
                          : "upcoming";
                return (
                    <li
                        className={`workflow-stepper__step workflow-stepper__step--${state}`}
                        key={item.id}
                        aria-current={state === "active" ? "step" : undefined}
                    >
                        <span className="workflow-stepper__number" aria-hidden="true">
                            {state === "complete" ? "✓" : index + 1}
                        </span>
                        <span className="workflow-stepper__copy">
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
