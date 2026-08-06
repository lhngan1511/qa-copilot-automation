/*
 V3TestCaseCard — Card testcase (Bước 5B).

 Mỗi card MỘT primary action đổi theo trạng thái testcase:
   SELECTED       → [Gắn bản ghi testcase]
   RECORDING      → [Nhập xong]
   REVIEW_REQUIRED→ [Xem và duyệt] + menu "…"
   APPROVED       → badge "Đã duyệt" + menu "…"
   NOT_SELECTED   → không action

 Menu "…" chỉ xuất hiện khi card ĐÃ CÓ recording (REVIEW_REQUIRED / APPROVED).
 Không menu ở SELECTED / RECORDING.
*/

const STATUS_BADGE = {
    SELECTED: ["v3-badge--sel", "Đã chọn"],
    RECORDING: ["v3-badge--rec", "Nhập bản ghi"],
    REVIEW_REQUIRED: ["v3-badge--review", "Cần duyệt"],
    APPROVED: ["v3-badge--ok", "Đã duyệt"]
};

export default function V3TestCaseCard({
    testCase,
    selected = false,
    recordingActive = false,
    onToggle,
    onPrimaryAction,
    onMenuAction,
    menuOpen = false
}) {
    const selectable = testCase.automationCandidate !== false;
    const isSelected = selected && selectable;
    const status = testCase.automationStatus;

    let primary = null;
    if (status === "SELECTED") primary = { key: "record", label: "Gắn bản ghi testcase", danger: false, disabled: recordingActive };
    else if (status === "RECORDING") primary = { key: "stop", label: "Nhập xong", danger: false };
    else if (status === "REVIEW_REQUIRED") primary = { key: "review", label: "Xem và duyệt", danger: false };

    const showMenu = status === "REVIEW_REQUIRED" || status === "APPROVED";
    const badge = STATUS_BADGE[status] ?? ["v3-badge--nosel", "Chưa chọn"];

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
                        <span className={`v3-badge ${badge[0]}`}>{badge[1]}</span>
                    </div>
                    {primary ? (
                        <div className="v3-card__action">
                            <button
                                type="button"
                                className={`v3-btn ${primary.danger ? "v3-btn--danger" : "v3-btn--primary"}${primary.disabled ? " v3-btn--disabled" : ""}`}
                                disabled={primary.disabled}
                                onClick={() => onPrimaryAction?.(primary.key, testCase)}
                            >
                                {primary.label}
                            </button>
                        </div>
                    ) : null}
                </div>
                {showMenu ? (
                    <div className="v3-menu">
                        <button
                            type="button"
                            className="v3-menu__btn"
                            onClick={() => onMenuAction?.("__toggle", testCase)}
                            aria-label={`Thao tác recording ${testCase.testCaseId}`}
                            aria-expanded={menuOpen}
                        >
                            ⋯
                        </button>
                        {menuOpen ? (
                            <div className="v3-menu__pop">
                                <div role="button" tabIndex={0} onClick={() => onMenuAction?.("record_again", testCase)}>
                                    Ghi lại
                                </div>
                                <div role="button" tabIndex={0} onClick={() => onMenuAction?.("delete", testCase)}>
                                    Xóa recording
                                </div>
                                <div className="danger" role="button" tabIndex={0} onClick={() => onMenuAction?.("reject", testCase)}>
                                    Từ chối recording
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
