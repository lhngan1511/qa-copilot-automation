import TestDataReadinessBadge from "./TestDataReadinessBadge.jsx";
import { testCaseWarnings } from "../utils/testCaseReview.js";

function TextListEditor({ id, label, values, disabled, onChange }) {
    const items = Array.isArray(values) ? values : [];
    return (
        <fieldset className="array-editor" disabled={disabled}>
            <legend>{label}</legend>
            {items.map((value, index) => (
                <div key={`${id}-${index}`}>
                    <input
                        aria-label={`${label} ${index + 1}`}
                        value={typeof value === "string" ? value : (value?.action ?? "")}
                        onChange={event => {
                            const next = [...items];
                            next[index] =
                                typeof value === "string"
                                    ? event.target.value
                                    : { ...value, action: event.target.value };
                            onChange(next);
                        }}
                    />
                    <button
                        className="text-button"
                        type="button"
                        onClick={() =>
                            onChange(items.filter((_, itemIndex) => itemIndex !== index))
                        }
                    >
                        Xóa
                    </button>
                </div>
            ))}
            <button className="text-button" type="button" onClick={() => onChange([...items, ""])}>
                + Thêm
            </button>
        </fieldset>
    );
}

export default function TestCaseEditor({ testCase, disabled, onChange, onRemove }) {
    if (!testCase) {
        return <p className="muted-copy">Chọn một testcase để review.</p>;
    }

    const set = (field, value) => onChange({ ...testCase, [field]: value });
    const warnings = testCaseWarnings(testCase);

    return (
        <div className="testcase-editor">
            <div className="testcase-editor__heading">
                <div>
                    <span className="workflow-id">{testCase.id}</span>
                    <TestDataReadinessBadge status={testCase.executionReadiness} />
                </div>
                {!disabled && (
                    <button className="button button--danger" type="button" onClick={onRemove}>
                        Loại khỏi danh sách review
                    </button>
                )}
            </div>

            {warnings.length > 0 && (
                <div className="editor-warning" role="status">
                    <strong>Lưu ý</strong>
                    <ul>
                        {warnings.map(item => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="editor-grid">
                <label>
                    Module
                    <input
                        disabled={disabled}
                        value={testCase.module ?? ""}
                        onChange={e => set("module", e.target.value)}
                    />
                </label>
                <label>
                    Chức năng
                    <input
                        disabled={disabled}
                        value={testCase.function ?? testCase.feature ?? ""}
                        onChange={e =>
                            set(
                                testCase.function !== undefined ? "function" : "feature",
                                e.target.value
                            )
                        }
                    />
                </label>
                <label>
                    Loại
                    <input
                        disabled={disabled}
                        value={testCase.type ?? ""}
                        onChange={e => set("type", e.target.value)}
                    />
                </label>
                <label>
                    Priority
                    <input
                        disabled={disabled}
                        value={testCase.priority ?? ""}
                        onChange={e => set("priority", e.target.value)}
                    />
                </label>
                <label>
                    Severity
                    <input
                        disabled={disabled}
                        value={testCase.severity ?? ""}
                        onChange={e => set("severity", e.target.value)}
                    />
                </label>
                <label className="checkbox-field">
                    <input
                        type="checkbox"
                        disabled={disabled}
                        checked={testCase.automationCandidate === true}
                        onChange={e => set("automationCandidate", e.target.checked)}
                    />
                    Automation candidate
                </label>
            </div>

            <label>
                Tiêu đề
                <input
                    disabled={disabled}
                    value={testCase.title ?? ""}
                    onChange={e => set("title", e.target.value)}
                />
            </label>
            <label>
                Mục tiêu / scenario
                <textarea
                    disabled={disabled}
                    rows="2"
                    value={
                        testCase.objective ?? testCase.testObjective ?? testCase.testScenario ?? ""
                    }
                    onChange={e =>
                        set(
                            testCase.objective !== undefined ? "objective" : "testObjective",
                            e.target.value
                        )
                    }
                />
            </label>

            <TextListEditor
                id={`${testCase.id}-pre`}
                label="Tiền điều kiện"
                values={testCase.preconditions}
                disabled={disabled}
                onChange={value => set("preconditions", value)}
            />
            <TextListEditor
                id={`${testCase.id}-step`}
                label="Các bước"
                values={testCase.steps}
                disabled={disabled}
                onChange={value => set("steps", value)}
            />

            <fieldset className="testdata-editor" disabled={disabled}>
                <legend>Dữ liệu do tester sở hữu</legend>
                <label>
                    Yêu cầu dữ liệu
                    <textarea
                        rows="2"
                        value={testCase.testData?.requirement ?? ""}
                        onChange={e =>
                            set("testData", { ...testCase.testData, requirement: e.target.value })
                        }
                    />
                </label>
                <label>
                    Giá trị tester
                    <textarea
                        rows="2"
                        value={testCase.testData?.value ?? ""}
                        onChange={e =>
                            set("testData", { ...testCase.testData, value: e.target.value })
                        }
                    />
                </label>
                <small>Readiness chỉ được cập nhật sau khi backend xác nhận batch save.</small>
            </fieldset>

            <label>
                Kết quả mong đợi
                <textarea
                    disabled={disabled}
                    rows="3"
                    value={testCase.expectedResult ?? ""}
                    onChange={e => set("expectedResult", e.target.value)}
                />
            </label>
        </div>
    );
}
