import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import RequirementMarkdownRenderer from "./RequirementMarkdownRenderer.js";
import validateCanonicalMarkdown from "./validateCanonicalMarkdown.js";

const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export default class ImageRequirementDraftService {
    constructor({ dataDir = "./data", provider, requirementUploadService, renderer = new RequirementMarkdownRenderer(), maxImages = 5, maxImageBytes = 8 * 1024 * 1024, retryDelays = [800, 1800] } = {}) {
        if (!provider) throw new Error("AI provider bắt buộc cho phân tích ảnh.");
        if (!requirementUploadService) throw new Error("RequirementUploadService bắt buộc.");
        this.provider = provider;
        this.requirementUploadService = requirementUploadService;
        this.renderer = renderer;
        this.maxImages = maxImages;
        this.maxImageBytes = maxImageBytes;
        this.retryDelays = retryDelays;
        this.root = path.resolve(dataDir, "requirement-drafts");
        fs.mkdirSync(this.root, { recursive: true });
    }

    async analyze({ projectId, images, analysisMode = "FEATURES" }) {
        const safeProjectId = this.requireProject(projectId);
        const normalized = this.validateImages(images);
        const safeAnalysisMode = analysisMode === "FLOW" ? "FLOW" : "FEATURES";
        let result;
        try {
            result = await this.analyzeWithRetry({ images: normalized, analysisMode: safeAnalysisMode });
            if (safeAnalysisMode === "FEATURES" && this.hasCollapsedFeatures(result, normalized.length)) {
                result = await this.analyzeWithRetry({
                    images: normalized,
                    analysisMode: safeAnalysisMode,
                    correction: "Kết quả trước đã gom nhiều chức năng thành một Feature/CRUD. Hãy tách riêng danh sách hoặc tìm kiếm, thêm mới, cập nhật và xóa theo bằng chứng của từng ảnh."
                });
            }
            if (safeAnalysisMode === "FEATURES" && this.hasCollapsedFeatures(result, normalized.length)) {
                throw this.error("AI_FEATURES_COLLAPSED", "AI vẫn đang gom nhiều chức năng thành một Feature. Vui lòng thử lại hoặc chọn chế độ các ảnh cùng một luồng.", 422);
            }
        }
        catch (cause) {
            if (cause?.code === "AI_FEATURES_COLLAPSED") throw cause;
            console.error("[IMAGE_REQUIREMENT_ANALYSIS_FAILED]", { name: cause?.name, message: cause?.message, code: cause?.code, status: cause?.status });
            if (this.isRetryableProviderError(cause)) {
                throw this.error("AI_PROVIDER_BUSY", "Gemini đang quá tải tạm thời. Hệ thống đã tự thử lại nhưng chưa nhận được phản hồi; vui lòng đợi một lát rồi thử lại.", 503, cause);
            }
            throw this.error("AI_IMAGE_ANALYSIS_FAILED", "Gemini không phân tích được bộ ảnh. Hãy thử lại; nếu lỗi lặp lại, kiểm tra log server.", 502, cause);
        }
        const document = this.sanitizeImageDocument(result.document);
        const markdown = this.renderer.render(document);
        const now = new Date().toISOString();
        const draft = {
            draftId: `DRAFT-${crypto.randomUUID()}`,
            projectId: safeProjectId,
            status: "DRAFT",
            imageHashes: normalized.map(image => image.hash),
            imageNames: normalized.map(image => image.name),
            analysisMode: safeAnalysisMode,
            observations: Array.isArray(result.observations) ? result.observations : [],
            inferences: Array.isArray(result.inferences) ? result.inferences : [],
            questions: Array.isArray(result.questions) ? result.questions : [],
            document,
            markdownContent: markdown,
            model: result.model ?? null,
            usage: result.usage ?? null,
            createdAt: now,
            updatedAt: now
        };
        this.write(draft);
        return draft;
    }

    async analyzeWithRetry(input) {
        let lastError;
        const attempts = this.retryDelays.length + 1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                return await this.provider.analyzeRequirementImages(input);
            } catch (cause) {
                lastError = cause;
                if (!this.isRetryableProviderError(cause) || attempt === attempts - 1) throw cause;
                const delay = Math.max(0, Number(this.retryDelays[attempt]) || 0);
                console.warn("[IMAGE_REQUIREMENT_AI_RETRY]", { attempt: attempt + 1, nextAttempt: attempt + 2, delayMs: delay, status: this.providerErrorStatus(cause) });
                if (delay) await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }

    providerErrorStatus(cause) {
        const direct = Number(cause?.status ?? cause?.statusCode ?? cause?.response?.status);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const message = String(cause?.message ?? "");
        const jsonCode = message.match(/"code"\s*:\s*(\d{3})/)?.[1];
        const httpCode = message.match(/\b(?:HTTP\s*)?(429|500|502|503|504)\b/i)?.[1];
        return Number(jsonCode ?? httpCode) || null;
    }

    isRetryableProviderError(cause) {
        return new Set([429, 500, 502, 503, 504]).has(this.providerErrorStatus(cause)) || /\b(?:UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|temporar(?:y|ily))\b/i.test(String(cause?.message ?? ""));
    }

    hasCollapsedFeatures(result, imageCount) {
        if (imageCount < 2) return false;
        const features = Array.isArray(result?.document?.features) ? result.document.features : [];
        if (features.length < 2) return true;
        return features.some(feature => {
            const operation = String(feature?.automation?.operation ?? "").trim().toUpperCase();
            const name = String(feature?.name ?? "").trim().toLowerCase();
            return operation === "CRUD" || /^quản lý\b/.test(name);
        });
    }

    // Ảnh UI không đủ bằng chứng cho login/access chung. Giữ precondition nghiệp vụ
    // cụ thể (ví dụ bản ghi đã tồn tại), nhưng bỏ placeholder và suy diễn boilerplate.
    sanitizeImageDocument(document = {}) {
        const remove = value => {
            const text = String(value ?? "").trim();
            if (!text || /^chưa xác định[.!]?$/i.test(text)) return false;
            return !/^(?:người dùng\s+)?đã đăng nhập(?:\s+và\s+truy cập\s+(?:trang|chức năng).*)?[.!]?$/i.test(text);
        };
        return {
            ...document,
            features: (Array.isArray(document.features) ? document.features : []).map(feature => ({
                ...feature,
                preconditions: (Array.isArray(feature?.preconditions) ? feature.preconditions : []).filter(remove)
            }))
        };
    }

    confirm({ projectId, draftId, markdownContent, fileName }) {
        const draft = this.read(projectId, draftId);
        const markdown = String(markdownContent ?? draft.markdownContent ?? "").trim();
        if (!markdown.startsWith("# Module:")) throw this.error("INVALID_MARKDOWN", "Requirement phải bắt đầu bằng '# Module:'.", 422);
        if (!markdown.includes("# Features")) throw this.error("INVALID_MARKDOWN", "Requirement phải có phần '# Features'.", 422);
        const featureCount = (markdown.match(/^## Feature:/gm) ?? []).length;
        const expectsSeparateFeatures = (draft.analysisMode ?? "FEATURES") === "FEATURES" && (draft.imageHashes?.length ?? 0) > 1;
        const containsCrud = /^Operation:\s*CRUD\s*$/gim.test(markdown);
        if (expectsSeparateFeatures && (featureCount < 2 || containsCrud)) {
            throw this.error(
                "IMAGE_FEATURES_NOT_SEPARATED",
                "Bản nháp đang gộp nhiều ảnh thành một chức năng CRUD. Vui lòng chọn lại ảnh và phân tích theo chế độ “Nhiều chức năng” trước khi tạo testcase.",
                422
            );
        }
        this.validateCanonicalMarkdown(markdown);
        const upload = this.requirementUploadService.save({
            fileName: this.markdownFileName(fileName, draft.document?.module?.name),
            content: Buffer.from(`${markdown}\n`, "utf8"),
            projectId: draft.projectId
        });
        const updated = { ...draft, status: "CONFIRMED", markdownContent: `${markdown}\n`, requirementId: upload.requirementId, fileName: upload.originalName, updatedAt: new Date().toISOString() };
        this.write(updated);
        return { ...updated, upload };
    }

    validateCanonicalMarkdown(markdown) {
        try {
            return validateCanonicalMarkdown(markdown);
        } catch (cause) {
            throw this.error(cause.code, cause.message, cause.statusCode, cause);
        }
    }

    validateImages(images) {
        if (!Array.isArray(images) || images.length === 0) throw this.error("IMAGE_REQUIRED", "Vui lòng chọn ít nhất một ảnh.", 400);
        if (images.length > this.maxImages) throw this.error("TOO_MANY_IMAGES", `Chỉ được chọn tối đa ${this.maxImages} ảnh.`, 413);
        return images.map((image, index) => {
            const mimeType = String(image?.mimeType ?? "").toLowerCase();
            if (!TYPES.has(mimeType)) throw this.error("INVALID_IMAGE_TYPE", `Ảnh ${index + 1} không đúng định dạng PNG, JPEG hoặc WebP.`, 415);
            let buffer;
            try { buffer = Buffer.from(String(image?.data ?? ""), "base64"); } catch { buffer = Buffer.alloc(0); }
            if (!buffer.length) throw this.error("EMPTY_IMAGE", `Ảnh ${index + 1} không có dữ liệu.`, 400);
            if (buffer.length > this.maxImageBytes) throw this.error("IMAGE_TOO_LARGE", `Ảnh ${index + 1} vượt quá ${this.maxImageBytes / 1024 / 1024} MB.`, 413);
            return { name: path.basename(String(image?.name ?? `image-${index + 1}`)), mimeType, data: buffer.toString("base64"), hash: crypto.createHash("sha256").update(buffer).digest("hex") };
        });
    }

    requireProject(projectId) { const value = String(projectId ?? "").trim(); if (!value) throw this.error("PROJECT_REQUIRED", "Vui lòng chọn Project.", 400); return value; }
    filePath(projectId, draftId) { return path.join(this.root, encodeURIComponent(projectId), `${encodeURIComponent(draftId)}.json`); }
    write(draft) { const target = this.filePath(draft.projectId, draft.draftId); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(draft, null, 2), "utf8"); }
    read(projectId, draftId) { const target = this.filePath(this.requireProject(projectId), draftId); if (!fs.existsSync(target)) throw this.error("DRAFT_NOT_FOUND", "Không tìm thấy bản nháp trong Project hiện tại.", 404); return JSON.parse(fs.readFileSync(target, "utf8")); }
    markdownFileName(value, moduleName) { const raw = String(value ?? moduleName ?? "requirement").trim().replace(/\.md$/i, ""); const slug = raw.normalize("NFKD").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "requirement"; return `${slug}.md`; }
    error(code, message, statusCode, cause = undefined) { const error = new Error(message, cause ? { cause } : undefined); error.code = code; error.statusCode = statusCode; return error; }
}
