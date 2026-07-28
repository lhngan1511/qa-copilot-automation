import assert from "node:assert/strict";

import ClarificationQuestion from "../src/models/ClarificationQuestion.js";

const defaultQuestion = new ClarificationQuestion();

assert.deepEqual(defaultQuestion.toJSON(), {
    id: "",
    category: "General",
    priority: "Medium",
    question: "",
    reason: "",
    options: []
});

const completeQuestion = new ClarificationQuestion({
    id: "CL001",
    category: "Business Rule",
    priority: "High",
    question: "Có cho phép xóa dữ liệu?",
    reason: "Cần xác định quy tắc xóa.",
    options: ["Có", "Không"]
});

assert.deepEqual(completeQuestion.toJSON(), {
    id: "CL001",
    category: "Business Rule",
    priority: "High",
    question: "Có cho phép xóa dữ liệu?",
    reason: "Cần xác định quy tắc xóa.",
    options: ["Có", "Không"]
});

const trimmedQuestion = new ClarificationQuestion({
    id: "  CL002  ",
    category: "  Validation  ",
    priority: "  Low  ",
    question: "  Trường này có bắt buộc không?  ",
    reason: "  Requirement chưa nêu rõ.  ",
    options: ["  Có  ", "", "Không", "Có", 123, "   "]
});

assert.equal(trimmedQuestion.id, "CL002");
assert.equal(trimmedQuestion.category, "Validation");
assert.equal(trimmedQuestion.priority, "Low");
assert.equal(trimmedQuestion.question, "Trường này có bắt buộc không?");
assert.equal(trimmedQuestion.reason, "Requirement chưa nêu rõ.");
assert.deepEqual(trimmedQuestion.options, ["Có", "Không"]);
assert.equal(trimmedQuestion.isValid(), true);

assert.equal(
    new ClarificationQuestion({
        question: "Câu hỏi",
        options: ["Có", "Không"]
    }).isValid(),
    false
);
assert.equal(
    new ClarificationQuestion({
        id: "CL003",
        options: ["Có", "Không"]
    }).isValid(),
    false
);
assert.equal(
    new ClarificationQuestion({
        id: "CL004",
        question: "Câu hỏi",
        options: ["Có"]
    }).isValid(),
    false
);

const legacyQuestion = ClarificationQuestion.from(
    "  Thiết bị đang sử dụng có được xóa không?  ",
    "CL005"
);

assert.deepEqual(legacyQuestion.toJSON(), {
    id: "CL005",
    category: "General",
    priority: "Medium",
    question: "Thiết bị đang sử dụng có được xóa không?",
    reason: "",
    options: ["Có", "Không", "Chưa xác định"]
});

const structuredQuestion = ClarificationQuestion.from({
    id: "CL006",
    category: "Permission",
    priority: "High",
    question: "Ai được phép xóa?",
    reason: "Thiếu mô tả phân quyền.",
    options: ["Quản trị viên", "Người dùng"]
});

assert.equal(structuredQuestion.id, "CL006");
assert.equal(structuredQuestion.category, "Permission");
assert.deepEqual(structuredQuestion.options, ["Quản trị viên", "Người dùng"]);

const fallbackIdQuestion = ClarificationQuestion.from(
    {
        question: "Có cần xác nhận không?",
        options: ["Có", "Không"]
    },
    "CL007"
);

assert.equal(fallbackIdQuestion.id, "CL007");

const defaultOptionsQuestion = ClarificationQuestion.from({
    id: "CL008",
    question: "Có áp dụng quy tắc này không?",
    options: ["Có"]
});

assert.deepEqual(defaultOptionsQuestion.options, ["Có", "Không", "Chưa xác định"]);

assert.equal(ClarificationQuestion.from(null, "CL009"), null);
assert.equal(ClarificationQuestion.from(undefined, "CL009"), null);
assert.equal(ClarificationQuestion.from(42, "CL009"), null);
assert.equal(ClarificationQuestion.from([], "CL009"), null);
assert.equal(ClarificationQuestion.from("   ", "CL009"), null);

const json = completeQuestion.toJSON();

assert.equal(Object.getPrototypeOf(json), Object.prototype);
assert.notEqual(json.options, completeQuestion.options);

console.log("ClarificationQuestion model test PASSED");
