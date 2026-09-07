import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";
import QACopilot from "../src/QACopilot.js";

/* Bug thật đã gặp (2026-09-04, real screenshot): 2 dạng câu hỏi Yes/No mà unwrapYesNoQuestion() (chỉ
   xử lý "<chủ ngữ> có <vị ngữ> không?") KHÔNG tháo được, rơi về nối thô "câu hỏi — Có" — hiển thị
   nguyên văn câu hỏi làm tiêu đề/kết quả mong đợi testcase CONFIRMED_FACT, đọc "vô lý":

   TC005: "Xác nhận kết quả hiển thị sau khi xóa là 'Đã xóa thành công các đợt nhập học' thay vì
   'Đã xóa thành công các đợt nhậ'" — dạng SO SÁNH 2 phương án trong ngoặc kép, không có "... không?".

   TC006: "Có quy tắc nào về việc không cho phép xóa đợt nhập học nếu đã có dữ liệu sinh viên phát
   sinh không?" — dạng CÂU HỎI TỒN TẠI ("có" là động từ đầu câu, không phải liên từ giữa câu — khiến
   unwrapYesNoQuestion tìm nhầm coIndex=0, chủ ngữ rỗng, luôn thất bại). */

const mapper = new RequirementKnowledgeMapper();

// TC005 — dạng so sánh 2 phương án trong ngoặc kép.
{
    const fact = mapper.composeClarificationFact({
        question:
            'Xác nhận kết quả hiển thị sau khi xóa là "Đã xóa thành công các đợt nhập học" thay vì "Đã xóa thành công các đợt nhậ"',
        answer: "Có"
    });
    assert.equal(fact, "Đã xóa thành công các đợt nhập học");
}

// TC006 — dạng câu hỏi tồn tại "Có [X] nào [mệnh đề] không?".
{
    const fact = mapper.composeClarificationFact({
        question:
            "Có quy tắc nào về việc không cho phép xóa đợt nhập học nếu đã có dữ liệu sinh viên phát sinh không?",
        answer: "Có"
    });
    assert.equal(fact, "Không cho phép xóa đợt nhập học nếu đã có dữ liệu sinh viên phát sinh.");
}

// Trả lời "Không" cho câu hỏi tồn tại -> nêu rõ KHÔNG có quy tắc đó, không được để trống/nối thô.
{
    const fact = mapper.composeClarificationFact({
        question: "Có quy tắc nào về việc giới hạn số lượng đợt nhập học cùng lúc không?",
        answer: "Không"
    });
    assert.equal(fact, "Không có quy tắc: giới hạn số lượng đợt nhập học cùng lúc.");
}

// KHÔNG được bắt nhầm 1 câu hỏi Yes/No BÌNH THƯỜNG chỉ vì tình cờ trích dẫn 1 giá trị trong ngoặc kép
// (không có từ khoá so sánh "thay vì"/"hay") — vẫn phải rơi về unwrapYesNoQuestion bình thường.
{
    const fact = mapper.composeClarificationFact({
        question: "Hệ thống có cho phép nhập ký tự đặc biệt như 'a/b' vào tên đợt nhập học không?",
        answer: "Có"
    });
    assert.notEqual(fact, "a/b", "không được lấy nhầm giá trị trích dẫn làm fact khi không phải câu hỏi so sánh 2 phương án");
    assert.match(fact, /cho phép/i);
}

// unwrapYesNoQuestion mẫu cũ ("<chủ ngữ> có <vị ngữ> không?") vẫn phải hoạt động bình thường, không
// bị ảnh hưởng bởi 2 nhánh mới thêm.
{
    const fact = mapper.composeClarificationFact({
        question: "Hệ thống có phân biệt chữ hoa chữ thường khi tìm kiếm không?",
        answer: "Có"
    });
    assert.equal(fact, "Hệ thống phân biệt chữ hoa chữ thường khi tìm kiếm");
}

// QACopilot#isOracleConfirmationQuestion/extractOracleConfirmationText phải nhận diện đúng dạng "Xác
// nhận X là 'A' thay vì 'B'" (khác dạng mở "... là gì?" đã có từ trước) để consolidation
// (applyOracleConfirmationAnswers) hoạt động đúng cho TC005-style question.
{
    const qaCopilot = new QACopilot();
    const question = {
        question:
            'Xác nhận kết quả hiển thị sau khi xóa là "Đã xóa thành công các đợt nhập học" thay vì "Đã xóa thành công các đợt nhậ"',
        answer: "Có",
        status: "answered"
    };
    assert.equal(qaCopilot.isOracleConfirmationQuestion(question), true);
    assert.equal(qaCopilot.extractOracleConfirmationText(question), "Đã xóa thành công các đợt nhập học");

    // isAlreadyAppliedAsOracleConfirmation (RequirementKnowledgeMapper) phải khớp ĐÚNG giá trị đã
    // trích (không phải "Có" nguyên văn), để không sinh trùng confirmedFacts.
    const artifact = {
        requirement: {
            features: [{ id: "8", expectedResults: ["Đã xóa thành công các đợt nhập học"] }]
        }
    };
    assert.equal(mapper.isAlreadyAppliedAsOracleConfirmation(question, artifact), true);
}

console.log("Clarification fact sentence-shapes test: PASS");
