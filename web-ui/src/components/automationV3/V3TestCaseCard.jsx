/*
 V3TestCaseCard — Card testcase (Bước 5B + 5C-0 Record Mapping).

 Mỗi card MỘT primary action đổi theo trạng thái testcase:
   SELECTED (chưa đoạn) → [Gắn bản ghi testcase]
   SELECTED (có đoạn)   → [Xem và gán đoạn]
   RECORDING            → [Nhập xong]
   REVIEW_REQUIRED      → [Xem và duyệt] + menu "…"

 5C-0:
   - Hiển thị trạng thái tự động hóa (3 nhãn): Chưa quyết định / Có automation / Chỉ kiểm thử thủ công.
   - Hiển thị số đoạn đã gán + số đoạn đã xác nhận (mapping bằng testCaseId, không theo thứ tự).
   - Menu: "Đánh dấu chỉ kiểm thử thủ công" / "Cho phép tự động hóa" (tester quyết định).
*/

import { decisionLabel } from "../../utils/automationV3.js";

const STATUS_BADGE = {
    SELECTED: ["v3-badge--sel", "Đã chọn"],
    RECORDING: ["v3-badge--rec", "Nhập bản ghi"],
    REVIEW_REQUIRED: ["v3-badge--review", "Cần duyệt"],
    APPROVED: ["v3-badge--ok", "Đã duyệt"]
};

const DECISION_BADGE = {
    AUTOMATED: "v3-badge--ok",
    MANUAL_ONLY: "v3-badge--manual",
    UNDECIDED: "v3-badge--review"
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
    const decision = testCase.automationDecision ?? "UNDECIDED";
    const segments = Array.isArray(testCase.segments) ? testCase.segments : [];
    const segSummary = testCase.segmentSummary ?? {
        total: segments.length,
        confirmed: segments.filter(s => s.status === "CONFIRMED").length,
        draft: segments.filter(s => s.status === "DRAFT").length
    };

    const segConfirmed = (testCase.segmentSummary?.confirmed ?? 0) > 0;

    let primary = null;
    // 5C: có segment CONFIRMED → bước tiếp theo là Điều kiện xác nhận (flow chốt).
    if (status === "SELECTED" && segConfirmed) primary = { key: "conditions", label: "Điều kiện xác nhận", danger: false, disabled: recordingActive };
    else if (status === "SELECTED" && segments.length > 0) primary = { key: "segments", label: "Xem và gán đoạn", danger: false, disabled: recordingActive };
    else if (status === "SELECTED") primary = { key: "record", label: "Gắn bản ghi testcase", danger: false, disabled: recordingActive };
    else if (status === "RECORDING") primary = { key: "stop", label: "Nhập xong", danger: false };
    else if (status === "REVIEW_REQUIRED") primary = { key: "review", label: "Xem và duyệt", danger: false };

    const showMenu = status === "REVIEW_REQUIRED" || status === "APPROVED" || (status === "SELECTED" && segments.length > 0);
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
                        <span className={`v3-badge ${DECISION_BADGE[decision] ?? "v3-badge--review"}`}>
                            {decisionLabel(decision)}
                        </span>
                    </div>
                    <div className="v3-card__row v3-card__row--muted">
                        {segments.length > 0
                            ? `Đoạn thao tác: đã gán ${segSummary.total} đoạn · ${segSummary.confirmed} đã xác nhận`
                            : "Đoạn thao tác: chưa gán đoạn nào"}
                    </div>
                    <div className="v3-card__row v3-card__row--muted">
                        {segConfirmed
                            ? `Điều kiện xác nhận: ${segSummary.total > 0 ? (testCase.assertionStatus?.confirmed ?? 0) : 0} đã xác nhận`
                            : "Điều kiện xác nhận: cần đoạn thao tác trước"}
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
                                {segments.length > 0 ? (
                                    <div role="button" tabIndex={0} onClick={() => onMenuAction?.("segments", testCase)}>
                                        Xem và gán đoạn
                                    </div>
                                ) : null}
                                <div role="button" tabIndex={0} onClick={() => onMenuAction?.("record_again", testCase)}>
                                    Ghi lại
                                </div>
                                {decision === "MANUAL_ONLY" ? (
                                    <div role="button" tabIndex={0} onClick={() => onMenuAction?.("decision_automated", testCase)}>
                                        Cho phép tự động hóa
                                    </div>
                                ) : (
                                    <div role="button" tabIndex={0} onClick={() => onMenuAction?.("decision_manual", testCase)}>
                                        Đánh dấu chỉ kiểm thử thủ công
                                    </div>
                                )}
                                {testCase.recordingId ? (
                                    <>
                                        <div role="button" tabIndex={0} onClick={() => onMenuAction?.("delete", testCase)}>
                                            Xóa recording
                                        </div>
                                        <div className="danger" role="button" tabIndex={0} onClick={() => onMenuAction?.("reject", testCase)}>
                                            Từ chối recording
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
