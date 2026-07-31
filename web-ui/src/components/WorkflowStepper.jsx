const stages = [
    {
        id: "upload",
        label: "Upload",
        icon: (
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        )
    },
    {
        id: "requirement-review",
        label: "Review",
        icon: (
            <>
                <circle cx="10.5" cy="10.5" r="5.5" />
                <path d="m15 15 5 5" />
            </>
        )
    },
    {
        id: "testcase-review",
        label: "Test Cases",
        icon: (
            <>
                <path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 17l-5-9V3" />
                <path d="M8 14h8" />
            </>
        )
    },
    {
        id: "completed",
        label: "Export",
        icon: (
            <>
                <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
                <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
            </>
        )
    }
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

export default function WorkflowStepper({ className = "" }) {
    return (
        <ol
            className={`workflow-process ${className}`.trim()}
            aria-label="Quy trình AI Test Design"
        >
            {stages.map(stage => (
                <li className="workflow-process__stage" key={stage.id}>
                    <span className="workflow-process__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                            {stage.icon}
                        </svg>
                    </span>
                    <strong>{stage.label}</strong>
                </li>
            ))}
        </ol>
    );
}
