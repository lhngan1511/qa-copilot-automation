import { renderStep } from "./rendererV3.js";

/*
 rendererBoundaryStandalone — Kiểm thử biên (Boundary Testing), HOÀN TOÀN độc lập với
 rendererV3/GenerateService/Automation Workspace. Không có khái niệm business-field/testData —
 chỉ replay ĐÚNG các bước đã dán (literal), đổi giá trị của đúng 1 bước được đánh dấu.

 Sinh 1 file .spec.js chứa N test() — mỗi candidate 1 test, dùng lại `renderStep` (đã export sẵn
 từ rendererV3.js) cho từng actionType, nhưng LUÔN truyền `fillStatus` tường minh cho MỌI bước
 FILL (kể cả các bước không phải mục tiêu) để renderStep bỏ qua hoàn toàn việc resolve
 business-field và chỉ inline literal giá trị được chỉ định — xem rendererV3.js renderStep, case
 FILL: có `fillStatus` truyền vào thì `resolveFillStatus` không bao giờ chạy; `testDataMap: null`
 khiến nó luôn inline literal thay vì tham chiếu `testData[...]`.

 Mỗi test() được đặt title = đúng candidate.id để bên thực thi khớp kết quả 1-1 theo id.
*/

/** Giá trị literal dùng để fill 1 bước khi replay: bước mục tiêu -> giá trị candidate; bước FILL
 *  nhạy cảm khác (Mật khẩu/Mã xác nhận... đã bị redact "REDACTED" lúc parse) -> giá trị tester
 *  nhập lại (sensitiveOverrides); bước FILL thường khác -> đúng giá trị đã ghi trong script gốc. */
function resolveLiteralValue(step, { isTarget, candidateValue, sensitiveOverrides }) {
    if (isTarget) return String(candidateValue ?? "");
    if (step.sensitive) return String(sensitiveOverrides?.[step.order] ?? "");
    return String(step.recordedValue ?? "");
}

function renderOneTest({ steps, assertions, targetStep, sensitiveOverrides, candidate }) {
    const lines = [];
    for (const step of steps) {
        const isTarget = targetStep && step.order === targetStep.order;
        if (String(step.actionType).toUpperCase() === "FILL") {
            const value = resolveLiteralValue(step, { isTarget, candidateValue: candidate.value, sensitiveOverrides });
            const r = renderStep(step, {
                testDataMap: null,
                fillStatus: { status: "VALUE", value, businessField: step.target || step.locator, source: isTarget ? "BOUNDARY_CANDIDATE" : "RECORDED", bound: true }
            });
            if (r.line) lines.push(r.line);
        } else {
            const r = renderStep(step, {});
            if (r.line) lines.push(r.line);
        }
    }
    for (const a of assertions ?? []) {
        if (a?.statement) lines.push(`  await ${a.statement};`);
    }
    return lines;
}

/**
 * @param {object} o
 * @param {Array} o.steps        RecordingStep[] từ parseRecording (nguyên vẹn, đã lọc EXCLUDE nếu có)
 * @param {Array} o.assertions   RecordingAssertion[] từ parseRecording — replay y nguyên statement
 * @param {object} o.targetStep  { order, locator, target } — bước FILL đang kiểm thử biên
 * @param {object} o.sensitiveOverrides  { [order]: value } — giá trị thật cho FILL nhạy cảm khác
 * @param {Array} o.candidates   [{ id, value }]
 * @param {string} o.label       tên hiển thị (đưa vào title describe cho dễ đọc mã sinh ra)
 */
export function renderStandaloneBoundarySpec({ steps, assertions = [], targetStep, sensitiveOverrides = {}, candidates, label = "" }) {
    if (!targetStep) {
        return { ok: false, errorCode: "BOUNDARY_TARGET_NOT_SET", reason: "Chưa đánh dấu bước cần kiểm thử biên." };
    }
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return { ok: false, errorCode: "BOUNDARY_NO_CANDIDATES", reason: "Danh sách giá trị biên trống." };
    }
    // Mọi FILL nhạy cảm KHÁC mục tiêu bắt buộc phải có giá trị thật tester nhập lại — nếu không,
    // mọi test sẽ fail sai lý do (vd sai mật khẩu) thay vì đúng vì giá trị biên đang kiểm thử.
    const missingOverride = (steps ?? []).find(s =>
        String(s.actionType).toUpperCase() === "FILL" && s.sensitive && s.order !== targetStep.order
        && !String(sensitiveOverrides?.[s.order] ?? "").trim()
    );
    if (missingOverride) {
        return {
            ok: false,
            errorCode: "BOUNDARY_SENSITIVE_VALUE_REQUIRED",
            reason: `Bước "${missingOverride.target}" là trường nhạy cảm (đã bị ẩn khi dán script) — cần nhập giá trị thật để dùng cho mọi lần chạy trước khi tiếp tục.`
        };
    }

    const specLines = [`import { test, expect } from '@playwright/test';`];
    const describeTitle = `Kiểm thử biên${label ? `: ${label}` : ""}`;
    specLines.push(`test.describe(${JSON.stringify(describeTitle)}, () => {`);
    for (const candidate of candidates) {
        specLines.push(`test(${JSON.stringify(candidate.id)}, async ({ page }) => {`);
        specLines.push(...renderOneTest({ steps, assertions, targetStep, sensitiveOverrides, candidate }));
        specLines.push(`});`);
    }
    specLines.push(`});`);

    return { ok: true, code: specLines.join("\n") };
}
