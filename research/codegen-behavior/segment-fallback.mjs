#!/usr/bin/env node
/**
 * Sprint 0b (fallback nghiên cứu, KHÔNG phải production).
 * Tạo Behavior Tree bằng rule heuristic để minh hoạ + validation trong sandbox
 * (Gemini thật BLOCKED_BY_NETWORK ở đây). KHÔNG dùng trong production.
 *
 * Phân đoạn dựa trên actionType + locator heuristic:
 *  - AUTHENTICATION: trước khi thấy dấu hiệu "vào hệ thống" (asset link / adminButton).
 *  - NAVIGATION: click menu/liên kết (locator role link/button "Danh mục","Đơn vị tính","Asset").
 *  - BUSINESS: fill + click Thêm mới/Cập nhật/Xóa/Tìm/Lưu.
 *  - ASSERTION: actionType === ASSERT.
 *  - REDUNDANT: PRESS CapsLock / FILL lặp không đổi / CLICK locator('button').first() / WAIT.
 *  - UNKNOWN: còn lại.
 *
 * Usage: node segment-fallback.mjs [actionsFile] [outputFile]
 */
import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function isAssertion(a) {
    return a.actionType === "ASSERT";
}

function isAuthBoundary(action, i, all) {
    // dấu hiệu đã vào hệ thống: click "Asset Quản lý trang thiết bị" hoặc expect adminButton
    const loc = action.locator ?? "";
    if (action.actionType === "CLICK" && loc.includes("Asset Quản lý trang thiết bị")) return true;
    if (isAssertion(action) && loc.includes("adminButton")) return true;
    return false;
}

function isNavigation(a) {
    const loc = a.locator ?? "";
    if (a.actionType !== "CLICK") return false;
    if (loc.includes("Danh mục") || loc.includes("Đơn vị tính") || loc.includes("Asset Quản lý trang thiết bị")) return true;
    return false;
}

function isRedundant(a) {
    if (a.actionType === "PRESS" && a.value && String(a.value).toLowerCase().includes("capslock")) return true;
    if (a.actionType === "WAIT" || a.actionType === "WAIT_FOR" || a.actionType === "GO_BACK") return true;
    if (a.actionType === "CLICK" && a.locator === "page.locator('button')") return true;
    return false;
}

function isBusiness(a) {
    const loc = a.locator ?? "";
    if (a.actionType === "FILL" || a.actionType === "DBLCLICK") return true;
    if (a.actionType === "CLICK" && (loc.includes("Thêm mới") || loc.includes("Cập nhật") || loc.includes("Xóa") || loc.includes("Tìm") || loc.includes("Sinh mã") || loc.includes("Hủy bỏ") || loc.includes("Xác nhận"))) return true;
    return false;
}

export function segment(actions) {
    const segments = [];
    let current = null;
    let phase = "AUTHENTICATION";
    let idx = 0;

    // tìm biên auth (index đầu tiên có dấu hiệu vào hệ thống)
    let authEnd = actions.findIndex((a, i) => isAuthBoundary(a, i, actions));

    const startSeg = (type, intent, action) => {
        current = {
            id: `SEG-${segments.length + 1}`,
            type,
            intent,
            screen: null,
            actions: [],
            sourceReferences: [],
            confidence: type === "UNKNOWN" ? 0.4 : 0.9,
            status: "DRAFT",
            reason: intent
        };
        segments.push(current);
    };

    for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        const loc = a.locator ?? "";
        let type;

        if (isAssertion(a)) type = "ASSERTION";
        else if (i <= authEnd || authEnd === -1 && phase === "AUTHENTICATION") type = "AUTHENTICATION";
        else if (isRedundant(a)) type = "REDUNDANT";
        else if (isNavigation(a)) type = "NAVIGATION";
        else if (isBusiness(a)) type = "BUSINESS";
        else type = "UNKNOWN";

        // cập nhật screen metadata heuristic
        let screen = null;
        if (type === "AUTHENTICATION") screen = "Login";
        else if (loc.includes("Đơn vị tính")) screen = "UnitOfMeasure";
        else if (loc.includes("Asset")) screen = "AssetModule";

        // Gom UNKNOWN xen trong 1 business flow vào segment hiện tại (không tách lẻ)
        if (type === "UNKNOWN" && current && current.type === "BUSINESS") {
            current.actions.push(a.index);
            current.sourceReferences.push(a.sourceReference);
            continue;
        }
        if (!current || current.type !== type) {
            // tách segment mới khi đổi loại
            startSeg(type, describeIntent(type, a), a);
        }
        current.actions.push(a.index);
        current.sourceReferences.push(a.sourceReference);
        if (screen) current.screen = screen;
    }

    return segments;
}

function describeIntent(type, a) {
    const loc = a.locator ?? "";
    switch (type) {
        case "AUTHENTICATION": return "đăng nhập hệ thống";
        case "NAVIGATION": return "điều hướng tới " + (loc.includes("Đơn vị tính") ? "Danh mục Đơn vị tính" : "màn hình");
        case "BUSINESS": return "thao tác nghiệp vụ " + (loc.includes("Thêm") ? "Thêm" : loc.includes("Cập nhật") ? "Cập nhật" : loc.includes("Xóa") ? "Xóa" : loc.includes("Tìm") ? "Tìm kiếm" : "");
        case "ASSERTION": return "kiểm tra kết quả";
        case "REDUNDANT": return "hành động thừa (lặp/back/wait)";
        default: return "hành động chưa xác định";
    }
}

// CLI
const actionsFile = process.argv[2] || path.join(process.cwd(), "outputs", "research", "codegen-behavior", "actions.json");
const outputFile = process.argv[3] || path.join(process.cwd(), "outputs", "research", "codegen-behavior", "behavior-tree.json");
const actionsJson = JSON.parse(fs.readFileSync(actionsFile, "utf8"));
const segments = segment(actionsJson.actions);
const tree = {
    sourceFile: actionsJson.sourceFile,
    generatedAt: new Date().toISOString(),
    segments,
    patternsProposed: []
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(tree, null, 2));
console.log(`Behavior Tree (fallback research): ${segments.length} segments -> ${outputFile}`);
segments.forEach((s) => console.log(`  ${s.id} ${s.type.padEnd(14)} actions=[${s.actions.join(",")}] screen=${s.screen ?? "-"}`));
