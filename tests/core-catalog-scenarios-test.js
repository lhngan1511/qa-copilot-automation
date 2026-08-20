import assert from "node:assert/strict";
import fs from "node:fs";
import MarkdownParser from "../src/parsers/MarkdownParser.js";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";
import QACopilot from "../src/QACopilot.js";
import CoreCatalogScenarioBuilder from "../src/recommenders/CoreCatalogScenarioBuilder.js";

const markdown = fs.readFileSync(
    "./data/uploads/danh-muc-don-vi-tinh-1785218218763-bf406277.md",
    "utf8"
);
const requirement = new MarkdownParser().parse(markdown);
const knowledge = new RequirementKnowledgeMapper().map({
    approvedArtifact: {
        approvalStatus: "approved",
        requirement,
        questions: [
            {
                questionId: "CL001",
                category: "Business Rule",
                question: "Mã đơn vị tính có bắt buộc phải duy nhất trong hệ thống không?",
                targetField: "Mã đơn vị tính",
                answer: "Có",
                status: "answered"
            },
            {
                questionId: "CL002",
                category: "Business Rule",
                question: "Có được phép xóa đơn vị tính đang được sử dụng trong các chức năng khác không?",
                answer: "Không",
                status: "answered"
            },
            {
                questionId: "CL004",
                category: "Permission",
                question: "Những vai trò nào được quyền thực hiện thêm, sửa, xóa đơn vị tính?",
                answer: "Quản trị",
                status: "answered"
            }
        ]
    }
});

assert.match(knowledge.businessRules.join(" | "), /Mã đơn vị tính phải là duy nhất/);
assert.match(knowledge.businessRules.join(" | "), /Không được phép xóa bản ghi đang được sử dụng/);
assert.match(knowledge.permissions.join(" | "), /Quản trị/);

const app = new QACopilot();
const recommended = app.scenarioRecommendationEngine
    .generate(knowledge, requirement)
    .map(scenario => ({ ...scenario }));
const core = recommended.filter(scenario => app.isCoreProductionScenario(scenario, knowledge));
const enriched = app.scenarioEnrichmentEngine.enrich({
    scenarios: core,
    requirement,
    knowledge
});
const scenarios = app.intelligenceScenarioGenerator.generate(enriched, requirement);
const generated = app.testCaseGenerator.generate(scenarios);
const overlap = app.semanticTestCaseOverlapResolver.resolve(generated, {
    approvedFunctions: knowledge.functions
});
const { testCases } = app.productionTestCaseQualityGate.apply(overlap, { requirement, knowledge });

const titles = testCases.map(item => item.title).join("\n");
assert.ok(
    testCases.some(item => /tìm kiếm/i.test(item.title) && /có kết quả/i.test(item.title)),
    `thiếu tìm kiếm có kết quả:\n${titles}`
);
assert.ok(
    testCases.some(item => /tìm kiếm/i.test(item.title) && /không có kết quả/i.test(item.title)),
    `thiếu tìm kiếm không có kết quả:\n${titles}`
);
assert.ok(
    testCases.some(item => /thêm/i.test(item.title) && /đầy đủ/i.test(item.title)),
    `thiếu thêm nhập đầy đủ thông tin:\n${titles}`
);
assert.ok(
    testCases.some(
        item =>
            item.ruleClassification === "AUTO_GENERATED" ||
            /không nhập mã|để trống.*mã|tự sinh/i.test(item.title)
    ),
    `thiếu thêm không nhập mã:\n${titles}`
);

const prompt = fs.readFileSync("./src/providers/GeminiProvider.js", "utf8");
assert.match(prompt, /CATALOG BẮT BUỘC/);
assert.match(prompt, /không tìm thấy dữ liệu phù hợp/);
assert.match(prompt, /Khi mã được để trống, hệ thống tự sinh mã/);

const builder = new CoreCatalogScenarioBuilder();
const grouped = [
    {
        title: "Tìm kiếm đơn vị tính",
        type: "POSITIVE",
        feature: "Tìm kiếm đơn vị tính",
        functionName: "Tìm kiếm đơn vị tính"
    },
    {
        title: "Kiểm tra ngoại lệ của Tìm kiếm đơn vị tính",
        type: "EXCEPTION",
        feature: "Tìm kiếm đơn vị tính",
        functionName: "Tìm kiếm đơn vị tính",
        sourceItems: [{ content: "Không tìm thấy dữ liệu phù hợp", source: "EXCEPTION" }]
    },
    {
        title: "Thêm mới đơn vị tính",
        type: "POSITIVE",
        feature: "Thêm mới đơn vị tính",
        functionName: "Thêm mới đơn vị tính"
    }
];
const weakRequirement = {
    module: { name: "Danh mục đơn vị tính" },
    commonInputs: [{ name: "Mã đơn vị tính", required: false, description: "Không bắt buộc" }],
    features: [
        { name: "Tìm kiếm đơn vị tính", automation: { operation: "Search" }, exceptions: ["Không tìm thấy dữ liệu phù hợp"] },
        {
            name: "Thêm mới đơn vị tính",
            automation: { operation: "Create" },
            inputs: [{ name: "Mã đơn vị tính", required: false, description: "Không bắt buộc" }]
        }
    ]
};
const weakKnowledge = {
    module: { name: "Danh mục đơn vị tính" },
    functions: [
        { id: "F1", name: "Tìm kiếm đơn vị tính" },
        { id: "F2", name: "Thêm mới đơn vị tính" }
    ]
};
const filled = builder.apply(grouped, weakKnowledge, weakRequirement);
assert.ok(
    filled.some(item => item.catalogKey === "SEARCH_MISS"),
    "ngoại lệ nhóm không được thay cho testcase tìm không có kết quả"
);
assert.ok(
    filled.some(item => item.catalogKey === "CREATE_AUTO_CODE"),
    "mã không bắt buộc phải sinh case thêm khi không nhập mã, kể cả khi chưa có rule tự sinh"
);

console.log("Core catalog scenarios test: PASS");
