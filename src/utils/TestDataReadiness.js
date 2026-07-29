const READY = "READY";
const DATA_REQUIRED = "DATA_REQUIRED";

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function resolveExecutionReadiness(testData) {
    const requirement = normalizeText(testData?.requirement);
    const value = normalizeText(testData?.value);
    return requirement && !value ? DATA_REQUIRED : READY;
}

function normalizeTestData(testData, context = {}) {
    if (
        testData &&
        typeof testData === "object" &&
        !Array.isArray(testData) &&
        (Object.hasOwn(testData, "requirement") || Object.hasOwn(testData, "value"))
    ) {
        return {
            requirement: normalizeText(testData.requirement),
            value: normalizeText(testData.value)
        };
    }

    return {
        requirement: buildDataRequirement(context),
        value: ""
    };
}

function buildDataRequirement(context) {
    const classification = normalizeText(context.ruleClassification).toUpperCase();
    const rule = normalizeText(
        context.sourceItem?.text ??
            context.sourceItem?.content ??
            context.requirementReference ??
            context.title
    );
    const field = normalizeText(
        context.sourceItem?.fieldName ??
            context.sourceItem?.inputName ??
            context.testData?.expectedState?.targetField ??
            Object.keys(context.testData?.invalid ?? {})[0]
    );
    const inputNames = (Array.isArray(context.inputDefinitions) ? context.inputDefinitions : [])
        .map(input => normalizeText(input?.name ?? input?.inputName ?? input?.fieldName))
        .filter(Boolean);

    switch (classification) {
        case "REQUIRED":
            return field
                ? `Chuẩn bị dữ liệu hợp lệ cho các trường còn lại và để trống trường ${field}`
                : `Chuẩn bị dữ liệu có trường bắt buộc bị bỏ trống theo rule: ${rule}`;
        case "DUPLICATE":
            return field
                ? `Sử dụng một giá trị ${field} đã tồn tại trong hệ thống`
                : `Sử dụng một giá trị đã tồn tại theo rule: ${rule}`;
        case "INVALID_REFERENCE":
            return field
                ? `Sử dụng một giá trị ${field} không thuộc danh sách hợp lệ`
                : `Sử dụng dữ liệu tham chiếu không hợp lệ theo rule: ${rule}`;
        case "RECORD_NOT_FOUND":
            return "Sử dụng định danh của một bản ghi không tồn tại trong hệ thống";
        case "STATE_RESTRICTION":
            return `Sử dụng bản ghi có trạng thái thỏa điều kiện bị chặn: ${rule}`;
        case "RELATED_DATA":
            return "Sử dụng bản ghi đang có dữ liệu liên quan";
        case "PERMISSION_DENIED":
            return `Sử dụng tài khoản không có quyền thực hiện chức năng theo rule: ${rule}`;
        case "CONCURRENT_CHANGE":
            return "Sử dụng bản ghi bị thay đổi hoặc xóa bởi tiến trình khác trước khi gửi thao tác";
        case "SYSTEM_FAILURE":
            return "Chuẩn bị môi trường có thể mô phỏng lỗi xử lý được mô tả trong requirement";
        case "EMPTY_SEARCH":
            return "Để trống toàn bộ điều kiện tìm kiếm";
        case "SEARCH_SINGLE":
            return "Nhập một điều kiện tìm kiếm phù hợp với dữ liệu đang tồn tại";
        case "SEARCH_MULTI":
            return "Nhập nhiều điều kiện tìm kiếm theo rule đã được phê duyệt";
        case "NO_RESULT":
            return "Nhập điều kiện tìm kiếm không khớp với bản ghi nào";
        case "BOUNDARY_CONCRETE":
            return buildBoundaryRequirement(context.sourceItem);
        case "BOUNDARY_UNKNOWN":
            return `Cần tester xác định dữ liệu biên sau khi làm rõ rule: ${rule}`;
        case "CONFIRMATION":
            return "Sử dụng bản ghi hợp lệ và không xác nhận thao tác";
        default:
            if (normalizeText(context.type).toUpperCase() === "POSITIVE" && inputNames.length > 0) {
                return `Nhập dữ liệu hợp lệ cho các trường: ${inputNames.join(", ")}`;
            }
            return rule ? `Chuẩn bị dữ liệu thỏa điều kiện: ${rule}` : "";
    }
}

function buildBoundaryRequirement(sourceItem = {}) {
    const descriptions = {
        MIN_MINUS_ONE: "Nhập giá trị nhỏ hơn min một đơn vị",
        MIN: "Nhập giá trị bằng min",
        MAX: "Nhập giá trị bằng max",
        MAX_PLUS_ONE: "Nhập giá trị lớn hơn max một đơn vị",
        LESS_THAN: "Nhập ngày bắt đầu nhỏ hơn ngày kết thúc",
        EQUAL: "Nhập ngày bắt đầu bằng ngày kết thúc",
        GREATER_THAN: "Nhập ngày bắt đầu lớn hơn ngày kết thúc"
    };
    const description = descriptions[sourceItem.boundaryCase] ?? "Nhập giá trị tại điểm biên";
    const evidence = normalizeText(sourceItem.text ?? sourceItem.content);
    return evidence ? `${description} theo giới hạn: ${evidence}` : description;
}

export { DATA_REQUIRED, READY, buildDataRequirement, normalizeTestData, resolveExecutionReadiness };
