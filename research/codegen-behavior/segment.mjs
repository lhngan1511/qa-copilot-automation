#!/usr/bin/env node
/**
 * Sprint 0b — Behavior Tree (Gemini đề xuất).
 * Gemini nhận Action List (actions.json) → đề xuất segment:
 *   AUTHENTICATION / NAVIGATION / BUSINESS / ASSERTION / UNKNOWN / REDUNDANT
 * Mỗi segment: id, type, intent, screen (nếu xác định), actions, sourceReferences, confidence, status=DRAFT, reason.
 * Pattern chỉ vào patternsProposed (DRAFT) — KHÔNG tự tạo Reusable Flow chính thức.
 *
 * Usage: node segment.mjs [actionsFile] [outputFile]
 */
import fs from "node:fs";
import path from "node:path";
import AIProviderFactory from "../../src/providers/AIProviderFactory.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const MODULE = "Quản lý trang thiết bị / Asset";
const FEATURE = "Đơn vị tính";
const BUSINESS_FLOWS = [
    "ADD_UNIT_OF_MEASURE",
    "EDIT_UNIT_OF_MEASURE",
    "DELETE_UNIT_OF_MEASURE"
];

function buildPrompt(actionsJson) {
    return [
        "Bạn là chuyên gia Playwright automation. Phân tích danh sách hành động (Action List) trích từ Playwright Codegen.",
        `Module: ${MODULE}. Feature: ${FEATURE}.`,
        `Business flows cần phân biệt rõ: ${BUSINESS_FLOWS.join(", ")}.`,
        "Nhiệm vụ: phân đoạn thành Behavior Tree — mỗi segment là 1 nhóm hành động có cùng mục đích.",
        "Chỉ dùng index hành động CÓ TRONG Action List. KHÔNG tự thêm/xoá/sửa hành động.",
        "KHÔNG sinh code mới. KHÔNG đánh giá đúng/sai hành vi.",
        "",
        "=== ACTION LIST ===",
        JSON.stringify(actionsJson, null, 2),
        "",
        "=== YÊU CẦU OUTPUT (JSON thuần, không code) ===",
        "{",
        '  "segments": [',
        "    {",
        '      "id": "SEG-1",',
        '      "type": "AUTHENTICATION|NAVIGATION|BUSINESS|ASSERTION|UNKNOWN|REDUNDANT",',
        '      "intent": "mô tả mục đích ngắn gọn",',
        '      "screen": "tên màn hình, vd Login / UnitOfMeasureList / UnitOfMeasureForm; null nếu không rõ",',
        '      "actions": [1, 2, 3],',
        '      "sourceReferences": ["file#L1", "file#L2"],',
        '      "confidence": 0.0-1.0,',
        '      "status": "DRAFT",',
        '      "reason": "lý do phân loại"',
        "    }",
        "  ],",
        '  "patternsProposed": [',
        "    {",
        '      "name": "tên pattern vd search-device",',
        '      "type": "REUSABLE_FLOW",',
        '      "sourceReferences": ["file#L10"],',
        '      "status": "DRAFT",',
        '      "confidence": 0.0-1.0',
        "    }",
        "  ]",
        "}",
        "",
        "QUY TẮC PHÂN LOẠI (bắt buộc):",
        `- AUTHENTICATION: hành động trước khi vào hệ thống (goto /login, fill tk/mk/captcha, click Đăng nhập).`,
        `- NAVIGATION: chọn phân hệ Asset, mở Danh mục, mở Đơn vị tính. CHÚ Ý: click vào phân hệ Asset (action 16) là NAVIGATION, KHÔNG phải AUTHENTICATION.`,
        `- BUSINESS: chia rõ 3 flow: ADD_UNIT_OF_MEASURE (Thêm mới), EDIT_UNIT_OF_MEASURE (Cập nhật), DELETE_UNIT_OF_MEASURE (Xóa). Mỗi flow là 1 segment.`,
        `- ASSERTION: expect(...) — gắn vào business flow tương ứng nếu rõ.`,
        `- REDUNDANT/AMBIGUOUS: fill lặp (password 123456@...), press CapsLock, click locator('button').first(), thao tác thừa/nhiễu.`,
        `- UNKNOWN: chỉ dùng khi thực sự không đủ bằng chứng (vd popup 'Thành công', filter hasText, getByRole img).`,
        "- Tổng index trong mọi segment + pattern phải PHỦ đúng toàn bộ action trong Action List (không mất, không thêm)."
    ].join("\n");
}

// Đơn giản hóa response: đảm bảo status DRAFT, giữ sourceReferences
function normalize(parsed) {
    const segments = (parsed.segments ?? []).map((s) => ({
        id: s.id,
        type: s.type,
        intent: s.intent ?? "",
        screen: s.screen ?? null,
        actions: Array.isArray(s.actions) ? s.actions : [],
        sourceReferences: Array.isArray(s.sourceReferences) ? s.sourceReferences : [],
        confidence: s.confidence ?? 0,
        status: "DRAFT",
        reason: s.reason ?? ""
    }));
    const patterns = (parsed.patternsProposed ?? []).map((p) => ({
        name: p.name,
        type: p.type ?? "REUSABLE_FLOW",
        sourceReferences: Array.isArray(p.sourceReferences) ? p.sourceReferences : [],
        status: "DRAFT",
        confidence: p.confidence ?? 0
    }));
    return { segments, patternsProposed: patterns };
}

async function main() {
    const actionsFile = process.argv[2] || path.join(process.cwd(), "outputs", "research", "codegen-behavior", "actions.json");
    const outputFile = process.argv[3] || path.join(process.cwd(), "outputs", "research", "codegen-behavior", "behavior-tree.json");

    const actionsJson = JSON.parse(fs.readFileSync(actionsFile, "utf8"));
    const provider = AIProviderFactory.createProvider("gemini");
    const prompt = buildPrompt(actionsJson);
    const response = await provider.generate(prompt);

    // bỏ code fence nếu có
    let text = response.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(text);

    const tree = {
        module: MODULE,
        feature: FEATURE,
        businessFlows: BUSINESS_FLOWS,
        sourceFile: actionsJson.sourceFile,
        generatedAt: new Date().toISOString(),
        segments: normalize(parsed).segments,
        patternsProposed: normalize(parsed).patternsProposed
    };
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(tree, null, 2));
    console.log(`Behavior Tree: ${tree.segments.length} segments, ${tree.patternsProposed.length} patterns -> ${outputFile}`);
}

main().catch((e) => {
    console.error("LỖI:", e.message ?? e);
    process.exit(1);
});
