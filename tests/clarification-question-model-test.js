import assert from "node:assert/strict";
import ClarificationQuestion, {
    ClarificationQuestionType
} from "../src/models/ClarificationQuestion.js";
import testerFacingText from "../src/utils/TesterFacingText.js";

const freeText = ClarificationQuestion.from({
    id: "CL001",
    question: "Độ dài tối đa của Mã thiết bị là bao nhiêu?",
    type: "FREE_TEXT",
    targetField: "Mã thiết bị",
    reason: "Giá trị này tạo các ca kiểm thử biên.",
    allowNotSpecified: true,
    options: ["Không nên tồn tại"]
});
assert.deepEqual(freeText.toJSON(), {
    id: "CL001",
    category: "General",
    priority: "Medium",
    question: "Độ dài tối đa của Mã thiết bị là bao nhiêu?",
    type: "FREE_TEXT",
    reason: "Giá trị này tạo các ca kiểm thử biên.",
    allowNotSpecified: true,
    targetField: "Mã thiết bị"
});
assert.equal(freeText.isValid(), true);

const yesNo = ClarificationQuestion.from({
    id: "CL002",
    question: "Có cho phép xóa thiết bị đang được sử dụng không?",
    type: "YES_NO",
    targetRule: "Xóa thiết bị đang sử dụng",
    allowNotSpecified: true
});
assert.deepEqual(yesNo.options, ["Có", "Không", "Requirement không đề cập"]);

const choice = ClarificationQuestion.from({
    id: "CL003",
    question: "Trạng thái ban đầu là gì?",
    type: "SINGLE_CHOICE",
    targetField: "Trạng thái",
    options: [" Hoạt động ", "Ngừng hoạt động", "Hoạt động"]
});
assert.deepEqual(choice.options, ["Hoạt động", "Ngừng hoạt động"]);
assert.equal(choice.isValid(), true);

const assumption = ClarificationQuestion.from({
    id: "CL004",
    question: "Xác nhận giả định: mã thiết bị không phân biệt hoa thường?",
    type: ClarificationQuestionType.CONFIRM_ASSUMPTION,
    targetRule: "Tính duy nhất của mã thiết bị",
    allowNotSpecified: true
});
assert.deepEqual(assumption.options, ["Đúng", "Không đúng", "Requirement không đề cập"]);

const legacyString = ClarificationQuestion.from("Ai được phép xóa thiết bị?", "CL005");
assert.equal(legacyString.type, "FREE_TEXT");
assert.equal(legacyString.allowNotSpecified, true);
assert.deepEqual(legacyString.options, []);

const legacyOptions = ClarificationQuestion.from({
    id: "CL006",
    question: "Có cần xác nhận trước khi xóa không?",
    options: ["Có", "Không", "Chưa xác định"]
});
assert.equal(legacyOptions.type, "YES_NO");
assert.equal(legacyOptions.allowNotSpecified, true);
assert.deepEqual(legacyOptions.options, ["Có", "Không", "Requirement không đề cập"]);

assert.equal(ClarificationQuestion.from(null, "CL009"), null);
assert.equal(ClarificationQuestion.from("   ", "CL009"), null);
assert.equal(
    ClarificationQuestion.from({
        id: "CL010",
        question: "Chọn một giá trị",
        type: "SINGLE_CHOICE",
        options: ["Một"]
    }).type,
    "FREE_TEXT"
);

assert.equal(
    ClarificationQuestion.deduplicationKey({
        question: "Độ dài tối đa của Mã thiết bị là bao nhiêu?",
        type: "FREE_TEXT",
        targetField: "Mã thiết bị"
    }),
    ClarificationQuestion.deduplicationKey({
        question: "MÃ THIẾT BỊ có tối đa bao nhiêu ký tự!!!",
        type: "FREE_TEXT",
        targetField: "mã thiết bị"
    })
);

const testerFacing = ClarificationQuestion.from({
    id: "CL011",
    question: "BR05: Mã thiết bị có bắt buộc phải duy nhất không?",
    reason: "Rule-15: The testcase contains contradictory test data.",
    type: "YES_NO",
    options: ["FUNC001: Có", "MOD001: Không"]
});
assert.equal(testerFacing.question, "Mã thiết bị có bắt buộc phải duy nhất không?");
assert.equal(testerFacing.reason, "Một trường đang có hai giá trị kiểm thử khác nhau.");
assert.deepEqual(testerFacing.options, ["Có", "Không"]);
assert.equal(
    testerFacingText("Expected result mismatch."),
    "Kết quả mong đợi chưa phù hợp với tình huống kiểm thử."
);
assert.doesNotMatch(
    JSON.stringify(testerFacing.toJSON()),
    /BR05|FUNC001|MOD001|Rule-15|contradictory/i
);

console.log("ClarificationQuestion model test PASSED");
