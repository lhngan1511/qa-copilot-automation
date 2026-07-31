import assert from "node:assert/strict";
import ExpectedResultBuilder from "../src/builders/ExpectedResultBuilder.js";

const builder = new ExpectedResultBuilder();
const fields = {
    "Mã thiết bị": { value: "TB001", purpose: "VALID" },
    "Tên thiết bị": { value: "Máy in văn phòng", purpose: "VALID" }
};

assert.equal(
    builder.build({
        testCase: { feature: "Thêm thiết bị", type: "POSITIVE" },
        testData: { fields },
        existing: "Thao tác thành công"
    }),
    "Hệ thống lưu thiết bị mới thành công. Thiết bị có Mã thiết bị TB001 xuất hiện trong danh sách với đúng thông tin đã nhập."
);
assert.equal(
    builder.build({
        testCase: {
            feature: "Thêm thiết bị",
            type: "NEGATIVE",
            ruleClassification: "REQUIRED",
            sourceItem: { fieldName: "Tên thiết bị" }
        },
        testData: {
            fields: { ...fields, "Tên thiết bị": { value: "", purpose: "EMPTY" } }
        }
    }),
    "Hệ thống không lưu thiết bị mới. Trường Tên thiết bị được đánh dấu bắt buộc và hiển thị cảnh báo không được để trống."
);
assert.equal(
    builder.build({
        testCase: {
            feature: "Thêm thiết bị",
            type: "DATA_INTEGRITY",
            ruleClassification: "DUPLICATE",
            sourceItem: { fieldName: "Mã thiết bị" }
        },
        testData: {
            fields: { "Mã thiết bị": { value: "TB001", purpose: "DUPLICATE" } }
        }
    }),
    "Hệ thống không lưu thiết bị mới và hiển thị cảnh báo Mã thiết bị TB001 đã tồn tại. Dữ liệu hiện có không bị thay đổi."
);
assert.equal(
    builder.build({
        testCase: { feature: "Sửa thiết bị", type: "POSITIVE" },
        testData: {
            fields: {
                "Mã thiết bị": { value: "TB001", purpose: "VALID" },
                "Tên thiết bị": { value: "Máy in tầng 2", purpose: "UPDATED_VALUE" }
            },
            existing: { "Mã thiết bị": "TB001" },
            updated: { "Tên thiết bị": "Máy in tầng 2" }
        }
    }),
    "Hệ thống lưu thay đổi thành công. Thiết bị TB001 hiển thị tên thiết bị mới là Máy in tầng 2."
);
assert.equal(
    builder.build({
        testCase: { feature: "Xóa thiết bị", type: "POSITIVE" },
        testData: { fields, record: "TB001" }
    }),
    "Hệ thống xóa thiết bị TB001 thành công và thiết bị không còn xuất hiện trong danh sách."
);
assert.equal(
    builder.build({
        testCase: {
            feature: "Xóa thiết bị",
            type: "DATA_INTEGRITY",
            ruleClassification: "STATE_RESTRICTION"
        },
        testData: { fields, record: "TB001", recordState: "Đang được sử dụng" }
    }),
    "Hệ thống không xóa thiết bị TB001 và hiển thị cảnh báo đang được sử dụng. Dữ liệu thiết bị vẫn được giữ nguyên."
);
assert.equal(
    builder.build({
        testCase: { feature: "Tìm kiếm thiết bị", type: "POSITIVE" },
        testData: {
            fields: { "Mã thiết bị": { value: "TB001", purpose: "SEARCH_CRITERIA" } }
        }
    }),
    "Danh sách chỉ hiển thị các bản ghi phù hợp với từ khóa TB001. Các bản ghi không phù hợp không xuất hiện trong kết quả."
);
assert.equal(
    builder.build({
        testCase: {
            feature: "Xóa thiết bị",
            type: "PERMISSION",
            ruleClassification: "PERMISSION_DENIED"
        },
        testData: { fields: {} }
    }),
    "Hệ thống từ chối thao tác xóa thiết bị. Người dùng không thể thay đổi dữ liệu và nhận được thông báo không có quyền thực hiện chức năng."
);
assert.match(
    builder.build({
        testCase: {
            feature: "Thêm thiết bị",
            type: "BOUNDARY",
            ruleClassification: "BOUNDARY_MAX_PLUS",
            sourceItem: {
                fieldName: "Tên thiết bị",
                content: "Tên thiết bị tối đa 50 ký tự"
            }
        },
        testData: { fields: {} }
    }),
    /không được vượt quá 50 ký tự/
);
assert.doesNotMatch(
    builder.build({
        testCase: {
            feature: "Thêm thiết bị",
            type: "NEGATIVE",
            ruleClassification: "INVALID_OPTION",
            sourceItem: { fieldName: "Loại thiết bị" }
        },
        testData: {
            fields: {
                "Loại thiết bị": {
                    value: null,
                    purpose: "NOT_ALLOWED",
                    requiresTesterInput: true
                }
            }
        }
    }),
    /".*"/
);
assert.match(
    builder.normalizeLegacy("Kết quả đúng", {
        feature: "Thêm thiết bị",
        type: "NEGATIVE",
        testData: { fields: {} }
    }),
    /không lưu dữ liệu/i
);
assert.doesNotMatch(
    builder.normalizeLegacy("Chưa có đủ dữ liệu để xử lý theo rule BR04.", {
        feature: "Thêm thiết bị",
        type: "NEGATIVE",
        testData: { fields: {} }
    }),
    /BR04|theo rule|Chưa có đủ dữ liệu/i
);
assert.equal(
    builder.normalizeLegacy("Hệ thống hiển thị đúng dữ liệu do tester xác nhận.", {
        feature: "Thêm thiết bị",
        type: "POSITIVE"
    }),
    "Hệ thống hiển thị đúng dữ liệu do tester xác nhận."
);

console.log("Expected result builder test PASSED");
