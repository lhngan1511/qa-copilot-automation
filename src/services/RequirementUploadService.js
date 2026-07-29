import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export default class RequirementUploadService {
    constructor({ uploadDir = "./data/uploads", maxBytes = 2 * 1024 * 1024 } = {}) {
        this.uploadDir = path.resolve(uploadDir);
        this.maxBytes = maxBytes;
        fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    save({ fileName, content } = {}) {
        const safeName = this.normalizeFileName(fileName);

        if (!Buffer.isBuffer(content) || content.length === 0) {
            throw this.error("EMPTY_UPLOAD", "Vui lòng chọn một file requirement .md.", 400);
        }

        if (content.length > this.maxBytes) {
            throw this.error(
                "UPLOAD_TOO_LARGE",
                `File requirement không được vượt quá ${this.maxBytes} bytes.`,
                413
            );
        }

        const extension = path.extname(safeName).toLowerCase();
        if (extension !== ".md") {
            throw this.error("INVALID_FILE_TYPE", "Chỉ chấp nhận file requirement .md.", 415);
        }

        const baseName = path
            .basename(safeName, extension)
            .normalize("NFKD")
            .replace(/[^\p{L}\p{N}._-]+/gu, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80);
        const storedName = `${baseName || "requirement"}-${Date.now()}-${crypto
            .randomBytes(4)
            .toString("hex")}.md`;
        const storedPath = path.resolve(this.uploadDir, storedName);

        if (!this.isInside(this.uploadDir, storedPath)) {
            throw this.error("INVALID_UPLOAD_PATH", "Tên file upload không hợp lệ.", 400);
        }

        fs.writeFileSync(storedPath, content);

        return {
            originalName: safeName,
            storedName,
            requirementId: storedName,
            size: content.length
        };
    }

    resolve(requirementId) {
        const safeName = this.normalizeFileName(requirementId);
        const storedPath = path.resolve(this.uploadDir, safeName);

        if (
            !this.isInside(this.uploadDir, storedPath) ||
            !fs.existsSync(storedPath) ||
            !fs.statSync(storedPath).isFile()
        ) {
            throw this.error(
                "REQUIREMENT_UPLOAD_NOT_FOUND",
                "Không tìm thấy requirement đã upload.",
                404
            );
        }

        return storedPath;
    }

    normalizeFileName(fileName) {
        if (typeof fileName !== "string" || !fileName.trim()) {
            throw this.error("FILE_NAME_REQUIRED", "Thiếu tên file upload.", 400);
        }

        const decoded = decodeURIComponent(fileName.trim());
        if (
            decoded.includes("..") ||
            decoded.includes("/") ||
            decoded.includes("\\") ||
            path.basename(decoded) !== decoded
        ) {
            throw this.error("INVALID_FILE_NAME", "Tên file upload không hợp lệ.", 400);
        }

        return decoded;
    }

    isInside(parent, child) {
        const relative = path.relative(parent, child);
        return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
    }

    error(code, message, statusCode) {
        const error = new Error(message);
        error.code = code;
        error.statusCode = statusCode;
        return error;
    }
}
