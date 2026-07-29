export const MAX_REQUIREMENT_BYTES = 2 * 1024 * 1024;

export function validateRequirementFile(file, { maxBytes = MAX_REQUIREMENT_BYTES } = {}) {
    if (!file || typeof file !== "object") {
        return {
            valid: false,
            code: "FILE_REQUIRED",
            message: "Vui lòng chọn một file requirement Markdown."
        };
    }

    const name = typeof file.name === "string" ? file.name.trim() : "";
    const extensionIsMarkdown = /\.md$/i.test(name);
    const mimeType = typeof file.type === "string" ? file.type.toLowerCase() : "";
    const mimeIsAllowed =
        mimeType === "" ||
        mimeType === "text/markdown" ||
        (mimeType === "text/plain" && extensionIsMarkdown);

    if (!extensionIsMarkdown || !mimeIsAllowed) {
        return {
            valid: false,
            code: "INVALID_FILE_TYPE",
            message: "Chỉ chấp nhận file Markdown có phần mở rộng .md."
        };
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
        return {
            valid: false,
            code: "EMPTY_FILE",
            message: "File requirement không được để trống."
        };
    }

    if (file.size > maxBytes) {
        return {
            valid: false,
            code: "FILE_TOO_LARGE",
            message: "File requirement không được vượt quá 2 MB."
        };
    }

    return {
        valid: true,
        code: null,
        message: ""
    };
}

export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Không xác định";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
