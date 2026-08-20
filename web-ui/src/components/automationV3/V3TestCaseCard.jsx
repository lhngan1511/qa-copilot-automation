/*
 V3TestCaseCard — Card testcase (Checkpoint 6C — UX đơn giản hóa).

 Mỗi card MỘT primary action theo trạng thái automation:
   Chưa có thao tác          → [Tạo Automation]
   Đang thiết lập (dở dang)  → [Tiếp tục Automation]
   Đã Generate               → [Xem Automation]

 Hiển thị: Kết quả mong đợi + trạng thái tự động hóa (3 nhãn) + số thao tác.
 KHÔNG hiển thị thuật ngữ ActionBlock/Binding/Segment.
*/

import { decisionLabel, automationDisplayStatus } from "../../utils/automationV3.js";

const STATUS_BADGE = {
    SELECTED: ["v3-badge--sel", "Đã chọn"],
    RECORDING: ["v3-badge--rec", "Đang nhập bản ghi"],
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
    active = false,
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
    const stepTotal = segments.reduce((sum, segment) => sum + (Number(segment?.stepCount) || (Array.isArray(segment?.steps) ? segment.steps.length : 0)), 0);
    const generated = testCase.generateStatus === "GENERATED";

    // 6C — primary action theo trạng thái automation (chỉ MỘT nút).
    let primary = null;
    if (generated) primary = { key: "view", label: "Xem Automation", danger: false, disabled: false };
    else if (segments.length > 0) primary = { key: "setup", label: "Tiếp tục Automation", danger: false, disabled: recordingActive };
    else primary = { key: "setup", label: "Tạo Automation", danger: false, disabled: recordingActive };

    // Mọi testcase trong workspace đều có menu `...` cho các thao tác phụ.
    // Thiết lập/xem và ghi lại không lặp trong menu: CTA chính trên card là
    // đường vào duy nhất cho Tạo/Tiếp tục/Xem Automation.
    const showMenu = true;
    const badge = STATUS_BADGE[status] ?? ["v3-badge--nosel", "Chưa chọn"];
    const expected = String(testCase.expectedResult ?? "").trim();

    return (
        <div
            className={[
                "v3-card",
                active ? "v3-card--active" : "",
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
                        {status !== "SELECTED" ? <span className={`v3-badge ${badge[0]}`}>{badge[1]}</span> : null}
                        <span className={`v3-badge ${DECISION_BADGE[decision] ?? "v3-badge--review"}`}>
                            {decisionLabel(decision)}
                        </span>
                    </div>
                    {expected ? (
                        <div className="v3-card__row v3-card__row--muted">
                            Kết quả mong đợi: {expected.length > 80 ? `${expected.slice(0, 80)}…` : expected}
                        </div>
                    ) : null}
                    <div className="v3-card__row v3-card__row--muted v3-card__status-line">
                        <span>{segments.length > 0 ? `${segSummary.confirmed}/${segSummary.total} thao tác${stepTotal > 0 ? ` · ${stepTotal} bước` : ""}` : "Chưa có thao tác"}</span>
                        <span>{automationDisplayStatus(testCase)}</span>
                        {testCase.generateStatus === "GENERATED" ? <span>Playwright đã sinh</span> : null}
                        {testCase.runStatus === "PASSED" ? <span className="v3-card__status--ok">✓ Passed</span> : null}
                        {testCase.runStatus === "FAILED" ? <span className="v3-card__status--fail">✕ Failed</span> : null}
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
                            aria-label={`Thao tác ${testCase.testCaseId}`}
                            aria-expanded={menuOpen}
                        >
                            ⋯
                        </button>
                        {menuOpen ? (
                            <div className="v3-menu__pop">
                                {decision === "MANUAL_ONLY" ? (
                                    <div role="button" tabIndex={0} onClick={() => onMenuAction?.("decision_automated", testCase)}>
                                        Cho phép tự động hóa
                                    </div>
                                ) : (
                                    <div role="button" tabIndex={0} onClick={() => onMenuAction?.("decision_manual", testCase)}>
                                        Đánh dấu chỉ kiểm thử thủ công
                                    </div>
                                )}
                                <div className="danger" role="button" tabIndex={0} onClick={() => onMenuAction?.("remove_from_workspace", testCase)}>
                                    Loại khỏi workspace
                                </div>
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
