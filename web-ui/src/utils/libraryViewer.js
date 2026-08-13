import { semanticStepText } from "./semanticSteps.js";
import { ACTION_LABEL } from "./automationV3.js";

/*
 P0 — ACTION LIBRARY VIEWER (pure helpers, render-level test không cần DOM/JSX).

 libraryStepDetail(step): step Library (DTO từ GET /api/codegen/library) → chi tiết
   viewer hiển thị. recordedValue giữ NGUYÊN như persisted (CASE 4 — không normalize/
   parameterize/che; giá trị nhạy cảm đã bị backend mask "••••" — security giữ).

 readableAssertion(a): assertion Library → câu readable (mirror V3RecordingPreparationPanel).
*/

/** Pure helper (render-level test): step Library → chi tiết viewer. */
export function libraryStepDetail(step) {
    const type = String(step?.actionType ?? "").toUpperCase();
    const recorded = step?.recordedValue === undefined || step?.recordedValue === null ? "" : String(step.recordedValue);
    return {
        order: step?.order ?? null,
        actionType: type,
        actionLabel: ACTION_LABEL[type] ?? type,
        semantic: semanticStepText(step),
        locator: String(step?.locator ?? ""),
        target: String(step?.target ?? ""),
        recordedValue: recorded,
        hasRecordedValue: recorded.trim() !== ""
    };
}

export function readableAssertion(a) {
    const matcher = String(a?.matcher ?? "");
    const target = a?.expected || (a?.locator ? String(a.locator).replace(/^page\./, "") : "phần tử");
    if (matcher === "toBeHidden") return `${target} không hiển thị`;
    if (matcher === "toHaveURL") return `URL = ${a.expected}`;
    if (matcher === "toHaveValue") return `${target} có giá trị ${a.expected}`;
    if (matcher === "toBeDisabled") return `${target} vô hiệu`;
    return `${target} hiển thị`;
}
