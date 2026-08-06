/*
 V3WorkspaceStepper — Stepper 5 bước cho Record by Testcase.
 Bước 5A triển khai bước ① Workspace và ② Chọn testcase; ③④⑤ hiển thị khóa.
*/

const STEPS = [
    { n: 1, label: "Workspace" },
    { n: 2, label: "Chọn testcase" },
    { n: 3, label: "Ghi testcase", locked: true },
    { n: 4, label: "Review", locked: true },
    { n: 5, label: "Sinh & chạy", locked: true }
];

export default function V3WorkspaceStepper() {
    return (
        <ol className="v3-stepper" aria-label="Quy trình automation (5 bước)">
            {STEPS.map(step => (
                <li
                    key={step.n}
                    className={[
                        "v3-step",
                        step.n <= 2 ? "v3-step--active" : "",
                        step.locked ? "v3-step--locked" : ""
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    <span className="v3-step__n" aria-hidden="true">
                        {step.n}
                    </span>
                    <strong>{step.label}</strong>
                    {step.locked ? (
                        <span className="v3-step__lock" aria-label="khóa, bước tiếp theo">
                            🔒
                        </span>
                    ) : null}
                </li>
            ))}
        </ol>
    );
}
