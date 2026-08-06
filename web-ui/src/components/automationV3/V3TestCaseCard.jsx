/*
 V3TestCaseCard — Card testcase (bước 5A).

 Mỗi card chỉ có MỘT hành động chính: checkbox chọn/bỏ chọn.
 Nội dung tối đa: checkbox + testCaseId + title + type + 1 trạng thái automation
 + 1 dòng dữ liệu. Không nút phụ / Review / Generate / Run / Export.
*/

export default function V3TestCaseCard({ testCase, selected = false, onToggle, disabled = false }) {
    const selectable = testCase.automationCandidate !== false && !disabled;
    const isSelected = selected && selectable;

    return (
        <div
            className={[
                "v3-card",
                isSelected ? "v3-card--selected" : "",
                !selectable ? "v3-card--disabled" : ""
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="v3-card__top">
                <label className="v3-check">
                    <input
                        type="checkbox"
                        className="v3-check__input"
                        checked={isSelected}
                        disabled={!selectable}
                        onChange={() => onToggle?.(testCase.testCaseId, !isSelected)}
                        aria-label={`Chọn testcase ${testCase.testCaseId}`}
                    />
                    <span className="v3-check__box" aria-hidden="true">
                        {isSelected ? "✓" : ""}
                    </span>
                </label>
                <span className="v3-card__id">{testCase.testCaseId}</span>
                <div className="v3-card__body">
                    <h5 className="v3-card__title">{testCase.title}</h5>
                    <div className="v3-card__row">
                        <span className="v3-badge v3-badge--type">{testCase.type}</span>
                        {isSelected ? (
                            <span className="v3-badge v3-badge--sel">Đã chọn</span>
                        ) : (
                            <span className="v3-badge v3-badge--nosel">Chưa chọn</span>
                        )}
                    </div>
                    <div className="v3-card__data">
                        {!selectable ? (
                            <span className="v3-note v3-note--warn">
                                {testCase.automationDisabledReason ?? "Không thể chọn"}
                            </span>
                        ) : testCase.executionReadiness === "DATA_REQUIRED" ? (
                            <span className="v3-note v3-note--warn">Cần bổ sung dữ liệu trước khi chạy</span>
                        ) : (
                            <span className="v3-note">{testCase.dataNote}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
