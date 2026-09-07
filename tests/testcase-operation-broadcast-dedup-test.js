import assert from "node:assert/strict";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";

/* Ngân chốt 2026-09-04: OPERATION_MATCH gắn fact vào TẤT CẢ function cùng operation — chấp nhận
   testcase nội dung trùng nhau giữa nhiều function, KHÔNG chặn ở tầng correlate (chặn ở đó từng làm
   rơi mất câu trả lời hợp lệ). "Nếu 2 testcase cuối giống hệt nội dung thì dedupe ở tầng hiển thị" —
   TestCaseGenerator#dedupeIdenticalContentTestCases (tầng cuối cùng trước khi trả về Review UI/Export)
   phải gộp các testcase trùng (module, type, title, expectedResult) làm MỘT, gộp function/feature +
   sourceReferences liên quan, không rơi mất testcase nào cũng không hiển thị trùng lặp vô nghĩa. */

function scenarioFor(functionName, sourceId) {
    return {
        id: `SC-${functionName}`,
        title: "Kiểm tra quyền hạn thao tác",
        type: "PERMISSION",
        module: "DM đợt nhập học",
        feature: functionName,
        function: functionName,
        expectedResult: "Chỉ quyền admin được quyền thực hiện thao tác",
        sourceReferences: [{ sourceType: "CLARIFICATION", sourceId }]
    };
}

const scenarios = [
    scenarioFor("Thêm mới đợt nhập học", "CL005"),
    scenarioFor("Sửa đợt nhập học", "CL005"),
    scenarioFor("Xóa đợt nhập học", "CL005"),
    { id: "SC-unrelated", title: "Kiểm tra tìm kiếm hoạt động đúng", type: "POSITIVE", module: "DM đợt nhập học", feature: "Tìm kiếm đợt nhập học", expectedResult: "Danh sách hiển thị đúng kết quả" }
];

const testCases = new TestCaseGenerator().generate(scenarios);

// 3 testcase trùng module/type/title/expectedResult -> gộp còn 1; testcase không liên quan giữ nguyên.
assert.equal(testCases.length, 2, `phải dedupe 3 testcase trùng nội dung còn 1 (+1 testcase không liên quan), thấy ${testCases.length}`);

const merged = testCases.find(testCase => testCase.type === "PERMISSION");
assert.ok(merged, "phải còn lại đúng 1 testcase PERMISSION sau dedupe");
assert.equal(
    merged.function,
    "Thêm mới đợt nhập học, Sửa đợt nhập học, Xóa đợt nhập học",
    "testcase gộp phải liệt kê đủ CẢ 3 function liên quan, không rơi mất cái nào"
);
assert.equal(merged.sourceReferences.length, 1, "3 reference trùng sourceId CL005 phải gộp còn 1, không nhân bản");
assert.equal(merged.sourceReferences[0].sourceId, "CL005");

const unrelated = testCases.find(testCase => testCase.type === "POSITIVE");
assert.ok(unrelated, "testcase không trùng nội dung phải giữ nguyên, không bị đụng vào");

// Nội dung GIỐNG NHAU nhưng KHÁC module -> KHÔNG được gộp (dedupe chỉ áp trong CÙNG module).
const crossModuleScenarios = [
    scenarioFor("Thêm mới đợt nhập học", "CL005"),
    { ...scenarioFor("Thêm mới lớp học", "CL005"), module: "DM lớp học" }
];
const crossModuleTestCases = new TestCaseGenerator().generate(crossModuleScenarios);
assert.equal(crossModuleTestCases.length, 2, "testcase trùng nội dung nhưng KHÁC module không được gộp nhầm");

console.log("TestCase operation-broadcast display-layer dedup test: PASS");
