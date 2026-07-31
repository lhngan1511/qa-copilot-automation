import assert from "node:assert/strict";
import AIAnalysisEngine from "../src/engines/AIAnalysisEngine.js";
import ClarificationQuestion from "../src/models/ClarificationQuestion.js";

const fakeProvider = {
    async generate() {
        throw new Error("Network access is not expected in this test.");
    }
};
const engine = new AIAnalysisEngine(fakeProvider);

const normalized = engine.normalizeClarificationQuestions([
    {
        id: "CL100",
        category: "Boundary",
        priority: "High",
        question: "Độ dài tối đa của Mã thiết bị là bao nhiêu?",
        type: "FREE_TEXT",
        reason: "Tạo ca kiểm thử biên.",
        targetField: "Mã thiết bị",
        allowNotSpecified: true,
        options: ["Không hợp lệ"]
    },
    {
        id: "CL101",
        question: "MÃ THIẾT BỊ có tối đa bao nhiêu ký tự!!!",
        type: "FREE_TEXT",
        targetField: "mã thiết bị"
    },
    {
        id: "CL102",
        question: "Có cho phép xóa thiết bị đang sử dụng không?",
        type: "YES_NO",
        targetRule: "Xóa thiết bị đang sử dụng",
        allowNotSpecified: true
    },
    {
        id: "CL103",
        question: "Chọn trạng thái ban đầu",
        type: "SINGLE_CHOICE",
        targetField: "Trạng thái",
        options: ["Hoạt động", "Ngừng hoạt động"]
    },
    {
        id: "CL104",
        question: "Xác nhận giả định: mã thiết bị không phân biệt hoa thường?",
        type: "CONFIRM_ASSUMPTION",
        targetRule: "Tính duy nhất của mã thiết bị"
    }
]);

assert.equal(normalized.length, 4, "Equivalent target/fact questions must be deduplicated");
assert.equal(normalized[0].type, "FREE_TEXT");
assert.equal("options" in normalized[0], false);
assert.equal(normalized[1].type, "YES_NO");
assert.deepEqual(normalized[1].options, ["Có", "Không", "Requirement không đề cập"]);
assert.deepEqual(normalized[2].options, ["Hoạt động", "Ngừng hoạt động"]);
assert.deepEqual(normalized[3].options, ["Đúng", "Không đúng"]);

const punctuationDuplicates = engine.normalizeClarificationQuestions([
    "Ai được phép xóa thiết bị?",
    "AI ĐƯỢC PHÉP XÓA THIẾT BỊ!!!"
]);
assert.equal(punctuationDuplicates.length, 1);
assert.equal(punctuationDuplicates[0].type, "FREE_TEXT");

const duplicateIds = engine.normalizeClarificationQuestions([
    { id: "CL010", question: "Ai được sửa?", type: "FREE_TEXT" },
    { id: "CL010", question: "Ai được xóa?", type: "FREE_TEXT" }
]);
assert.equal(duplicateIds[0].id, "CL010");
assert.equal(duplicateIds[1].id, "CL002");

const moreThanFive = engine.normalizeClarificationQuestions(
    Array.from({ length: 7 }, (_, index) => ({
        question: `Giá trị cụ thể ${index + 1} là gì?`,
        type: "FREE_TEXT",
        targetField: `Field ${index + 1}`
    }))
);
assert.equal(moreThanFive.length, 5);

const legacy = engine.normalizeClarificationQuestions([
    {
        id: "CL020",
        question: "Có cần xác nhận không?",
        options: ["Có", "Không", "Chưa xác định"]
    }
]);
assert.equal(legacy[0].type, "YES_NO");
assert.equal(legacy[0].allowNotSpecified, true);

const fallbackResult = engine.fallbackAnalysis({
    module: "Khách hàng",
    questions: ["Ai được phép xóa khách hàng?"]
});
assert.equal(fallbackResult.questions[0].type, "FREE_TEXT");
assert.deepEqual(fallbackResult.questions[0].options ?? [], []);
assert.equal(fallbackResult.questions[0].allowNotSpecified, true);

const immutableInput = [{ id: "CL030", question: "Giá trị là gì?", type: "FREE_TEXT" }];
const immutableSnapshot = JSON.stringify(immutableInput);
engine.normalizeClarificationQuestions(immutableInput);
assert.equal(JSON.stringify(immutableInput), immutableSnapshot);

const analysisResult = engine.buildAnalysisResult({
    purpose: "Hiểu requirement",
    functions: [],
    risks: [],
    clarificationQuestions: normalized,
    requirementComplete: false
});
assert.equal(analysisResult.questions.length, 4);
analysisResult.questions.forEach(question => {
    assert.equal(ClarificationQuestion.from(question)?.isValid(), true);
});

console.log("AI clarification normalization test PASSED");
