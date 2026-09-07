import assert from "node:assert/strict";
import MinimumTestCaseCountValidator from "../src/validators/MinimumTestCaseCountValidator.js";

/* Công thức chuẩn Ngân chốt 2026-09-04 — sanity check số testcase tối thiểu theo operation, không
   phụ thuộc module nào:
     Tìm kiếm 2 | Thêm mới 1+N+M | Sửa 1+N+M | Xóa 1+K | In ấn/Xuất Excel 4
   Dùng để phát hiện SỚM khi AI sinh thiếu testcase (gộp nhầm/rơi mất clarification/field không xác
   định được...) thay vì mặc định coi pipeline "đã xong" chỉ vì không có lỗi throw. */

const validator = new MinimumTestCaseCountValidator();

function testCaseFor(functionName, id) {
    return { id, function: functionName, feature: functionName };
}

// SEARCH: cần tối thiểu 2 (có kết quả + không có kết quả).
{
    const knowledge = {
        functions: [{ id: "SEARCH", name: "Tìm kiếm đợt nhập học", automation: { operation: "SEARCH" }, inputs: [] }]
    };
    const short = validator.validate(knowledge, [testCaseFor("Tìm kiếm đợt nhập học", "TC001")]);
    assert.equal(short.valid, false);
    assert.equal(short.deficits.length, 1);
    assert.equal(short.deficits[0].expectedMinimum, 2);
    assert.equal(short.deficits[0].actualCount, 1);

    const enough = validator.validate(knowledge, [
        testCaseFor("Tìm kiếm đợt nhập học", "TC001"),
        testCaseFor("Tìm kiếm đợt nhập học", "TC002")
    ]);
    assert.equal(enough.valid, true);
}

// CREATE: 1 (thành công) + N (field bắt buộc) + M (business rule riêng field).
{
    const knowledge = {
        functions: [{
            id: "CREATE",
            name: "Thêm mới đợt nhập học",
            automation: { operation: "CREATE" },
            inputs: [
                { name: "Mã đợt nhập học", required: true },
                { name: "Tên đợt nhập học", required: true },
                { name: "Ghi chú", required: false }
            ],
            businessRules: ["Mã đợt nhập học không được trùng"]
        }]
    };
    // minimum = 1 + 2 (required) + 1 (business rule) = 4
    const result = validator.validate(knowledge, [
        testCaseFor("Thêm mới đợt nhập học", "TC001"),
        testCaseFor("Thêm mới đợt nhập học", "TC002")
    ]);
    assert.equal(result.deficits[0].expectedMinimum, 4);
    assert.equal(result.deficits[0].breakdown.requiredFieldCount, 2);
    assert.equal(result.deficits[0].breakdown.businessRuleCount, 1);
}

// DELETE: 1 + K (điều kiện chặn xóa từ businessRules/exceptions).
{
    const knowledge = {
        functions: [{
            id: "DELETE",
            name: "Xóa đợt nhập học",
            automation: { operation: "DELETE" },
            inputs: [],
            businessRules: ["Không được phép xóa bản ghi đang được sử dụng"],
            exceptions: []
        }]
    };
    const result = validator.validate(knowledge, [testCaseFor("Xóa đợt nhập học", "TC001")]);
    assert.equal(result.deficits[0].expectedMinimum, 2); // 1 + 1 điều kiện chặn
}

// Testcase gộp (dedupe ở tầng hiển thị) có `function` là CHUỖI GỘP "A, B, C" -> phải tính vào CẢ 3
// function liên quan, không bị coi là "không thuộc function nào" (bug thật sẽ gây báo sai deficit).
{
    const knowledge = {
        functions: [
            { id: "CREATE", name: "Thêm mới đợt nhập học", automation: { operation: "CREATE" }, inputs: [] },
            { id: "UPDATE", name: "Sửa đợt nhập học", automation: { operation: "UPDATE" }, inputs: [] },
            { id: "DELETE", name: "Xóa đợt nhập học", automation: { operation: "DELETE" }, inputs: [] }
        ]
    };
    const merged = {
        id: "TC009",
        function: "Thêm mới đợt nhập học, Sửa đợt nhập học, Xóa đợt nhập học",
        feature: "Thêm mới đợt nhập học, Sửa đợt nhập học, Xóa đợt nhập học"
    };
    const result = validator.validate(knowledge, [merged]);
    const byName = name => result.perFunction.find(item => item.function === name);
    assert.equal(byName("Thêm mới đợt nhập học").actualCount, 1);
    assert.equal(byName("Sửa đợt nhập học").actualCount, 1);
    assert.equal(byName("Xóa đợt nhập học").actualCount, 1);
}

// VIEW (In ấn/Xuất Excel, chưa phân biệt được từ operation hiện có) -> minimum 4.
{
    const knowledge = {
        functions: [{ id: "EXPORT", name: "Xuất Excel danh sách", automation: { operation: "VIEW" }, inputs: [] }]
    };
    const result = validator.validate(knowledge, []);
    assert.equal(result.deficits[0].expectedMinimum, 4);
}

console.log("MinimumTestCaseCountValidator test: PASS");
