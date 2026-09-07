import MarkdownParser from "../parsers/MarkdownParser.js";

function error(code, message, statusCode, cause = undefined) {
    const err = new Error(message, cause ? { cause } : undefined);
    err.code = code;
    err.statusCode = statusCode;
    return err;
}

/** Validate requirement markdown chuẩn (mẫu upload .md) — trích từ ImageRequirementDraftService,
 *  dùng chung cho MỌI nguồn tạo requirement (upload .md, ảnh, CodeGen...) để không phân kỳ quy tắc. */
export default function validateCanonicalMarkdown(markdown) {
    const globalHeadings = [
        "## Thông tin chung", "### Mục đích", "### Mô tả", "### Quyền truy cập",
        "### Dữ liệu dùng chung", "### Quan hệ dữ liệu", "# Features"
    ];
    const missingGlobal = globalHeadings.filter(heading => !markdown.includes(heading));
    if (missingGlobal.length) {
        throw error("INVALID_REQUIREMENT_TEMPLATE", `File .md thiếu mục bắt buộc: ${missingGlobal.join(", ")}.`, 422);
    }
    const blocks = markdown.split(/(?=^## Feature:)/gm).slice(1);
    if (!blocks.length) throw error("INVALID_REQUIREMENT_TEMPLATE", "File .md phải có ít nhất một '## Feature:'.", 422);
    const featureHeadings = [
        "### Mô tả", "### Điều kiện tiên quyết", "### Input", "### Luồng chính",
        "### Quy tắc nghiệp vụ", "### Validation", "### Kết quả mong đợi",
        "### Ngoại lệ", "### Automation"
    ];
    blocks.forEach((block, index) => {
        const name = block.match(/^## Feature:\s*(.+)$/m)?.[1]?.trim() || `Feature ${index + 1}`;
        const missing = featureHeadings.filter(heading => !block.includes(heading));
        if (missing.length) throw error("INVALID_REQUIREMENT_TEMPLATE", `${name} thiếu mục: ${missing.join(", ")}.`, 422);
    });
    const parsed = new MarkdownParser().parse(markdown);
    if (parsed.features.length !== blocks.length) {
        throw error("INVALID_REQUIREMENT_TEMPLATE", "Không đọc đủ Feature từ file .md. Vui lòng giữ đúng cấu trúc mẫu.", 422);
    }
    const allowedOperations = new Set(["CREATE", "UPDATE", "DELETE", "SEARCH", "VIEW", "GENERATECODE", "OTHER"]);
    parsed.features.forEach(feature => {
        const operation = String(feature.automation?.operation ?? "").replace(/[\s_-]+/g, "").toUpperCase();
        if (!allowedOperations.has(operation)) throw error("INVALID_REQUIREMENT_TEMPLATE", `${feature.name} có Operation không hợp lệ.`, 422);
        if ((feature.flow?.length ?? 0) < 2) throw error("INVALID_REQUIREMENT_TEMPLATE", `${feature.name} cần ít nhất hai bước trong Luồng chính.`, 422);
        if (!(feature.expectedResults?.length > 0)) throw error("INVALID_REQUIREMENT_TEMPLATE", `${feature.name} thiếu Kết quả mong đợi.`, 422);
    });
    return parsed;
}
