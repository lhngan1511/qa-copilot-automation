import assert from "node:assert/strict";
import testDataPurposeLabel from "../src/utils/TestDataPurposeLabel.js";

assert.equal(testDataPurposeLabel("VALID"), "Hợp lệ");
assert.equal(testDataPurposeLabel("EMPTY"), "Để trống");
assert.equal(testDataPurposeLabel("DUPLICATE"), "Giá trị đã tồn tại");
assert.equal(testDataPurposeLabel("NOT_ALLOWED"), "Không thuộc danh sách cho phép");
assert.equal(testDataPurposeLabel("ABOVE_MAX"), "Lớn hơn giới hạn tối đa");
assert.equal(testDataPurposeLabel("UNKNOWN_INTERNAL_STATE"), "Dữ liệu kiểm thử");

console.log("Test data purpose label test PASSED");
