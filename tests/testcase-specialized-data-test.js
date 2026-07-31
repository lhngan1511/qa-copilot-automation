import assert from "node:assert/strict";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";

const generator = new TestCaseGenerator();
const base = {
    moduleId: "MOD001",
    module: "Tài sản",
    functionId: "FUNC001",
    function: "Thêm tài sản",
    feature: "Thêm tài sản",
    type: "NEGATIVE",
    priority: "HIGH",
    severity: "HIGH",
    preconditions: [
        "Người dùng đã đăng nhập",
        "Người dùng có quyền thêm tài sản",
        "Bản ghi cần thao tác đã tồn tại"
    ],
    inputDefinitions: [
        { name: "Mã tài sản", required: true },
        { name: "Tên tài sản", required: true },
        { name: "Loại tài sản", required: true }
    ]
};

function generate(rule, source = "BUSINESS_RULE", overrides = {}) {
    return generator.generate([
        {
            ...base,
            ...overrides,
            id: overrides.id ?? `SC-${source}`,
            title: rule,
            coveredRules: [rule],
            sourceItems: [{ code: overrides.code ?? "", content: rule, source }]
        }
    ])[0];
}

const required = generate("Mã tài sản không được để trống", "REQUIRED_VALIDATION");
assert.equal(required.ruleClassification, "REQUIRED");
assert.match(required.testData.requirement, /Mã tài sản/);
assert.equal(required.testData.value, "");
assert.equal(required.executionReadiness, "DATA_REQUIRED");

const duplicate = generate("Mã tài sản phải là duy nhất", "BUSINESS_RULE", {
    code: "BR01"
});
assert.equal(duplicate.ruleClassification, "DUPLICATE");
assert.match(duplicate.testData.requirement, /đã tồn tại/);
assert.match(duplicate.expectedResult, /không tạo bản ghi mới/i);
assert.equal(duplicate.sourceItem.code, "BR01");

const invalidReference = generate(
    "Loại tài sản phải tồn tại trong danh mục loại tài sản",
    "FORMAT_OR_VALUE_VALIDATION"
);
assert.equal(invalidReference.ruleClassification, "INVALID_REFERENCE");
assert.match(invalidReference.testData.requirement, /không thuộc danh sách hợp lệ/);

const recordNotFound = generate("Bản ghi cần xóa phải tồn tại", "BUSINESS_RULE", {
    feature: "Xóa tài sản",
    function: "Xóa tài sản"
});
assert.equal(recordNotFound.ruleClassification, "RECORD_NOT_FOUND");
assert.match(recordNotFound.testData.requirement, /không tồn tại/);
assert.equal(
    recordNotFound.preconditions.some(value => /đã tồn tại|phải tồn tại/i.test(value)),
    false
);

const stateRestriction = generate("Không được xóa tài sản đang được sử dụng", "BUSINESS_RULE", {
    feature: "Xóa tài sản",
    function: "Xóa tài sản"
});
assert.equal(stateRestriction.ruleClassification, "STATE_RESTRICTION");
assert.match(stateRestriction.testData.requirement, /trạng thái/);
assert.match(stateRestriction.expectedResult, /dữ liệu không thay đổi/i);

const relatedData = generate("Không được xóa tài sản có dữ liệu liên quan", "BUSINESS_RULE", {
    feature: "Xóa tài sản",
    function: "Xóa tài sản"
});
assert.equal(relatedData.ruleClassification, "RELATED_DATA");
assert.match(relatedData.testData.requirement, /dữ liệu liên quan/);
assert.match(relatedData.expectedResult, /không làm mất dữ liệu liên quan/i);

const confirmation = generate("Người dùng phải xác nhận trước khi xóa", "BUSINESS_RULE", {
    feature: "Xóa tài sản",
    function: "Xóa tài sản"
});
assert.equal(confirmation.ruleClassification, "CONFIRMATION");
assert.match(confirmation.testData.requirement, /không xác nhận/);
assert.match(confirmation.expectedResult, /không xác nhận/i);

const permission = generate("Người dùng không có quyền xóa tài sản", "PERMISSION", {
    feature: "Xóa tài sản",
    function: "Xóa tài sản",
    type: "PERMISSION"
});
assert.equal(permission.ruleClassification, "PERMISSION_DENIED");
assert.match(permission.testData.requirement, /tài khoản không có quyền/);
assert.equal(
    permission.preconditions.some(
        value => /có quyền/i.test(value) && !/không có quyền/i.test(value)
    ),
    false
);
assert.equal(
    permission.preconditions.some(value => /không có quyền/i.test(value)),
    true
);

const emptySearch = generate(
    "Khi không nhập điều kiện, hệ thống có thể hiển thị toàn bộ hoặc yêu cầu nhập điều kiện",
    "BUSINESS_RULE",
    { feature: "Tìm kiếm tài sản", function: "Tìm kiếm tài sản" }
);
assert.equal(emptySearch.ruleClassification, "EMPTY_SEARCH");
assert.equal(emptySearch.needsClarification, true);
assert.match(emptySearch.expectedResult, /chưa thể xác định/i);

const systemFailure = generate("Hệ thống xảy ra lỗi trong quá trình lưu", "EXCEPTION");
assert.equal(systemFailure.ruleClassification, "SYSTEM_FAILURE");
assert.equal(systemFailure.requiresRuntimeSupport, true);
assert.equal(systemFailure.executable, false);
assert.match(systemFailure.testData.requirement, /môi trường/);

const unknownBoundary = generate("Dữ liệu vượt quá độ dài cho phép", "EXCEPTION");
assert.equal(unknownBoundary.ruleClassification, "BOUNDARY_UNKNOWN");
assert.equal(unknownBoundary.needsClarification, true);
assert.match(unknownBoundary.testData.requirement, /Cần tester xác định/);
assert.equal(JSON.stringify(unknownBoundary.testData).match(/\b(?:255|256|1000)\b/), null);

const concurrentChange = generate("Bản ghi đã bị người dùng khác xóa", "EXCEPTION");
assert.equal(concurrentChange.ruleClassification, "CONCURRENT_CHANGE");
assert.match(concurrentChange.testData.requirement, /tiến trình khác/);

assert.ok(
    [
        required,
        duplicate,
        invalidReference,
        recordNotFound,
        stateRestriction,
        relatedData,
        confirmation,
        permission,
        emptySearch,
        systemFailure,
        unknownBoundary,
        concurrentChange
    ].every(testCase => testCase.sourceItem?.text && testCase.sourceItem?.classification)
);

console.log("TestCase specialized data test PASSED");
