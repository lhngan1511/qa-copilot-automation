import assert from "node:assert/strict";
import TestStepNormalizer from "../src/normalizers/TestStepNormalizer.js";

const normalizer = new TestStepNormalizer();
const inputDefinitions = [
    { name: "Mã thiết bị", required: true, controlType: "TextBox" },
    { name: "Tên thiết bị", required: true, controlType: "TextBox" },
    { name: "Loại thiết bị", required: true, controlType: "Dropdown" }
];

const positive = normalizer.normalize(
    [
        { action: "Mở màn hình hoặc chức năng", target: "Quản lý thiết bị" },
        { action: "Nhập dữ liệu", target: "Mã thiết bị", value: "TB001" },
        { action: "Nhập dữ liệu", target: "Tên thiết bị", value: "Máy in văn phòng" },
        { action: "Chọn giá trị", target: "Loại thiết bị", value: "Máy in" },
        { action: "Thực hiện thao tác", target: "Thêm thiết bị" },
        { action: "Kiểm tra kết quả nghiệp vụ", expected: "Thiết bị được tạo" }
    ],
    {
        feature: "Thêm thiết bị",
        operation: "CREATE",
        type: "POSITIVE",
        inputDefinitions,
        testData: {
            inputs: {
                "Mã thiết bị": "TB001",
                "Tên thiết bị": "Máy in văn phòng",
                "Loại thiết bị": "Máy in"
            }
        }
    }
);
assert.deepEqual(
    positive.map(step => step.action),
    [
        "Mở chức năng Quản lý thiết bị",
        "Nhập Mã thiết bị là TB001",
        "Nhập Tên thiết bị là Máy in văn phòng",
        "Chọn Loại thiết bị là Máy in",
        "Lưu thông tin thiết bị"
    ]
);

const required = normalizer.normalize(
    [
        { action: "Mở chức năng Thêm thiết bị", target: "Thêm thiết bị" },
        { action: "Nhập dữ liệu hợp lệ cho các trường còn lại" },
        { action: "Để trống Tên thiết bị", target: "Tên thiết bị" },
        { action: "Thực hiện Thêm thiết bị" },
        { action: "Kiểm tra kết quả nghiệp vụ" }
    ],
    {
        feature: "Thêm thiết bị",
        operation: "CREATE",
        ruleClassification: "REQUIRED",
        sourceItem: { fieldName: "Tên thiết bị" },
        inputDefinitions,
        testData: { inputs: { "Mã thiết bị": "TB001", "Loại thiết bị": "Máy in" } }
    }
);
assert.deepEqual(
    required.map(step => step.action),
    [
        "Mở chức năng Thêm thiết bị",
        "Để trống Tên thiết bị",
        "Nhập Mã thiết bị là TB001",
        "Chọn Loại thiết bị là Máy in",
        "Lưu thông tin thiết bị"
    ]
);

const duplicate = normalizer.normalize(
    [
        "Mở chức năng Thêm thiết bị",
        {
            action: "Nhập giá trị đã tồn tại cho Mã thiết bị",
            target: "Mã thiết bị",
            value: "TB001"
        },
        "Thực hiện Thêm thiết bị"
    ],
    {
        feature: "Thêm thiết bị",
        operation: "CREATE",
        ruleClassification: "DUPLICATE",
        sourceItem: { fieldName: "Mã thiết bị" },
        inputDefinitions,
        testData: { invalid: { "Mã thiết bị": "TB001" }, inputs: { "Tên thiết bị": "Máy in" } }
    }
);
assert.ok(duplicate.some(step => step.action === "Nhập Mã thiết bị là TB001"));
assert.ok(duplicate.some(step => step.action === "Nhập Tên thiết bị là Máy in"));

const update = normalizer.normalize(
    [
        "Mở trang Quản lý thiết bị",
        { action: "Chọn bản ghi", target: "Thiết bị", value: "TB001" },
        { action: "Nhập dữ liệu", target: "Tên thiết bị", value: "Máy in tầng 2" },
        "Thực hiện Sửa thiết bị"
    ],
    { feature: "Sửa thiết bị", operation: "UPDATE", inputDefinitions: [] }
);
assert.deepEqual(
    update.map(step => step.action),
    [
        "Mở chức năng Quản lý thiết bị",
        "Chọn bản ghi",
        "Nhập Tên thiết bị là Máy in tầng 2",
        "Lưu thông tin thiết bị"
    ]
);

const deleteRestriction = normalizer.normalize(
    [
        "Thiết lập điều kiện trước",
        "Mở chức năng Quản lý thiết bị",
        "Thực hiện thao tác với bản ghi ở trạng thái bị chặn",
        "Kiểm tra kết quả"
    ],
    {
        feature: "Xóa thiết bị",
        operation: "DELETE",
        preconditions: ["Thiết bị đang được sử dụng"]
    }
);
assert.deepEqual(
    deleteRestriction.map(step => step.action),
    ["Mở chức năng Quản lý thiết bị", "Thực hiện xóa thiết bị"]
);

const search = normalizer.normalize(
    [
        "Đi đến màn hình Quản lý thiết bị",
        { action: "Tìm kiếm bằng một điều kiện", value: "TB001" },
        "Thực hiện tìm kiếm",
        "Kiểm tra kết quả"
    ],
    { feature: "Tìm kiếm thiết bị", operation: "SEARCH" }
);
assert.deepEqual(
    search.map(step => step.action),
    ["Mở chức năng Quản lý thiết bị", "Nhập điều kiện tìm kiếm là TB001", "Thực hiện tìm kiếm"]
);

const permission = normalizer.normalize(
    [
        "Chuẩn bị tài khoản không có quyền",
        "Mở chức năng Quản lý thiết bị",
        "Thực hiện thao tác bằng người dùng không có quyền"
    ],
    {
        feature: "Thêm thiết bị",
        operation: "CREATE",
        preconditions: ["Người dùng sử dụng tài khoản không có quyền thực hiện chức năng"]
    }
);
assert.deepEqual(
    permission.map(step => step.action),
    ["Mở chức năng Quản lý thiết bị"]
);

const boundary = normalizer.normalize(
    [
        "Mở chức năng Thêm thiết bị",
        { action: "Nhập giá trị tại điểm biên", target: "Tên thiết bị", value: 51 },
        "Thực hiện Thêm thiết bị"
    ],
    { feature: "Thêm thiết bị", operation: "CREATE", type: "BOUNDARY" }
);
assert.ok(boundary.some(step => step.action === "Nhập Tên thiết bị là 51"));

const deduplicated = normalizer.normalize(
    [
        "1. Mở trang Thiết bị.",
        "Truy cập chức năng thiết bị",
        "Đi đến màn hình THIẾT BỊ",
        { description: "Nhập Mã thiết bị là TB001", target: "Mã thiết bị", value: "TB001" },
        { step: "nhập mã thiết bị là TB001.", target: "Mã thiết bị", value: "TB001" },
        { action: "Nhập Tên thiết bị là Máy in", target: "Tên thiết bị", value: "Máy in" },
        "Nhấn Lưu",
        "thực hiện lưu dữ liệu.",
        "Kiểm tra kết quả"
    ],
    { feature: "Thiết bị", preserveManualSteps: true }
);
assert.equal(deduplicated.filter(step => /Mở chức năng/i.test(step.action)).length, 1);
assert.equal(deduplicated.filter(step => /Nhấn Lưu|Lưu thông tin/i.test(step.action)).length, 1);
assert.equal(deduplicated.filter(step => step.target === "Mã thiết bị").length, 1);
assert.equal(deduplicated.filter(step => step.target === "Tên thiết bị").length, 1);
assert.deepEqual(
    deduplicated.map(step => step.order),
    [1, 2, 3, 4]
);
assert.ok(deduplicated.every(step => !/^\d+[.)]/.test(step.action)));

const manual = normalizer.normalize(
    [
        "1. Mở hồ sơ thiết bị từ danh sách yêu thích",
        { stepNumber: 2, step: "Chọn tab Lịch sử bảo trì" }
    ],
    { feature: "Sửa thiết bị", operation: "UPDATE", preserveManualSteps: true }
);
assert.deepEqual(
    manual.map(step => step.action),
    ["Mở hồ sơ thiết bị từ danh sách yêu thích", "Chọn tab Lịch sử bảo trì"]
);

const withoutPreconditions = normalizer.normalize(
    ["Người dùng đã đăng nhập", "Mở chức năng Quản lý thiết bị"],
    {
        feature: "Quản lý thiết bị",
        preconditions: ["Người dùng đã đăng nhập"],
        preserveManualSteps: true
    }
);
assert.deepEqual(
    withoutPreconditions.map(step => step.action),
    ["Mở chức năng Quản lý thiết bị"]
);
assert.deepEqual(normalizer.normalize(null), []);

const saveOnlyRegression = normalizer.normalize([{ order: 1, action: "Thực hiện lưu dữ liệu" }], {
    feature: "Chức năng chưa xác định",
    preserveManualSteps: true
});
assert.equal(saveOnlyRegression.length, 1);
assert.match(saveOnlyRegression[0].action, /Lưu thông tin/);

const customActionRegression = normalizer.normalize(
    [{ order: 1, action: "Kích hoạt đồng bộ dữ liệu" }],
    { preserveManualSteps: true }
);
assert.deepEqual(
    customActionRegression.map(step => step.action),
    ["Kích hoạt đồng bộ dữ liệu"]
);

console.log("Test step normalizer test PASSED");
