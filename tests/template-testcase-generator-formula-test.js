import assert from "node:assert/strict";
import TemplateTestCaseGenerator from "../src/generators/TemplateTestCaseGenerator.js";

/* "Tạo testcase nhanh theo khuôn mẫu" (2026-09-04) — nguồn thứ 3 sinh testcase, THUẦN RULE-BASED,
   KHÔNG AI. Vì dữ liệu tường minh 100% (do người dùng nhập qua wizard), số lượng testcase sinh ra
   PHẢI KHỚP CHÍNH XÁC bảng công thức, không có ngoại lệ như nguồn AI — test này đối chiếu từng
   trường hợp trong bảng công thức gốc:

     Tìm kiếm                          2 (cố định)
     Thêm                              1 + N (N = số trường bắt buộc)
     Sửa                               1 + N (N = số trường bắt buộc của bước Sửa)
     Xóa                               1 + K (K = số trường hợp chặn xóa đã nhập, có thể = 0)
     In ấn/Xuất Excel/Xuất Word        1 (không tiêu chí) hoặc 3 (có ≥1 tiêu chí)
     Lập báo cáo                       1 + N + 1 (N = số tiêu chí bắt buộc) */

const generator = new TemplateTestCaseGenerator();

function typesOf(testCases) {
    return testCases.map(tc => tc.type);
}

// 1. Không chọn operation nào -> không sinh testcase nào (không placeholder).
{
    const result = generator.generate({ functionName: "DM đợt nhập học", operations: {} });
    assert.deepEqual(result, []);
}

// 2. "Bỏ qua bước này" (operation config = null/undefined dù có mặt trong object) -> bị loại hẳn,
// không sinh testcase/placeholder cho thao tác đó.
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: { CREATE: null, SEARCH: { fields: ["Mã"] } }
    });
    assert.equal(result.filter(tc => tc.feature.includes("Thêm")).length, 0);
    assert.equal(result.filter(tc => tc.feature.includes("Tìm kiếm")).length, 2);
}

// 3. Tìm kiếm — CỐ ĐỊNH 2 testcase (1 POSITIVE có kết quả + 1 NEGATIVE không có kết quả), bất kể có
// bao nhiêu trường tìm kiếm.
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: { SEARCH: { fields: ["Mã đợt nhập học", "Tên đợt nhập học"] } }
    });
    assert.equal(result.length, 2);
    assert.deepEqual(typesOf(result), ["POSITIVE", "NEGATIVE"]);
    assert.equal(result[0].expectedResult, "Hiển thị kết quả thông tin tương ứng với từ khóa tìm kiếm");
    assert.equal(result[1].expectedResult, "Hiển thị thông báo không có thông tin");
}

// 4. Thêm — 1 POSITIVE + N VALIDATION (N = số trường bắt buộc); trường TÙY CHỌN không tính vào N.
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: {
            CREATE: {
                requiredFields: ["Mã đợt nhập học", "Tên đợt nhập học", "Số quyết định"],
                optionalFields: ["Ghi chú"],
                saveButtonLabel: "Lưu"
            }
        }
    });
    assert.equal(result.length, 4, "1 POSITIVE + 3 VALIDATION = 4");
    assert.deepEqual(typesOf(result), ["POSITIVE", "VALIDATION", "VALIDATION", "VALIDATION"]);
    assert.equal(result[0].expectedResult, "Thông tin sẽ được hiển thị tại danh sách");
    assert.ok(result[1].title.includes("Mã đợt nhập học"));
    assert.ok(result[2].title.includes("Tên đợt nhập học"));
    assert.ok(result[3].title.includes("Số quyết định"));
    result.slice(1).forEach(tc => {
        assert.equal(
            tc.expectedResult,
            "Xuất hiện thông báo tại vị trí thông tin nhập sai, bắt buộc nhập. Thông tin không được lưu"
        );
    });
}

// 4b. Thêm — 0 trường bắt buộc (hiếm nhưng hợp lệ) -> chỉ 1 POSITIVE, không VALIDATION nào.
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: { CREATE: { requiredFields: [], optionalFields: ["Ghi chú"] } }
    });
    assert.equal(result.length, 1);
    assert.deepEqual(typesOf(result), ["POSITIVE"]);
}

// 5. Sửa — CÙNG công thức 1 + N như Thêm, ĐỘC LẬP với Thêm (N riêng, có thể khác Thêm).
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: {
            CREATE: { requiredFields: ["Mã", "Tên", "Số QĐ"] },
            UPDATE: { requiredFields: ["Tên"], saveButtonLabel: "Cập nhật" }
        }
    });
    const updateCases = result.filter(tc => tc.feature.startsWith("Sửa"));
    assert.equal(updateCases.length, 2, "1 POSITIVE + 1 VALIDATION = 2 (N=1 cho Sửa, khác N=3 của Thêm)");
    assert.deepEqual(typesOf(updateCases), ["POSITIVE", "VALIDATION"]);
    assert.equal(updateCases[0].expectedResult, "Thông tin được cập nhật với giá trị mới và sẽ hiển thị tại danh sách");
    assert.match(updateCases[1].title, /Tên/);
    // Nút lưu độc lập: Thêm dùng "Lưu" (mặc định), Sửa dùng "Cập nhật" -> khác nhau trong bước thực hiện.
    assert.ok(updateCases[0].steps.some(s => s.action.includes('"Cập nhật"')));
    const createCases = result.filter(tc => tc.feature.startsWith("Thêm"));
    assert.ok(createCases[0].steps.some(s => s.action.includes('"Lưu"')));
}

// 6. Xóa — 1 POSITIVE + K NEGATIVE (K có thể = 0).
{
    const zeroBlocking = generator.generate({
        functionName: "DM đợt nhập học",
        operations: { DELETE: { blockingCases: [] } }
    });
    assert.equal(zeroBlocking.length, 1, "K=0 -> chỉ 1 POSITIVE");
    assert.deepEqual(typesOf(zeroBlocking), ["POSITIVE"]);

    const twoBlocking = generator.generate({
        functionName: "DM đợt nhập học",
        operations: {
            DELETE: {
                blockingCases: ["Đã có sinh viên đăng ký trong đợt", "Đang được sử dụng ở module khác"]
            }
        }
    });
    assert.equal(twoBlocking.length, 3, "1 POSITIVE + 2 NEGATIVE = 3");
    assert.deepEqual(typesOf(twoBlocking), ["POSITIVE", "NEGATIVE", "NEGATIVE"]);
    assert.equal(twoBlocking[0].expectedResult, "Sau khi xóa thông tin không còn hiển thị tại danh sách");
    twoBlocking.slice(1).forEach(tc => assert.equal(tc.expectedResult, "Xuất hiện thông báo lỗi và không cho phép xóa"));
}

// 7. In ấn/Xuất Excel/Xuất Word — 1 nếu KHÔNG có tiêu chí, 3 nếu CÓ ≥1 tiêu chí; công thức GIỐNG HỆT
// nhau cho cả 3 loại, chỉ khác nhãn thao tác trong tiêu đề/bước; Excel/Word thêm câu "File được tạo
// và lưu trữ tại máy người dùng" vào kết quả mặc định, In ấn thì KHÔNG.
{
    ["PRINT", "EXPORT_EXCEL", "EXPORT_WORD"].forEach(op => {
        const noCriteria = generator.generate({
            functionName: "DM đợt nhập học",
            operations: { [op]: { criteria: [] } }
        });
        assert.equal(noCriteria.length, 1, `${op}: không tiêu chí -> chỉ 1 testcase`);
        assert.deepEqual(typesOf(noCriteria), ["POSITIVE"]);
        if (op === "PRINT") {
            assert.ok(!noCriteria[0].expectedResult.includes("File được tạo"));
        } else {
            assert.ok(noCriteria[0].expectedResult.includes("File được tạo và lưu trữ tại máy người dùng"));
        }

        const withCriteria = generator.generate({
            functionName: "DM đợt nhập học",
            operations: { [op]: { criteria: ["Theo năm học", "Theo lớp"] } }
        });
        assert.equal(withCriteria.length, 3, `${op}: có tiêu chí -> 3 testcase`);
        assert.deepEqual(typesOf(withCriteria), ["POSITIVE", "POSITIVE", "NEGATIVE"]);
    });
}

// 8. Lập báo cáo — 1 + N + 1 (N = số tiêu chí BẮT BUỘC — tiêu chí không đánh dấu bắt buộc KHÔNG tính
// vào N, dù vẫn xuất hiện trong bước "chọn đầy đủ tiêu chí").
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: {
            REPORT: {
                criteria: [
                    { name: "Năm học", required: true },
                    { name: "Học kỳ", required: true },
                    { name: "Đơn vị", required: false }
                ]
            }
        }
    });
    assert.equal(result.length, 4, "1 POSITIVE + 2 VALIDATION (N=2 bắt buộc) + 1 NEGATIVE = 4");
    assert.deepEqual(typesOf(result), ["POSITIVE", "VALIDATION", "VALIDATION", "NEGATIVE"]);
    assert.match(result[1].title, /Năm học/);
    assert.match(result[2].title, /Học kỳ/);
    assert.equal(result[3].expectedResult, "Hiển thị thông báo không có thông tin");
    result.slice(1, 3).forEach(tc => {
        assert.equal(tc.expectedResult, "Xuất hiện thông báo yêu cầu chọn đầy đủ tiêu chí, không cho phép lập báo cáo");
    });
}

// 9. Thứ tự nhóm CỐ ĐỊNH trong kết quả trả về: Tìm kiếm -> Thêm -> Sửa -> Xóa -> In ấn -> Xuất Excel
// -> Xuất Word -> Lập báo cáo — BẤT KỂ thứ tự operations được liệt kê trong payload (giả lập tester
// tick chọn ở Bước 1 theo thứ tự khác).
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: {
            REPORT: { criteria: [{ name: "X", required: true }] },
            DELETE: { blockingCases: [] },
            SEARCH: { fields: [] },
            CREATE: { requiredFields: [] }
        }
    });
    const order = [...new Set(result.map(tc => tc.feature.split(" ")[0]))];
    // feature = "<Nhãn> <name>" -> nhãn "Tìm" (từ "Tìm kiếm"), "Thêm", "Xóa", "Lập" (từ "Lập báo cáo")
    const groupLabels = result.map(tc => tc.feature.replace(` DM đợt nhập học`, ""));
    const uniqueGroupsInOrder = [...new Set(groupLabels)];
    assert.deepEqual(uniqueGroupsInOrder, ["Tìm kiếm", "Thêm", "Xóa", "Lập báo cáo"]);
}

// 10. Mỗi testcase phải có source "TEMPLATE", type hợp lệ, module/feature đúng "Tên chức năng", và
// đủ dữ liệu để qua được TestCaseReviewValidator (module/feature/scenario/type non-empty, testData
// object, steps non-empty với action non-empty).
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: { SEARCH: { fields: ["Mã"] }, CREATE: { requiredFields: ["Mã"] } }
    });
    result.forEach(tc => {
        assert.equal(tc.source, "TEMPLATE");
        assert.ok(["POSITIVE", "NEGATIVE", "VALIDATION"].includes(tc.type));
        assert.equal(tc.module, "DM đợt nhập học");
        assert.ok(tc.feature.includes("DM đợt nhập học"));
        assert.ok(String(tc.scenario ?? "").trim());
        assert.ok(tc.testData && typeof tc.testData === "object" && !Array.isArray(tc.testData));
        assert.ok(Array.isArray(tc.steps) && tc.steps.length > 0);
        tc.steps.forEach(step => assert.ok(String(step.action ?? "").trim()));
        assert.ok(String(tc.expectedResult ?? "").trim(), "expectedResult không được rỗng — nguồn TEMPLATE luôn có sẵn giá trị mặc định");
    });
}

// 11. Người dùng EDIT kết quả mong đợi mặc định trên khuôn mẫu -> generator phải dùng ĐÚNG giá trị
// đã sửa, không phải giá trị mặc định.
{
    const result = generator.generate({
        functionName: "DM đợt nhập học",
        operations: {
            DELETE: { blockingCases: [], successExpected: "Đợt nhập học bị xóa khỏi hệ thống ngay lập tức" }
        }
    });
    assert.equal(result[0].expectedResult, "Đợt nhập học bị xóa khỏi hệ thống ngay lập tức");
}

// 12. Thiếu "Tên chức năng" -> phải báo lỗi rõ ràng, không âm thầm sinh testcase với tên rỗng.
{
    assert.throws(() => generator.generate({ functionName: "", operations: { SEARCH: {} } }), /functionName/);
}

console.log("TemplateTestCaseGenerator formula test: PASS");
