import {
    formatTestData,
    normalizeSteps,
    testCaseWarnings
} from "../utils/testCaseReview.js";

function text(value, fallback = "Chưa có") {
    const normalized = String(value ?? "").trim();
    return normalized || fallback;
}

function DetailList({ title, values }) {
    if (!Array.isArray(values) || values.length === 0) return null;
    return (
        <section className="testcase-detail-section">
            <h4>{title}</h4>
            <ol>
                {values.map((value, index) => (
                    <li key={`${title}-${index}`}>{text(value?.action ?? value)}</li>
                ))}
            </ol>
        </section>
    );
}

export default function TestCaseEditor({
    testCase,
    editing,
    editDraft,
    disabled,
    saving = false,
    onClose,
    onEdit,
    onCancel,
    onDraftChange,
    onSave
}) {
    if (!testCase) {
        return <div className="testcase-detail-empty">Chọn một test case để xem chi tiết.</div>;
    }

    const value = editing ? editDraft : testCase;
    const warnings = testCaseWarnings(value);
    const invalid =
        !String(value.scenario ?? value.title ?? "").trim() ||
        !String(value.expectedResult ?? "").trim() ||
        normalizeSteps(value.steps).length === 0;
    const set = (field, next) => onDraftChange({ ...value, [field]: next });

    return (
        <aside className="testcase-detail-panel" aria-label={`Chi tiết test case ${testCase.id}`}>
            <header className="testcase-detail-panel__header">
                <div>
                    <span>Testcase ID</span>
                    <strong>{testCase.id}</strong>
                </div>
                <div className="testcase-detail-panel__header-actions">
                    {!editing && (
                        <button
                            className="button button--secondary"
                            type="button"
                            disabled={disabled}
                            onClick={onEdit}
                        >
                            Chỉnh sửa
                        </button>
                    )}
                    <button
                        className="testcase-detail-panel__close"
                        type="button"
                        aria-label="Đóng chi tiết test case"
                        disabled={saving}
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>
            </header>

            {warnings.length > 0 && (
                <div className="editor-warning" role="status">
                    <strong>Cần kiểm tra</strong>
                    <ul>
                        {warnings.map(item => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}

            {editing ? (
                <div className="testcase-detail-form">
                    <label>
                        Scenario
                        <textarea
                            rows="3"
                            value={value.scenario ?? ""}
                            onChange={event => set("scenario", event.target.value)}
                        />
                    </label>
                    <div className="testcase-detail-form__grid">
                        <label>
                            Module
                            <input
                                value={value.module ?? ""}
                                onChange={event => set("module", event.target.value)}
                            />
                        </label>
                        <label>
                            Feature
                            <input
                                value={value.feature ?? value.function ?? ""}
                                onChange={event => set("feature", event.target.value)}
                            />
                        </label>
                        <label>
                            Test Type
                            <input
                                value={value.type ?? ""}
                                onChange={event => set("type", event.target.value)}
                            />
                        </label>
                    </div>
                    <label>
                        Test Data
                        <textarea
                            rows="2"
                            value={value.testData?.value ?? ""}
                            onChange={event =>
                                set("testData", { ...value.testData, value: event.target.value })
                            }
                        />
                    </label>
                    <label>
                        Expected Result
                        <textarea
                            rows="3"
                            value={value.expectedResult ?? ""}
                            onChange={event => set("expectedResult", event.target.value)}
                        />
                    </label>
                    <fieldset className="testcase-step-editor">
                        <legend>Test Steps</legend>
                        {(value.steps ?? []).map((step, index) => (
                            <div key={`${testCase.id}-step-${index}`}>
                                <span>{index + 1}</span>
                                <input
                                    aria-label={`Bước ${index + 1}`}
                                    value={step.action ?? ""}
                                    onChange={event => {
                                        const steps = structuredClone(value.steps ?? []);
                                        steps[index] = {
                                            ...steps[index],
                                            action: event.target.value
                                        };
                                        set("steps", steps);
                                    }}
                                />
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={() =>
                                        set(
                                            "steps",
                                            value.steps.filter(
                                                (_, itemIndex) => itemIndex !== index
                                            )
                                        )
                                    }
                                >
                                    Xóa
                                </button>
                            </div>
                        ))}
                        <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                                set("steps", [
                                    ...(value.steps ?? []),
                                    {
                                        order: (value.steps?.length ?? 0) + 1,
                                        action: "",
                                        expected: ""
                                    }
                                ])
                            }
                        >
                            + Thêm bước
                        </button>
                    </fieldset>
                    <div className="testcase-detail-form__actions">
                        <button
                            className="button button--secondary"
                            type="button"
                            disabled={saving}
                            onClick={onCancel}
                        >
                            Đóng
                        </button>
                        <button
                            className="button button--primary"
                            type="button"
                            disabled={disabled || invalid || saving}
                            onClick={onSave}
                        >
                            {saving ? "Đang lưu..." : "Lưu"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="testcase-detail-content">
                    <section className="testcase-detail-section">
                        <h4>Scenario</h4>
                        <p>{text(value.scenario ?? value.title)}</p>
                    </section>
                    <section className="testcase-detail-section">
                        <h4>General Information</h4>
                        <dl>
                            <div>
                                <dt>Module / Feature</dt>
                                <dd>
                                    {text(
                                        [value.module, value.feature ?? value.function]
                                            .filter(Boolean)
                                            .join(" / ")
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Test Type</dt>
                                <dd>{text(value.type)}</dd>
                            </div>
                        </dl>
                    </section>
                    <DetailList
                        title="Test Data"
                        values={formatTestData(value.testData).split("\n").filter(Boolean)}
                    />
                    <section className="testcase-detail-section">
                        <h4>Expected Result</h4>
                        <p>{text(value.expectedResult)}</p>
                    </section>
                    <DetailList title="Test Steps" values={value.steps} />
                    <DetailList title="Preconditions" values={value.preconditions} />
                </div>
            )}
        </aside>
    );
}
