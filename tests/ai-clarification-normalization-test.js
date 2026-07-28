import assert from "node:assert/strict";

import AIAnalysisEngine from "../src/engines/AIAnalysisEngine.js";
import ClarificationQuestion from "../src/models/ClarificationQuestion.js";

const fakeProvider = {
    async generate() {
        throw new Error("Network access is not expected in this test.");
    }
};
const engine = new AIAnalysisEngine(fakeProvider);
const structuredInput = {
    id: "CL100",
    category: "Business Rule",
    priority: "High",
    question: "Khi nào dữ liệu được phép lưu?",
    reason: "Câu trả lời quyết định expected result.",
    options: ["Khi hợp lệ", "Luôn lưu", "Chưa xác định"]
};

assert.deepEqual(engine.normalizeClarificationQuestions([structuredInput]), [
    structuredInput
]);

assert.deepEqual(
    engine.normalizeClarificationQuestions(["Có cần xác nhận trước khi xóa không?"]),
    [
        {
            id: "CL001",
            category: "General",
            priority: "Medium",
            question: "Có cần xác nhận trước khi xóa không?",
            reason: "",
            options: ["Có", "Không", "Chưa xác định"]
        }
    ]
);

const mixed = engine.normalizeClarificationQuestions([
    structuredInput,
    "Có giới hạn số lần thử không?"
]);

assert.equal(mixed.length, 2);
assert.equal(mixed[0].id, "CL100");
assert.equal(mixed[1].id, "CL002");
assert.deepEqual(engine.normalizeClarificationQuestions(null), []);
assert.deepEqual(engine.normalizeClarificationQuestions("question"), []);
assert.deepEqual(engine.normalizeClarificationQuestions([null, 42, {}]), []);

const missingId = engine.normalizeClarificationQuestions([
    {
        question: "Trường này có bắt buộc không?",
        options: ["Có", "Không"]
    }
]);

assert.equal(missingId[0].id, "CL001");

const duplicateIds = engine.normalizeClarificationQuestions([
    {
        id: "CL010",
        question: "Câu hỏi thứ nhất?",
        options: ["Có", "Không"]
    },
    {
        id: "CL010",
        question: "Câu hỏi thứ hai?",
        options: ["Có", "Không"]
    }
]);

assert.equal(duplicateIds[0].id, "CL010");
assert.equal(duplicateIds[1].id, "CL002");

const defaultOptions = engine.normalizeClarificationQuestions([
    {
        id: "CL020",
        question: "Có áp dụng quy tắc không?",
        options: ["Có"]
    }
]);

assert.deepEqual(defaultOptions[0].options, ["Có", "Không", "Chưa xác định"]);

const duplicateOptions = engine.normalizeClarificationQuestions([
    {
        id: "CL021",
        question: "Chọn cách xử lý?",
        options: [" Có ", "Có", "Không", "", "Không"]
    }
]);

assert.deepEqual(duplicateOptions[0].options, ["Có", "Không"]);

const moreThanFive = engine.normalizeClarificationQuestions(
    Array.from({ length: 7 }, (_, index) => `Câu hỏi ${index + 1}?`)
);

assert.equal(moreThanFive.length, 5);

const immutableInput = [
    {
        id: " CL030 ",
        question: " Câu hỏi không bị sửa? ",
        options: [" Có ", "Không"]
    }
];
const immutableSnapshot = JSON.stringify(immutableInput);

engine.normalizeClarificationQuestions(immutableInput);
assert.equal(JSON.stringify(immutableInput), immutableSnapshot);

const promptBuilderCalls = [];
const injectedPromptBuilder = {
    build(requirement) {
        promptBuilderCalls.push(requirement);
        return "INJECTED PROMPT";
    }
};
const injectedEngine = new AIAnalysisEngine(fakeProvider, {
    promptBuilder: injectedPromptBuilder
});
const promptRequirement = {
    module: "Khách hàng"
};

assert.equal(injectedEngine.buildPrompt(promptRequirement), "INJECTED PROMPT");
assert.deepEqual(promptBuilderCalls, [promptRequirement]);

const analysisResult = engine.buildAnalysisResult(
    {
        featureUnderstanding: "Hiểu requirement",
        testFocus: ["Validation"],
        riskAreas: ["Dữ liệu"],
        suggestedScenarios: [
            {
                feature: "Tạo khách hàng",
                title: "Tạo khách hàng thành công",
                type: "POSITIVE"
            }
        ],
        questions: [
            structuredInput,
            "Có cần xác nhận không?"
        ],
        notes: ["Ghi chú"],
        confidence: 0.9
    },
    {
        module: "Khách hàng",
        features: [
            {
                name: "Tạo khách hàng"
            }
        ]
    }
);

assert.equal(typeof analysisResult.questions[0], "object");
assert.equal(analysisResult.questions[0].category, "Business Rule");
assert.equal(analysisResult.questions[0].priority, "High");
assert.equal(
    analysisResult.questions[0].reason,
    "Câu trả lời quyết định expected result."
);
assert.deepEqual(
    analysisResult.questions[0].options,
    ["Khi hợp lệ", "Luôn lưu", "Chưa xác định"]
);

const fallbackResult = engine.fallbackAnalysis({
    module: "Khách hàng",
    feature: "Khách hàng",
    questions: ["Có cần xác nhận không?"]
});

assert.deepEqual(fallbackResult.questions[0], {
    id: "CL001",
    category: "General",
    priority: "Medium",
    question: "Có cần xác nhận không?",
    reason: "",
    options: ["Có", "Không", "Chưa xác định"]
});

[
    ...mixed,
    ...missingId,
    ...duplicateIds,
    ...defaultOptions,
    ...duplicateOptions,
    ...moreThanFive,
    ...analysisResult.questions,
    ...fallbackResult.questions
].forEach(question => {
    assert.equal(ClarificationQuestion.from(question)?.isValid(), true);
});

console.log("AI clarification normalization test PASSED");
