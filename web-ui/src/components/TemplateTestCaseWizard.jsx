import { useEffect, useMemo, useState } from "react";
import { generateTemplateTestCases } from "../api/templateTestCaseApi.js";

/* "Tạo testcase nhanh theo khuôn mẫu" (2026-09-04) — nguồn thứ 3 sinh testcase, THUẦN RULE-BASED,
   KHÔNG AI. Wizard nhiều bước: Bước 1 (tên chức năng + chọn thao tác con) -> lần lượt từng bước con
   theo ĐÚNG thứ tự cố định (Tìm kiếm -> Thêm -> Sửa -> Xóa -> In ấn -> Xuất Excel -> Xuất Word ->
   Lập báo cáo, KHÔNG phụ thuộc thứ tự tick ở Bước 1) -> "Hoàn tất" gọi thẳng API sinh testcase, KHÔNG
   qua Requirement Review/Clarification/AI Analysis nào.

   Render như 1 TRANG (không phải modal/popup) — Ngân sửa lại 2026-09-04: bản đầu render dạng overlay
   là SAI, lặp lại đúng lỗi đã sửa ở "+ Tạo testcase từ CodeGen" trước đó (xem CodeGenRequirementReviewPage.jsx).
   Component này chỉ là NỘI DUNG wizard — page chrome (back-link, page wrapper) do
   TemplateTestCaseWizardPage.jsx (trang riêng /workflows/:id/template-testcases) đảm nhiệm, giống hệt
   cách AIAnalysisReviewPanel/CodeGenRequirementReviewPage tách vai trò. */

const OPERATION_ORDER = ["SEARCH", "CREATE", "UPDATE", "DELETE", "PRINT", "EXPORT_EXCEL", "EXPORT_WORD", "REPORT"];
const OPERATION_LABEL = {
    SEARCH: "Tìm kiếm",
    CREATE: "Thêm",
    UPDATE: "Sửa",
    DELETE: "Xóa",
    PRINT: "In ấn",
    EXPORT_EXCEL: "Xuất Excel",
    EXPORT_WORD: "Xuất Word",
    REPORT: "Lập báo cáo"
};

const DEFAULT_TEXT = {
    CREATE_SUCCESS: "Thông tin sẽ được hiển thị tại danh sách",
    CREATE_FAIL: "Xuất hiện thông báo tại vị trí thông tin nhập sai, bắt buộc nhập. Thông tin không được lưu",
    UPDATE_SUCCESS: "Thông tin được cập nhật với giá trị mới và sẽ hiển thị tại danh sách",
    UPDATE_FAIL: "Xuất hiện thông báo tại vị trí thông tin nhập sai, không phù hợp. Thông tin không được cập nhật.",
    DELETE_SUCCESS: "Sau khi xóa thông tin không còn hiển thị tại danh sách",
    DELETE_FAIL: "Xuất hiện thông báo lỗi và không cho phép xóa",
    SEARCH_HIT: "Hiển thị kết quả thông tin tương ứng với từ khóa tìm kiếm",
    SEARCH_MISS: "Hiển thị thông báo không có thông tin",
    REPORT_SUCCESS:
        "Báo cáo được lập với các tiêu chí đã chọn. Thông tin biểu mẫu đúng, không sai canh chỉnh, dữ liệu chính xác, không sai chính tả",
    REPORT_MISSING: "Xuất hiện thông báo yêu cầu chọn đầy đủ tiêu chí, không cho phép lập báo cáo",
    REPORT_NO_DATA: "Hiển thị thông báo không có thông tin",
    PRINT_LIKE_HIT:
        "Hiển thị/xuất đúng dữ liệu theo tiêu chí đã chọn. Biểu mẫu đúng, không sai canh chỉnh, dữ liệu chính xác, không sai chính tả",
    PRINT_LIKE_MISS: "Hiển thị thông báo không có thông tin"
};

function printLikeDefault(operationKey) {
    const quality = "Biểu mẫu đúng, không sai canh chỉnh, dữ liệu chính xác, không sai chính tả";
    const verb = operationKey === "PRINT" ? "in" : "xuất";
    const fileSuffix = operationKey === "PRINT" ? "" : " File được tạo và lưu trữ tại máy người dùng.";
    return `Hệ thống ${verb} toàn bộ danh sách hoặc trang đang chọn. ${quality}.${fileSuffix}`;
}

function RequiredMark() {
    return <span className="template-wizard__required-mark"> *</span>;
}

/* ---------- Danh sách nhập nhiều dòng (dùng chung cho field/tiêu chí/trường hợp) ---------- */
function LineListEditor({ legend, values, onChange, addLabel = "+ Thêm dòng", placeholder = "", required = false }) {
    return (
        <fieldset className="template-wizard__section">
            <legend className="template-wizard__section-title">
                {legend}
                {required && <RequiredMark />}
            </legend>
            <div className="template-wizard__section-body">
                {values.map((value, index) => (
                    <div key={index}>
                        <span>{index + 1}</span>
                        <input
                            value={value}
                            placeholder={placeholder}
                            onChange={event => {
                                const next = [...values];
                                next[index] = event.target.value;
                                onChange(next);
                            }}
                        />
                        <button
                            className="text-button text-button--danger"
                            type="button"
                            onClick={() => onChange(values.filter((_, i) => i !== index))}
                        >
                            Xóa
                        </button>
                    </div>
                ))}
                <button className="text-button" type="button" onClick={() => onChange([...values, ""])}>
                    {addLabel}
                </button>
            </div>
        </fieldset>
    );
}

/* ---------- Danh sách tiêu chí Lập báo cáo — mỗi dòng có thêm checkbox "bắt buộc" ---------- */
function CriteriaListEditor({ values, onChange }) {
    return (
        <fieldset className="template-wizard__section">
            <legend className="template-wizard__section-title">
                Tiêu chí báo cáo (tối thiểu 1)
                <RequiredMark />
            </legend>
            <div className="template-wizard__section-body">
                {values.map((item, index) => (
                    <div key={index} className="template-wizard__criteria-row">
                        <span>{index + 1}</span>
                        <input
                            value={item.name}
                            placeholder="Tên tiêu chí (vd Năm học)"
                            onChange={event => {
                                const next = [...values];
                                next[index] = { ...next[index], name: event.target.value };
                                onChange(next);
                            }}
                        />
                        <label className="template-wizard__checkbox">
                            <input
                                type="checkbox"
                                checked={item.required}
                                onChange={event => {
                                    const next = [...values];
                                    next[index] = { ...next[index], required: event.target.checked };
                                    onChange(next);
                                }}
                            />
                            Bắt buộc
                        </label>
                        <button
                            className="text-button text-button--danger"
                            type="button"
                            onClick={() => onChange(values.filter((_, i) => i !== index))}
                        >
                            Xóa
                        </button>
                    </div>
                ))}
                <button
                    className="text-button"
                    type="button"
                    onClick={() => onChange([...values, { name: "", required: true }])}
                >
                    + Thêm tiêu chí
                </button>
            </div>
        </fieldset>
    );
}

function ExpectedResultField({ label, value, onChange }) {
    return (
        <label>
            {label}
            <textarea rows="2" value={value} onChange={event => onChange(event.target.value)} />
        </label>
    );
}

function cleanLines(values) {
    return values.map(v => v.trim()).filter(Boolean);
}

/* ---------- Thêm / Sửa — cùng cấu trúc form, chỉ khác nhãn và giá trị mặc định ---------- */
function AddOrUpdateStep({ mode, value, onChange }) {
    return (
        <div className="testcase-detail-form">
            <LineListEditor
                legend="Trường bắt buộc (tối thiểu 1)"
                required
                values={value.requiredFields}
                onChange={next => onChange({ ...value, requiredFields: next })}
                addLabel="+ Thêm trường bắt buộc"
                placeholder="Tên trường (vd Mã đợt nhập học)"
            />
            <LineListEditor
                legend="Trường tùy chọn"
                values={value.optionalFields}
                onChange={next => onChange({ ...value, optionalFields: next })}
                addLabel="+ Thêm trường tùy chọn"
                placeholder="Tên trường (vd Ghi chú)"
            />
            <fieldset className="template-wizard__section">
                <legend className="template-wizard__section-title">Nút lưu</legend>
                <div className="template-wizard__radio-group">
                    {["Lưu", "Cập nhật"].map(label => (
                        <label key={label}>
                            <input
                                type="radio"
                                name={`save-button-${mode}`}
                                checked={value.saveButtonLabel === label}
                                onChange={() => onChange({ ...value, saveButtonLabel: label })}
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </fieldset>
            <ExpectedResultField
                label="Kết quả mong đợi (thành công)"
                value={value.successExpected}
                onChange={next => onChange({ ...value, successExpected: next })}
            />
            <ExpectedResultField
                label="Kết quả mong đợi (thất bại)"
                value={value.failExpected}
                onChange={next => onChange({ ...value, failExpected: next })}
            />
        </div>
    );
}

function DeleteStep({ value, onChange }) {
    return (
        <div className="testcase-detail-form">
            <LineListEditor
                legend="Trường hợp xóa không thành công (mỗi dòng 1 điều kiện chặn xóa)"
                values={value.blockingCases}
                onChange={next => onChange({ ...value, blockingCases: next })}
                addLabel="+ Thêm trường hợp"
                placeholder="vd Đã có sinh viên đăng ký trong đợt"
            />
            <ExpectedResultField
                label="Kết quả mong đợi (xóa thành công)"
                value={value.successExpected}
                onChange={next => onChange({ ...value, successExpected: next })}
            />
            <ExpectedResultField
                label="Kết quả mong đợi (xóa không thành công — dùng chung cho mọi trường hợp)"
                value={value.failExpected}
                onChange={next => onChange({ ...value, failExpected: next })}
            />
        </div>
    );
}

function SearchStep({ value, onChange }) {
    return (
        <div className="testcase-detail-form">
            <LineListEditor
                legend="Trường thông tin tìm kiếm"
                values={value.fields}
                onChange={next => onChange({ ...value, fields: next })}
                addLabel="+ Thêm trường tìm kiếm"
                placeholder="vd Mã đợt nhập học"
            />
            <ExpectedResultField
                label="Kết quả mong đợi (có dữ liệu)"
                value={value.hitExpected}
                onChange={next => onChange({ ...value, hitExpected: next })}
            />
            <ExpectedResultField
                label="Kết quả mong đợi (không có dữ liệu)"
                value={value.missExpected}
                onChange={next => onChange({ ...value, missExpected: next })}
            />
        </div>
    );
}

function PrintLikeStep({ operationKey, value, onChange }) {
    const hasCriteria = cleanLines(value.criteria).length > 0;
    return (
        <div className="testcase-detail-form">
            <LineListEditor
                legend="Tiêu chí lọc phạm vi dữ liệu (không bắt buộc — vd theo năm học, theo lớp)"
                values={value.criteria}
                onChange={next => onChange({ ...value, criteria: next })}
                addLabel="+ Thêm tiêu chí"
                placeholder="vd Theo năm học"
            />
            <ExpectedResultField
                label="Kết quả mong đợi (mặc định, không chọn tiêu chí)"
                value={value.defaultExpected}
                onChange={next => onChange({ ...value, defaultExpected: next })}
            />
            {hasCriteria && (
                <>
                    <ExpectedResultField
                        label="Kết quả mong đợi (áp dụng tiêu chí, có dữ liệu)"
                        value={value.criteriaHitExpected}
                        onChange={next => onChange({ ...value, criteriaHitExpected: next })}
                    />
                    <ExpectedResultField
                        label="Kết quả mong đợi (áp dụng tiêu chí, không có dữ liệu)"
                        value={value.criteriaMissExpected}
                        onChange={next => onChange({ ...value, criteriaMissExpected: next })}
                    />
                </>
            )}
        </div>
    );
}

function ReportStep({ value, onChange }) {
    return (
        <div className="testcase-detail-form">
            <CriteriaListEditor values={value.criteria} onChange={next => onChange({ ...value, criteria: next })} />
            <ExpectedResultField
                label="Kết quả mong đợi (lập báo cáo thành công)"
                value={value.successExpected}
                onChange={next => onChange({ ...value, successExpected: next })}
            />
            <ExpectedResultField
                label="Kết quả mong đợi (thiếu tiêu chí bắt buộc)"
                value={value.missingExpected}
                onChange={next => onChange({ ...value, missingExpected: next })}
            />
            <ExpectedResultField
                label="Kết quả mong đợi (đủ tiêu chí nhưng không có dữ liệu phù hợp)"
                value={value.noDataExpected}
                onChange={next => onChange({ ...value, noDataExpected: next })}
            />
        </div>
    );
}

function defaultConfigFor(operation) {
    switch (operation) {
        case "SEARCH":
            return { fields: [""], hitExpected: DEFAULT_TEXT.SEARCH_HIT, missExpected: DEFAULT_TEXT.SEARCH_MISS };
        case "CREATE":
            return {
                requiredFields: [""],
                optionalFields: [],
                saveButtonLabel: "Lưu",
                successExpected: DEFAULT_TEXT.CREATE_SUCCESS,
                failExpected: DEFAULT_TEXT.CREATE_FAIL
            };
        case "UPDATE":
            return {
                requiredFields: [""],
                optionalFields: [],
                saveButtonLabel: "Lưu",
                successExpected: DEFAULT_TEXT.UPDATE_SUCCESS,
                failExpected: DEFAULT_TEXT.UPDATE_FAIL
            };
        case "DELETE":
            return { blockingCases: [], successExpected: DEFAULT_TEXT.DELETE_SUCCESS, failExpected: DEFAULT_TEXT.DELETE_FAIL };
        case "PRINT":
        case "EXPORT_EXCEL":
        case "EXPORT_WORD":
            return {
                criteria: [],
                defaultExpected: printLikeDefault(operation),
                criteriaHitExpected: DEFAULT_TEXT.PRINT_LIKE_HIT,
                criteriaMissExpected: DEFAULT_TEXT.PRINT_LIKE_MISS
            };
        case "REPORT":
            return {
                criteria: [{ name: "", required: true }],
                successExpected: DEFAULT_TEXT.REPORT_SUCCESS,
                missingExpected: DEFAULT_TEXT.REPORT_MISSING,
                noDataExpected: DEFAULT_TEXT.REPORT_NO_DATA
            };
        default:
            return {};
    }
}

/** Config "chưa đụng tới" (vẫn nguyên giá trị mặc định lúc khởi tạo) — dùng để quyết định có nên tự
 *  load lại từ bước Thêm hay không (KHÔNG ghi đè nếu tester đã tự nhập/sửa tay ở Sửa). */
function isUntouchedAddOrUpdateConfig(config) {
    if (!config) return true;
    return config.requiredFields.length <= 1 && !config.requiredFields[0] && config.optionalFields.length === 0;
}

/** Chuẩn hoá 1 config bước con thành payload gửi API — lọc dòng rỗng, bỏ field UI-only. */
function toPayloadConfig(operation, config) {
    switch (operation) {
        case "SEARCH":
            return { fields: cleanLines(config.fields), hitExpected: config.hitExpected, missExpected: config.missExpected };
        case "CREATE":
        case "UPDATE":
            return {
                requiredFields: cleanLines(config.requiredFields),
                optionalFields: cleanLines(config.optionalFields),
                saveButtonLabel: config.saveButtonLabel,
                successExpected: config.successExpected,
                failExpected: config.failExpected
            };
        case "DELETE":
            return {
                blockingCases: cleanLines(config.blockingCases),
                successExpected: config.successExpected,
                failExpected: config.failExpected
            };
        case "PRINT":
        case "EXPORT_EXCEL":
        case "EXPORT_WORD":
            return {
                criteria: cleanLines(config.criteria),
                defaultExpected: config.defaultExpected,
                criteriaHitExpected: config.criteriaHitExpected,
                criteriaMissExpected: config.criteriaMissExpected
            };
        case "REPORT":
            return {
                criteria: config.criteria
                    .map(item => ({ name: item.name.trim(), required: item.required === true }))
                    .filter(item => item.name),
                successExpected: config.successExpected,
                missingExpected: config.missingExpected,
                noDataExpected: config.noDataExpected
            };
        default:
            return config;
    }
}

export default function TemplateTestCaseWizard({ onComplete }) {
    const [functionName, setFunctionName] = useState("");
    const [selectedOperations, setSelectedOperations] = useState(() => new Set());
    const [configs, setConfigs] = useState({});
    const [phase, setPhase] = useState("INFO"); // "INFO" | "OPERATION"
    const [operationIndex, setOperationIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const activeOperations = useMemo(
        () => OPERATION_ORDER.filter(op => selectedOperations.has(op)),
        [selectedOperations]
    );
    const currentOperation = activeOperations[operationIndex];
    const isLastOperation = operationIndex === activeOperations.length - 1;

    // Sửa: tự load lại trường bắt buộc/tùy chọn từ bước Thêm NGAY KHI VÀO bước Sửa — không cần thao
    // tác thủ công. Bug thật đã gặp (2026-09-04): bản đầu chạy việc này quá SỚM (lúc rời Bước 1,
    // trước khi tester kịp nhập gì ở Thêm) nên luôn copy giá trị RỖNG. Chạy ở ĐÂY (useEffect theo dõi
    // currentOperation) đảm bảo chỉ copy khi tester đã thực sự ĐI QUA bước Thêm và nhập dữ liệu.
    // Không ghi đè nếu Sửa đã được tự nhập/sửa tay (isUntouchedAddOrUpdateConfig).
    useEffect(() => {
        if (phase !== "OPERATION" || currentOperation !== "UPDATE") return;
        setConfigs(current => {
            const createConfig = current.CREATE;
            if (!createConfig) return current; // Thêm chưa được chọn -> Sửa tự nhập từ đầu theo mặc định
            if (!isUntouchedAddOrUpdateConfig(current.UPDATE)) return current;
            return {
                ...current,
                UPDATE: {
                    ...(current.UPDATE ?? defaultConfigFor("UPDATE")),
                    requiredFields: [...createConfig.requiredFields],
                    optionalFields: [...createConfig.optionalFields]
                }
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, currentOperation]);

    const toggleOperation = operation => {
        setSelectedOperations(current => {
            const next = new Set(current);
            if (next.has(operation)) next.delete(operation);
            else next.add(operation);
            return next;
        });
    };

    const startWizard = () => {
        if (!functionName.trim() || activeOperations.length === 0) return;
        setConfigs(current => {
            const next = { ...current };
            activeOperations.forEach(op => {
                if (!next[op]) next[op] = defaultConfigFor(op);
            });
            return next;
        });
        setOperationIndex(0);
        setPhase("OPERATION");
    };

    const updateCurrentConfig = nextConfig => {
        setConfigs(current => ({ ...current, [currentOperation]: nextConfig }));
    };

    const skipCurrentStep = () => {
        const remaining = activeOperations.filter(op => op !== currentOperation);
        setSelectedOperations(current => {
            const next = new Set(current);
            next.delete(currentOperation);
            return next;
        });
        setConfigs(current => {
            const next = { ...current };
            delete next[currentOperation];
            return next;
        });
        if (remaining.length === 0) {
            setPhase("INFO");
            setOperationIndex(0);
        } else {
            setOperationIndex(current => Math.min(current, remaining.length - 1));
        }
    };

    const goBack = () => {
        if (operationIndex === 0) {
            setPhase("INFO");
            return;
        }
        setOperationIndex(current => current - 1);
    };

    const goNext = () => {
        if (isLastOperation) {
            submit();
            return;
        }
        setOperationIndex(current => current + 1);
    };

    const submit = async () => {
        if (activeOperations.length === 0) return;
        setSubmitting(true);
        setError("");
        try {
            const operationsPayload = {};
            activeOperations.forEach(op => {
                operationsPayload[op] = toPayloadConfig(op, configs[op] ?? defaultConfigFor(op));
            });
            const testCases = await generateTemplateTestCases({
                functionName: functionName.trim(),
                operations: operationsPayload
            });
            await onComplete(testCases);
        } catch (e) {
            setError(e?.message ?? "Không sinh được testcase từ khuôn mẫu lúc này.");
        } finally {
            setSubmitting(false);
        }
    };

    const renderOperationForm = () => {
        const value = configs[currentOperation] ?? defaultConfigFor(currentOperation);
        switch (currentOperation) {
            case "SEARCH":
                return <SearchStep value={value} onChange={updateCurrentConfig} />;
            case "CREATE":
                return <AddOrUpdateStep mode="CREATE" value={value} onChange={updateCurrentConfig} />;
            case "UPDATE":
                return <AddOrUpdateStep mode="UPDATE" value={value} onChange={updateCurrentConfig} />;
            case "DELETE":
                return <DeleteStep value={value} onChange={updateCurrentConfig} />;
            case "PRINT":
            case "EXPORT_EXCEL":
            case "EXPORT_WORD":
                return <PrintLikeStep operationKey={currentOperation} value={value} onChange={updateCurrentConfig} />;
            case "REPORT":
                return <ReportStep value={value} onChange={updateCurrentConfig} />;
            default:
                return null;
        }
    };

    return (
        <div className="requirement-review">
            <header className="requirement-review__header">
                <div>
                    <h2>Tạo testcase nhanh theo khuôn mẫu</h2>
                    <p>Nhập theo khuôn mẫu cố định — sinh testcase ngay, không qua AI phân tích.</p>
                </div>
            </header>

            {phase === "OPERATION" && (
                <ol className="template-wizard__steps" aria-label={`Bước ${operationIndex + 1} trên ${activeOperations.length}`}>
                    {activeOperations.map((op, index) => {
                        const state = index < operationIndex ? "done" : index === operationIndex ? "current" : "upcoming";
                        return (
                            <li key={op} className={`template-wizard__step template-wizard__step--${state}`}>
                                <span className="template-wizard__step-index">{state === "done" ? "✓" : index + 1}</span>
                                <span>{OPERATION_LABEL[op]}</span>
                            </li>
                        );
                    })}
                </ol>
            )}

            {error && (
                <div className="inline-alert" role="alert">
                    <strong>Không thể tạo testcase</strong>
                    <span>{error}</span>
                </div>
            )}

            {phase === "INFO" ? (
                <div className="testcase-detail-form">
                    <label>
                        <span>
                            Tên chức năng
                            <RequiredMark />
                        </span>
                        <input
                            value={functionName}
                            onChange={event => setFunctionName(event.target.value)}
                            placeholder="vd DM đợt nhập học"
                        />
                    </label>
                    <fieldset className="template-wizard__operations">
                        <legend className="template-wizard__section-title">Thao tác con</legend>
                        <div className="template-wizard__operations-grid">
                            {OPERATION_ORDER.map(op => {
                                const checked = selectedOperations.has(op);
                                return (
                                    <label
                                        key={op}
                                        className={`template-wizard__operation-card${checked ? " is-checked" : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleOperation(op)}
                                        />
                                        <span>{OPERATION_LABEL[op]}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                    <div className="testcase-detail-form__actions">
                        <button
                            className="button button--primary"
                            type="button"
                            disabled={!functionName.trim() || activeOperations.length === 0}
                            onClick={startWizard}
                        >
                            Tiếp theo →
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {renderOperationForm()}
                    <div className="testcase-detail-form__actions">
                        <button className="button button--secondary" type="button" onClick={goBack} disabled={submitting}>
                            ← Trước đó
                        </button>
                        <button className="button button--secondary" type="button" onClick={skipCurrentStep} disabled={submitting}>
                            Bỏ qua bước này
                        </button>
                        <button className="button button--primary" type="button" onClick={goNext} disabled={submitting}>
                            {submitting ? "Đang tạo..." : isLastOperation ? "Hoàn tất" : "Tiếp theo →"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
