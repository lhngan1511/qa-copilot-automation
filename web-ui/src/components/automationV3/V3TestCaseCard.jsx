/*
 V3TestCaseCard — Card testcase (Bước 5A).

 Nội dung tối đa:
   checkbox + testCaseId + title + type + 1 trạng thái automation + 1 dòng dữ liệu
   + tối đa 1 primary action.

 Trạng thái:
   NOT_SELECTED → checkbox trống, badge "Chưa chọn", không primary action.
   SELECTED     → checkbox đã chọn, badge "Đã chọn", primary "Ghi testcase" disabled.
   automationCandidate=false → disable checkbox + hiện lý do ngắn.
   executionReadiness=DATA_REQUIRED → vẫn chọn được + hiện "Cần bổ sung dữ liệu...".

 Không có: Xem chi tiết / Review / Generate / Run / Export / nhiều nút.
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
                    {isSelected ? (
                        <div className="v3-card__action">
                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--disabled" disabled>
                                Ghi testcase · bước sau
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
