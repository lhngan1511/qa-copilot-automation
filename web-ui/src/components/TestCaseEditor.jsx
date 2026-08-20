import {
    formatTestData,
    normalizeSteps,
    testCaseDisplayId,
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

function StringListEditor({ title, values = [], itemLabel, onChange }) {
    return (
        <fieldset className="testcase-list-editor">
            <legend>{title}</legend>
            {values.map((item, index) => (
                <div key={`${title}-${index}`}>
                    <span>{index + 1}</span>
                    <input
                        aria-label={`${itemLabel} ${index + 1}`}
                        value={String(item?.action ?? item ?? "")}
                        onChange={event => {
                            const next = [...values];
                            next[index] = event.target.value;
                            onChange(next);
                        }}
                    />
                    <button
                        className="text-button"
                        type="button"
                        onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
                    >
                        Xóa
                    </button>
                </div>
            ))}
            <button
                className="text-button"
                type="button"
                onClick={() => onChange([...values, ""])}
            >
                + Thêm điều kiện
            </button>
        </fieldset>
    );
}

function TestDataEditor({ testData = {}, onChange }) {
    const fields =
        testData.fields && typeof testData.fields === "object" && !Array.isArray(testData.fields)
            ? testData.fields
            : {};
    const entries = Object.entries(fields);

    if (entries.length === 0) {
        return (
            <label>
                Dữ liệu kiểm thử
                <textarea
                    rows="3"
                    value={testData.value ?? ""}
                    placeholder={testData.requirement || "Nhập dữ liệu cần dùng khi thực thi testcase"}
                    onChange={event => onChange({ ...testData, value: event.target.value })}
                />
            </label>
        );
    }

    return (
        <fieldset className="testcase-data-editor">
            <legend>Dữ liệu kiểm thử</legend>
            {entries.map(([name, field]) => (
                <label key={name}>
                    <span>{name}</span>
                    <input
                        value={field?.value ?? ""}
                        placeholder={field?.instruction || "Nhập giá trị kiểm thử"}
                        onChange={event => {
                            const nextFields = {
                                ...fields,
                                [name]: {
                                    ...field,
                                    value: event.target.value,
                                    requiresTesterInput: false
                                }
                            };
                            onChange({
                                ...testData,
                                fields: nextFields,
                                value: Object.entries(nextFields)
                                    .map(([fieldName, item]) => `${fieldName}: ${item?.value ?? ""}`)
                                    .join("\n"),
                                requiresTesterInput: Object.values(nextFields).some(
                                    item => item?.requiresTesterInput === true
                                )
                            });
                        }}
                    />
                    {(field?.instruction || field?.purpose) && (
                        <small>{field.instruction || `Mục đích: ${field.purpose}`}</small>
                    )}
                </label>
            ))}
        </fieldset>
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
    onSave,
    creating = false,
    onDelete
}) {
    if (!testCase) {
        return <div className="testcase-detail-empty">Chọn một test case để xem chi tiết.</div>;
    }

    const value = editing ? editDraft : testCase;
    const warnings = testCaseWarnings(value);
    const invalid =
        !String(value.scenario ?? value.title ?? "").trim() ||
        !String(value.module ?? "").trim() ||
        !String(value.feature ?? value.function ?? "").trim() ||
        !String(value.type ?? "").trim() ||
        !String(value.expectedResult ?? "").trim() ||
        normalizeSteps(value.steps).length === 0;
    const set = (field, next) => onDraftChange({ ...value, [field]: next });

    return (
        <aside className="testcase-detail-panel" aria-label={`Chi tiết test case ${testCaseDisplayId(testCase)}`}>
            <header className="testcase-detail-panel__header">
                <div>
                    <span>Testcase ID</span>
                    <strong>{testCaseDisplayId(testCase)}</strong>
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
                    {!creating && onDelete && (
                        <button
                            className="button button--destructive"
                            type="button"
                            disabled={disabled || saving}
                            onClick={onDelete}
                        >
                            Xóa
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
                        Tình huống kiểm tra
                        <textarea
                            rows="3"
                            value={value.scenario ?? ""}
                            onChange={event => set("scenario", event.target.value)}
                        />
                    </label>
                    <div className="testcase-detail-form__grid">
                        <label>
                            Phân hệ
                            <input
                                value={value.module ?? ""}
                                onChange={event => set("module", event.target.value)}
                            />
                        </label>
                        <label>
                            Chức năng
                            <input
                                value={value.feature ?? value.function ?? ""}
                                onChange={event => set("feature", event.target.value)}
                            />
                        </label>
                        <label>
                            Loại testcase
                            <input
                                value={value.type ?? ""}
                                onChange={event => set("type", event.target.value)}
                            />
                        </label>
                    </div>
                    <StringListEditor
                        title="Điều kiện tiên quyết"
                        itemLabel="Điều kiện"
                        values={value.preconditions ?? []}
                        onChange={next => set("preconditions", next)}
                    />
                    <TestDataEditor
                        testData={value.testData}
                        onChange={next => set("testData", next)}
                    />
                    <fieldset className="testcase-step-editor">
                        <legend>Các bước thực hiện</legend>
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
                    <label>
                        Kết quả mong đợi
                        <textarea
                            rows="3"
                            value={value.expectedResult ?? ""}
                            onChange={event => set("expectedResult", event.target.value)}
                        />
                    </label>
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
                            {saving ? "Đang lưu..." : creating ? "Thêm testcase" : "Lưu"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="testcase-detail-content">
                    <section className="testcase-detail-section">
                        <h4>Tình huống kiểm tra</h4>
                        <p>{text(value.scenario ?? value.title)}</p>
                    </section>
                    <section className="testcase-detail-section">
                        <h4>Thông tin chung</h4>
                        <dl>
                            <div>
                                <dt>Phân hệ / Chức năng</dt>
                                <dd>
                                    {text(
                                        [value.module, value.feature ?? value.function]
                                            .filter(Boolean)
                                            .join(" / ")
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Loại testcase</dt>
                                <dd>{text(value.type)}</dd>
                            </div>
                        </dl>
                    </section>
                    <DetailList title="Điều kiện tiên quyết" values={value.preconditions} />
                    <DetailList
                        title="Dữ liệu kiểm thử"
                        values={formatTestData(value.testData).split("\n").filter(Boolean)}
                    />
                    <DetailList title="Các bước thực hiện" values={value.steps} />
                    <section className="testcase-detail-section">
                        <h4>Kết quả mong đợi</h4>
                        <p>{text(value.expectedResult)}</p>
                    </section>
                </div>
            )}
        </aside>
    );
}
