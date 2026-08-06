/**
 * codegenSkeleton — Deterministic code builder cho Playwright spec.
 *
 * Khi AI vẫn trả code bị cắt cụt (truncated) sau tối đa 1 retry, KHÔNG gọi AI lần
 * thứ 3. Thay vào đó dựng spec có cấu trúc từ dữ liệu ĐÃ XÁC NHẬN:
 *   - import ES module;
 *   - test(...) tiêu đề chứa mã testcase;
 *   - page.goto(process.env.BASE_URL + route);
 *   - auth/navigation (nếu có) dùng locator approved;
 *   - business stepMappings dùng locator approved;
 *   - assertion dùng playwrightAssertion approved;
 *   - đóng `});`.
 * Không hardcode nghiệp vụ Đăng nhập — hoạt động tổng quát từ mapping.
 * Thuần ESM, không phụ thuộc Runner.
 */

const ACTION_LABEL = {
    FILL: "fill",
    CLICK: "click",
    SELECT: "selectOption",
    PRESS: "press",
    CHECK: "check",
    UNCHECK: "uncheck"
};

function isCredentialField(target) {
    const t = String(target ?? "").toLowerCase();
    if (/tài khoản|username|account/.test(t)) return "process.env.LOGIN_USERNAME";
    if (/mật khẩu|password/.test(t)) return "process.env.LOGIN_PASSWORD";
    if (/mã xác nhận|captcha/.test(t)) return "process.env.LOGIN_CAPTCHA";
    return null;
}

/** Lấy giá trị field từ testData theo target name. */
function fieldValue(testCase, target) {
    const fields = testCase?.testData?.fields;
    if (fields && typeof fields === "object") {
        const f = fields[target];
        if (f && typeof f === "object" && String(f.value ?? "").trim()) return String(f.value);
    }
    if (testCase?.testData?.inputs && typeof testCase.testData.inputs === "object") {
        const v = testCase.testData.inputs[target];
        if (v != null && String(v).trim()) return String(v);
    }
    return null;
}

/** Render 1 step (auth/nav/business) thành dòng Playwright. */
export function renderStepLine(st, { testCase = null } = {}) {
    const loc = String(st?.locator ?? "").trim();
    if (!loc) return null;
    const action = String(st?.actionType ?? "CLICK").toUpperCase();
    const target = String(st?.target ?? st?.businessStep ?? "");

    let value = null;
    if (action === "FILL") {
        value = isCredentialField(target) || fieldValue(testCase, target) || "dữ liệu kiểm thử";
    } else if (action === "PRESS") {
        value = "'Enter'";
    } else if (action === "SELECT") {
        value = fieldValue(testCase, target) || "'option'";
    }

    switch (action) {
        case "FILL":
            return `  await ${loc}.fill(${JSON.stringify(value)});`;
        case "PRESS":
            return `  await ${loc}.press(${value});`;
        case "SELECT":
            return `  await ${loc}.selectOption(${JSON.stringify(value)});`;
        case "CHECK":
            return `  await ${loc}.check();`;
        case "UNCHECK":
            return `  await ${loc}.uncheck();`;
        case "CLICK":
        default:
            return `  await ${loc}.click();`;
    }
}

/** Render setup prefix: entryRoute + authenticationSetup + navigationChain. */
export function setupPrefixLines(mapping) {
    const lines = [];
    const entryRoute = mapping?.entryRoute?.value;
    // Chỉ loại bỏ nếu là mô tả (chứa '->' hoặc '→'), KHÔNG loại URL path có dấu gạch (vd /danh-muc).
    if (entryRoute && !/->|→/.test(entryRoute)) {
        lines.push(`  await page.goto(process.env.BASE_URL + ${JSON.stringify(entryRoute)});`);
    }
    for (const st of mapping?.authenticationSetup?.steps ?? []) {
        const line = renderStepLine(st);
        if (line) lines.push(line);
    }
    for (const st of mapping?.navigationChain?.steps ?? []) {
        const line = renderStepLine(st);
        if (line) lines.push(line);
    }
    return lines;
}

/**
 * Dựng spec Playwright hoàn chỉnh từ mapping + testcase (deterministic).
 * @returns {string} code đã đóng `});`.
 */
export function buildSpecFromMapping({ testCase, mapping }) {
    const id = String(testCase?.id ?? testCase?.testcaseId ?? "TC");
    const title = `${id} - ${testCase?.title || testCase?.testScenario || "Automation"}`;
    const lines = [];
    lines.push(`import { test, expect } from '@playwright/test';`);
    lines.push(`test(${JSON.stringify(title)}, async ({ page }) => {`);

    lines.push(...setupPrefixLines(mapping));

    for (const st of mapping?.stepMappings ?? []) {
        const line = renderStepLine(st, { testCase });
        if (line) lines.push(line);
    }

    for (const a of mapping?.assertionMappings ?? []) {
        const expr = String(a?.playwrightAssertion ?? "").replace(/^await\s+/, "").trim();
        if (expr) lines.push(`  await ${expr};`);
    }

    lines.push(`});`);
    return lines.join("\n");
}
