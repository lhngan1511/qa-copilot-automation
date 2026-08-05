const READY = "READY";
const DATA_REQUIRED = "DATA_REQUIRED";

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function resolveExecutionReadiness(testData) {
    const requirement = normalizeText(testData?.requirement);
    const value = normalizeText(testData?.value);
    return testData?.requiresTesterInput === true || (requirement && !value)
        ? DATA_REQUIRED
        : READY;
}

function normalizeTestData(testData, context = {}) {
    if (
        testData &&
        typeof testData === "object" &&
        !Array.isArray(testData) &&
        (Object.hasOwn(testData, "requirement") ||
            Object.hasOwn(testData, "value") ||
            Object.hasOwn(testData, "fields"))
    ) {
        const fields =
            testData.fields &&
            typeof testData.fields === "object" &&
            !Array.isArray(testData.fields)
                ? structuredClone(testData.fields)
                : {};
        const rawValue = normalizeText(testData.value);

        /*
         Tester-entered data arrives as a free-text testData.value (a single
         "Test Data" field in the review UI). Sync it onto the per-field
         structure so testData.fields["<tên>"].value is the source of truth
         and testData.value is only a derived display of those fields - it is
         never an independent source that can drift from the fields.
         */
        const assigned = syncTesterValuesIntoFields(fields, rawValue);

        /*
         When the tester provided values, requiresTesterInput is recomputed
         purely from the per-field state so that once every required field has
         a value it becomes false (and executionReadiness leaves DATA_REQUIRED).
         Otherwise keep the explicit flag that came in.
         */
        const requiresTesterInput = assigned
            ? Object.values(fields).some(field => field?.requiresTesterInput === true)
            : testData.requiresTesterInput === true ||
              Object.values(fields).some(field => field?.requiresTesterInput === true);

        return {
            ...structuredClone(testData),
            fields,
            requirement: normalizeText(testData.requirement),
            value: assigned ? deriveDisplayValue(fields) : rawValue,
            requiresTesterInput
        };
    }

    return {
        requirement: buildDataRequirement(context),
        value: ""
    };
}

/*
 Parse testData.value (raw text) and populate testData.fields[name].value.
 Each line may be "Tên trường: giá trị" (matched against the known field
 names) or a bare value matched positionally to the remaining fields in
 order. A line whose value is an intentional-empty marker ("Để trống") sets
 the field value to "" (tester already decided). No field name is hardcoded.
 */
/*
 A field is eligible to receive a tester-entered value only when it actually
 needs data. Fields with purpose "EMPTY" represent an intentional blank (the
 value must always be "") and must never be filled from testData.value or by
 positional fallback.
 */
function fieldAcceptsTesterValue(field) {
    if (!field || typeof field !== "object") return true;
    return String(field.purpose ?? "").toUpperCase() !== "EMPTY";
}

function syncTesterValuesIntoFields(fields, rawValue) {
    const fieldNames = Object.keys(fields);
    if (!rawValue || fieldNames.length === 0) return false;

    const assigned = new Set();
    const lines = rawValue.split(/\r?\n/);

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > 0) {
            const name = normalizeText(trimmed.slice(0, colonIndex));
            const value = trimmed.slice(colonIndex + 1).trim();
            const match = fieldNames.find(
                fieldName => fieldName.toLowerCase() === name.toLowerCase()
            );
            if (match && value !== "" && fieldAcceptsTesterValue(fields[match])) {
                applyTesterValue(fields, match, value);
                assigned.add(match);
            }
        }
    });

    /*
     Positional fallback: only fill fields that still need a value - fields
     with purpose EMPTY are skipped so an intentional blank is never
     overwritten, and fields that already hold a value are left untouched.
     */
    if (assigned.size < fieldNames.length) {
        const unassigned = fieldNames.filter(
            name =>
                !assigned.has(name) &&
                fieldAcceptsTesterValue(fields[name]) &&
                !fields[name]?.value
        );
        let cursor = 0;
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.includes(":")) return;
            if (cursor < unassigned.length) {
                applyTesterValue(fields, unassigned[cursor], trimmed);
                assigned.add(unassigned[cursor]);
                cursor += 1;
            }
        });
    }

    return assigned.size > 0;
}

function applyTesterValue(fields, name, value) {
    const field = fields[name] && typeof fields[name] === "object" ? fields[name] : {};
    const normalizedValue = /để trống/i.test(value) ? "" : value;
    fields[name] = {
        ...field,
        value: normalizedValue,
        requiresTesterInput: false
    };
    if (Object.hasOwn(fields[name], "instruction")) {
        delete fields[name].instruction;
    }
}

function deriveDisplayValue(fields) {
    return Object.entries(fields)
        .map(([name, field]) => `${name}: ${field?.value ?? ""}`)
        .join("\n");
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
