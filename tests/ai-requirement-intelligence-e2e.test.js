import "dotenv/config";
import assert from "node:assert/strict";
import RequirementLoader from "../src/loaders/RequirementLoader.js";
import MarkdownParser from "../src/parsers/MarkdownParser.js";
import RequirementIntelligenceInput from "../src/models/RequirementIntelligenceInput.js";
import AIRequirementIntelligenceEngine from "../src/engines/AIRequirementIntelligenceEngine.js";

if (
    process.env.ENABLE_AI !== "true" ||
    String(process.env.AI_PROVIDER).toLowerCase() !== "gemini" ||
    process.env.AI_FALLBACK_ENABLED !== "false"
) {
    throw new Error(
        "Run with ENABLE_AI=true AI_PROVIDER=gemini AI_FALLBACK_ENABLED=false."
    );
}

const markdown = new RequirementLoader().load("./requirements/thiet-bi.md");
const requirement = new MarkdownParser().parse(markdown);
const input = new RequirementIntelligenceInput({
    requirement,
    approvedRequirement: { approvalStatus: "approved", requirement },
    clarifications: [
        {
            questionId: "CL001",
            category: "Business Rule",
            priority: "High",
            question: "Khi không nhập điều kiện tìm kiếm, hệ thống xử lý thế nào?",
            reason: "BR18 nêu hai hành vi thay thế.",
            options: ["Hiển thị toàn bộ dữ liệu", "Yêu cầu nhập điều kiện"],
            answer: "Hiển thị toàn bộ dữ liệu",
            status: "answered",
            answeredAt: new Date().toISOString(),
            answeredBy: "e2e-reviewer"
        }
    ]
});
const result = await new AIRequirementIntelligenceEngine().analyze(input);
assert.equal(result.status, "SUCCESS");
assert.equal(result.source, "gemini");
assert.ok(result.knowledge.module);
assert.ok(result.knowledge.functions.length > 0);
assert.match(
    JSON.stringify(result.knowledge.toJSON()).toLowerCase(),
    /hiển thị toàn bộ dữ liệu/
);
console.log(JSON.stringify(result.knowledge.toJSON(), null, 2));
