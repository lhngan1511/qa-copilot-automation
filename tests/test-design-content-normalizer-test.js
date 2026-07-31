import assert from "node:assert/strict";
import TestDesignContentNormalizer from "../src/normalizers/TestDesignContentNormalizer.js";

const normalizer = new TestDesignContentNormalizer();

assert.equal(
    normalizer.normalizeTitle({
        title: "BR01: Mã thiết bị phải duy nhất",
        feature: "Thêm thiết bị",
        type: "DATA_INTEGRITY"
    }),
    "Không cho phép thêm thiết bị có mã thiết bị đã tồn tại"
);
assert.equal(
    normalizer.normalizeTitle({
        title: "[BR02] Không được bỏ trống Tên thiết bị",
        feature: "Thêm thiết bị",
        type: "NEGATIVE"
    }),
    "Hiển thị cảnh báo khi bỏ trống Tên thiết bị"
);
assert.equal(
    normalizer.normalizeTitle({
        title: "Thêm thiết bị",
        feature: "Thêm thiết bị",
        type: "POSITIVE"
    }),
    "Thêm mới thiết bị thành công với dữ liệu hợp lệ"
);
assert.equal(
    normalizer.normalizeTitle({
        title: "BR03 - Không được xóa thiết bị đang được sử dụng",
        feature: "Xóa thiết bị",
        type: "DATA_INTEGRITY"
    }),
    "Không cho phép xóa thiết bị đang được sử dụng"
);
assert.equal(
    normalizer.normalizeTitle({
        title: "BR04_Loại thiết bị không hợp lệ",
        feature: "Thêm thiết bị",
        type: "NEGATIVE",
        ruleClassification: "INVALID_OPTION"
    }),
    "Không cho phép thêm thiết bị khi loại thiết bị không hợp lệ"
);
assert.equal(
    normalizer.normalizeTitle({
        title: "BR05: Người dùng phải có quyền xóa thiết bị",
        feature: "Xóa thiết bị",
        type: "PERMISSION"
    }),
    "Từ chối xóa thiết bị khi người dùng không có quyền"
);
assert.equal(
    normalizer.normalizeTitle({
        title: "BR06: Tên thiết bị tối đa 50 ký tự",
        feature: "Thêm thiết bị",
        type: "BOUNDARY"
    }),
    "Hiển thị cảnh báo khi tên thiết bị vượt quá 50 ký tự"
);
assert.deepEqual(
    normalizer.extractBusinessRuleIds("BR01: Mã duy nhất", "[BR02] Tên bắt buộc", {
        code: "BR_003"
    }),
    ["BR01", "BR02", "BR03"]
);
assert.equal(normalizer.stripTraceabilityPrefix("BR01 - Nội dung"), "Nội dung");
assert.equal(normalizer.stripTraceabilityPrefix("[BR02] Nội dung"), "Nội dung");
assert.equal(normalizer.stripTraceabilityPrefix("BR03_Nội dung"), "Nội dung");
assert.equal(
    normalizer.normalizeTitle({
        title: "Kiểm tra các trường bắt buộc hợp lệ",
        feature: "Thêm thiết bị",
        type: "NEGATIVE"
    }),
    "Hiển thị cảnh báo khi bỏ trống trường bắt buộc của thiết bị"
);

assert.deepEqual(
    normalizer.normalizePreconditions(
        [
            "Người dùng đã đăng nhập vào hệ thống.",
            " người dùng ĐÃ ĐĂNG NHẬP ",
            "Người dùng đang đăng nhập với tài khoản hợp lệ",
            "Người dùng có quyền quản lý thiết bị",
            "Tài khoản có quyền truy cập chức năng Thiết bị",
            "Người dùng đang ở màn hình quản lý thiết bị"
        ],
        { target: "Thiết bị" }
    ),
    ["Người dùng đã đăng nhập vào hệ thống.", "Người dùng có quyền quản lý thiết bị."]
);
assert.deepEqual(
    normalizer.normalizePreconditions(
        [
            "Thiết bị cần sửa đã tồn tại",
            "Thiết bị đang được sử dụng",
            "Thiết bị không được sử dụng",
            "Hệ thống đang hoạt động",
            "Người dùng chưa đăng nhập"
        ],
        { target: "Thiết bị" }
    ),
    [
        "Thiết bị cần sửa đã tồn tại.",
        "Thiết bị đang được sử dụng.",
        "Thiết bị không được sử dụng.",
        "Hệ thống đang hoạt động.",
        "Người dùng chưa đăng nhập."
    ]
);
assert.deepEqual(normalizer.normalizePreconditions(null), []);
assert.deepEqual(normalizer.normalizePreconditions([null, {}, "", "  "]), []);

console.log("Test design content normalizer test PASSED");
