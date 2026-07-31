const LABELS = Object.freeze({
    VALID: "Hợp lệ",
    EMPTY: "Để trống",
    DUPLICATE: "Giá trị đã tồn tại",
    INVALID: "Không hợp lệ",
    BELOW_MIN: "Nhỏ hơn giới hạn tối thiểu",
    AT_MIN: "Bằng giới hạn tối thiểu",
    ABOVE_MAX: "Lớn hơn giới hạn tối đa",
    AT_MAX: "Bằng giới hạn tối đa",
    NOT_ALLOWED: "Không thuộc danh sách cho phép",
    SEARCH_CRITERIA: "Điều kiện tìm kiếm",
    EXISTING_VALUE: "Giá trị hiện có",
    UPDATED_VALUE: "Giá trị cập nhật"
});

export default function testDataPurposeLabel(value) {
    return LABELS[String(value ?? "").trim().toUpperCase()] ?? "Dữ liệu kiểm thử";
}
