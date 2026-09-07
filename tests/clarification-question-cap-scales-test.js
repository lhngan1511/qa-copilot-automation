import assert from "node:assert/strict";
import QACopilot from "../src/QACopilot.js";

/* Bug thật đã gặp (2026-09-04): normalizeClarificationItems() giới hạn CỨNG tối đa 5 câu hỏi làm rõ
   cho CẢ requirement, bất kể module có bao nhiêu operation/field. Module thật "DM đợt nhập học" có
   4 operation (Thêm/Sửa/Xóa/Tìm) — mỗi operation có thể có nhiều điểm cần làm rõ (field bắt buộc,
   business rule, placeholder "Chưa xác định"...), dễ vượt quá 5 điểm, khiến AI phải bỏ sót KHÔNG
   ĐOÁN TRƯỚC ĐƯỢC điểm nào bị rơi — thực tế: flow Sửa mất câu hỏi về placeholder trong khi flow Xóa
   lại lọt qua may rủi. Ngân chốt 2026-09-04: TĂNG ngưỡng theo số lượng function (Math.max(5, N*3))
   thay vì giữ số cố định — không giảm ngưỡng dưới 5 cho requirement nhỏ (giữ hành vi cũ). */

const qaCopilot = new QACopilot();

function questionsList(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `CLX${i}`,
        category: "Business Rule",
        question: `Câu hỏi làm rõ số ${i} — nội dung khác nhau để không bị coi trùng lặp`
    }));
}

// Requirement nhỏ (không có features, hoặc rất ít) -> giữ nguyên ngưỡng cũ = 5.
{
    const capped = qaCopilot.normalizeClarificationItems([questionsList(8)], { requirement: null });
    assert.equal(capped.length, 5, "requirement không rõ số function -> giữ ngưỡng mặc định 5");

    const smallRequirement = { features: [{ id: "F1" }, { id: "F2" }] };
    const cappedSmall = qaCopilot.normalizeClarificationItems([questionsList(8)], { requirement: smallRequirement });
    assert.equal(cappedSmall.length, 6, "2 function * 3 = 6 > sàn tối thiểu 5 -> ngưỡng dùng 6");
}

// Module 4 operation (giống thật "DM đợt nhập học": Thêm/Sửa/Xóa/Tìm) -> ngưỡng phải TĂNG lên 12
// (4 * 3), đủ chỗ cho nhiều điểm cần làm rõ hơn 5, không còn bị cắt cụt như bug thật đã gặp.
{
    const fourOperationRequirement = {
        features: [
            { id: "CREATE", name: "Thêm mới đợt nhập học" },
            { id: "UPDATE", name: "Sửa đợt nhập học" },
            { id: "DELETE", name: "Xóa đợt nhập học" },
            { id: "SEARCH", name: "Tìm kiếm đợt nhập học" }
        ]
    };
    const result = qaCopilot.normalizeClarificationItems([questionsList(10)], {
        requirement: fourOperationRequirement
    });
    assert.equal(
        qaCopilot.maxClarificationQuestions(fourOperationRequirement),
        12,
        "4 function * 3 = 12"
    );
    assert.equal(result.length, 10, "10 câu hỏi < ngưỡng 12 -> KHÔNG bị cắt mất câu nào");
}

// buildClarificationQuestions(knowledge, aiResult, requirement) phải truyền requirement xuống đúng
// ngưỡng động, không còn hardcode 5.
{
    const manyOperationRequirement = { features: Array.from({ length: 6 }, (_, i) => ({ id: `F${i}` })) };
    const built = qaCopilot.buildClarificationQuestions(
        { questions: questionsList(15) },
        { questions: [] },
        manyOperationRequirement
    );
    assert.equal(built.length, 15, "6 function * 3 = 18 >= 15 câu hỏi -> giữ đủ, không cắt");
}

console.log("Clarification question cap scales with function count test: PASS");
