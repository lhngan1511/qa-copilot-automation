/**
 * AIAutomationMapper — Giai đoạn 1: AI Mapping.
 *
 * Nhận provider (GeminiProvider production / FakeAIProvider test) qua constructor/DI.
 * Nhận testcase TC001 + Playwright Codegen + Confirmed Facts,
 * gọi provider.generate(prompt) -> parse JSON mapping theo schema,
 * rồi VALIDATE: mọi locator phải xuất hiện trong Codegen source.
 *
 * KHÔNG hardcode response. KHÔNG có runtime fallback thành fake.
 */
import {
    buildCodegenLocatorSet,
    isLocatorInCodegen,
    loadCodegenText
} from "./locatorValidation.js";

const SCHEMA = {
    testCaseId: "string",
    route: "object",
    stepMappings: "array",
    assertionMappings: "array",
    missingData: "array",
    warnings: "array"
};

/** Tách JSON từ chuỗi Gemini (bỏ code fence nếu có). */
export function extractJson(text) {
    const t = String(text ?? "").trim();
    // bỏ ```json ... ```
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fence ? fence[1].trim() : t;
    try {
        return JSON.parse(candidate);
    } catch {
        // tìm { đầu tiên .. } cuối cùng
        const start = candidate.indexOf("{");
        const end = candidate.lastIndexOf("}");
        if (start !== -1 && end > start) {
            try {
                return JSON.parse(candidate.slice(start, end + 1));
            } catch {
                /* fallthrough */
            }
        }
        throw new Error("Gemini trả về nội dung không phải JSON mapping hợp lệ.");
    }
}

/** Đơn giản hóa mapping: chuẩn hóa locator + gắn codegenSource. */
function decorate(mapping, codegenLocatorSet) {
    const stepMappings = (mapping.stepMappings ?? []).map((s) => ({
        ...s,
        locator: s.locator ?? "",
        codegenSource: isLocatorInCodegen(s.locator, codegenLocatorSet)
            ? "PLAYWRIGHT_CODEGEN"
            : "NOT_IN_CODEGEN"
    }));
    return { ...mapping, stepMappings };
}

export default class AIAutomationMapper {
    /**
     * @param {object} aiProvider  provider có async generate(prompt) -> string
     * @param {object} [opts]
     * @param {string|null} [opts.codegenFile]
     * @param {string|null} [opts.codegenText]
     */
    constructor(aiProvider, { codegenFile = null, codegenText = null } = {}) {
        if (!aiProvider || typeof aiProvider.generate !== "function") {
            throw new Error("AIAutomationMapper cần aiProvider có generate(prompt).");
        }
        this.aiProvider = aiProvider;
        this.codegenFile = codegenFile;
        this.codegenText = codegenText;
    }

    buildPrompt({ testCase, codegenText, confirmedFacts }) {
        return [
            "Bạn là chuyên gia Playwright automation. Hãy map testcase sang locator thật từ Playwright Codegen.",
            "Chỉ dùng locator CÓ TRONG Codegen. Không tự bịa locator.",
            "Map theo NGỮ NGHĨA, không theo keyword đơn thuần.",
            "",
            "=== TESTCASE (approved) ===",
            JSON.stringify(testCase, null, 2),
            "",
            "=== PLAYWRIGHT CODEGEN (thật) ===",
            codegenText,
            "",
            "=== CONFIRMED FACTS ===",
            JSON.stringify(confirmedFacts ?? [], null, 2),
            "",
            "=== YÊU CẦU OUTPUT ===",
            'Trả về DUY NHẤT JSON có cấu trúc:',
            '{',
            '  "testCaseId": "TC001",',
            '  "route": { "source": "PLAYWRIGHT_CODEGEN|CONFIRMED_FACT|NEED_USER_CONFIRMATION", "value": "<route>", "status": "MAPPED|NEED_USER_CONFIRMATION" },',
            '  "stepMappings": [ { "stepOrder": 1, "businessStep": "<nghiệp vụ>", "actionType": "FILL|CLICK|SELECT|GOTO", "locator": "page.getByRole(...)", "codegenSource": "PLAYWRIGHT_CODEGEN|NOT_IN_CODEGEN", "confidence": 0.0-1.0, "status": "MAPPED|NEED_USER_CONFIRMATION|CONFLICTED", "reason": "" } ],',
            '  "assertionMappings": [ { "businessExpectation": "", "playwrightAssertion": "expect(...).toBeVisible()", "codegenSource": "PLAYWRIGHT_CODEGEN|NOT_IN_CODEGEN", "confidence": 0.0-1.0, "status": "MAPPED|NEED_USER_CONFIRMATION" } ],',
            '  "missingData": [],',
            '  "warnings": []',
            "}",
            "Mọi locator phải xuất hiện trong Codegen. Nếu không chắc, status = NEED_USER_CONFIRMATION."
        ].join("\n");
    }

    /** Parse JSON từ response và đánh dấu locator không có trong codegen. */
    parseAndValidate(text, codegenLocatorSet) {
        const mapping = extractJson(text);
        // validate schema tối thiểu
        if (!mapping || typeof mapping !== "object") {
            throw new Error("Mapping không phải object.");
        }
        const warnings = Array.isArray(mapping.warnings) ? mapping.warnings : [];
        const stepMappings = (mapping.stepMappings ?? []).map((s) => {
            const inCodegen = isLocatorInCodegen(s.locator, codegenLocatorSet);
            if (!inCodegen && s.locator) {
                warnings.push(
                    `step ${s.stepOrder}: locator "${s.locator}" KHÔNG có trong Codegen → bị loại/chuyển NEED_USER_CONFIRMATION.`
                );
            }
            return {
                ...s,
                codegenSource: inCodegen ? "PLAYWRIGHT_CODEGEN" : "NOT_IN_CODEGEN",
                status: inCodegen ? s.status : "NEED_USER_CONFIRMATION"
            };
        });
        return {
            ...mapping,
            testCaseId: mapping.testCaseId,
            stepMappings,
            warnings
        };
    }

    /**
     * Chạy AI Mapping.
     * @returns {Promise<object>} mapping JSON đã parse + validate.
     */
    async map({ testCase, codegenFile = null, codegenText = null, confirmedFacts = [] }) {
        const text = loadCodegenText({ codegenText, codegenFile: codegenFile ?? this.codegenFile });
        if (!text.trim()) {
            throw new Error("Thiếu Playwright Codegen — không thể AI Mapping.");
        }
        const codegenLocatorSet = buildCodegenLocatorSet(text);
        const prompt = this.buildPrompt({ testCase, codegenText: text, confirmedFacts });
        const response = await this.aiProvider.generate(prompt);
        const mapping = this.parseAndValidate(response, codegenLocatorSet);
        return mapping;
    }
}
