import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import AIProvider from "./AIProvider.js";

class GeminiProvider extends AIProvider {
    constructor(config = {}) {
        super();

        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || "";

        this.model = config.model || process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

        if (!this.apiKey) {
            throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini.");
        }

        this.client = new GoogleGenAI({
            apiKey: this.apiKey
        });
    }

    /** Cấu hình generation mặc định: đủ token cho spec hoàn chỉnh, không stop sequence gây cắt. */
    defaultGenerationConfig() {
        const maxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 8192) || 8192;
        return {
            maxOutputTokens,
            temperature: 0.2,
            stopSequences: [],
            responseMimeType: "text/plain"
        };
    }

    /** Ghép toàn bộ text parts của candidate đầu tiên (không chỉ part[0]). */
    concatCandidateText(candidate) {
        if (!candidate?.content?.parts || !Array.isArray(candidate.content.parts)) return "";
        return candidate.content.parts
            .filter(part => typeof part.text === "string")
            .map(part => part.text)
            .join("");
    }

    /**
     * Gọi Gemini và trả metadata đầy đủ (cho CodeGen).
     * @returns {{text:string, finishReason:string|null, usageMetadata:object|null,
     *   candidateCount:number, partsCount:number, promptLength:number, config:object}}
     */
    async generateWithMeta(prompt, opts = {}) {
        const generationConfig = {
            ...this.defaultGenerationConfig(),
            ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
            ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
            ...(opts.stopSequences ? { stopSequences: opts.stopSequences } : {})
        };

        const response = await this.client.models.generateContent({
            model: this.model,
            contents: prompt,
            config: { generationConfig }
        });

        const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
        const first = candidates[0] ?? null;
        const text = first ? this.concatCandidateText(first) : "";
        const partsCount = first?.content?.parts?.length ?? 0;
        const finishReason = first?.finishReason ?? null;
        const usage = response?.usageMetadata ?? null;

        const meta = {
            candidateCount: candidates.length,
            partsCount,
            textPartLengths: first?.content?.parts?.filter(p => typeof p.text === "string").map(p => String(p.text).length) ?? [],
            totalTextLength: text.length,
            finishReason,
            promptTokenCount: usage?.promptTokenCount ?? null,
            candidatesTokenCount: usage?.candidatesTokenCount ?? null,
            totalTokenCount: usage?.totalTokenCount ?? null,
            blockReason: first?.finishMessage ?? first?.safetyRatings ? (first.safetyRatings ? "has_safety_ratings" : null) : null,
            maxOutputTokens: generationConfig.maxOutputTokens,
            temperature: generationConfig.temperature,
            stopSequences: generationConfig.stopSequences,
            responseMimeType: generationConfig.responseMimeType,
            promptLength: typeof prompt === "string" ? prompt.length : JSON.stringify(prompt ?? {}).length
        };
        console.log(`[CODEGEN_PROVIDER_RESPONSE] ${JSON.stringify(meta)}`);

        if (typeof text !== "string" || !text.trim()) {
            throw new Error(`Gemini returned an empty response. finishReason=${finishReason ?? "?"}`);
        }

        return { ...meta, text };
    }

    async generate(prompt, opts = {}) {
        console.log("[Gemini Diagnostic]", {
            pid: process.pid,
            cwd: process.cwd(),
            nodeVersion: process.version,
            provider: this.constructor.name,
            model: this.model,
            hasApiKey: Boolean(this.apiKey),
            apiKeyLength: this.apiKey?.length || 0,
            promptType: typeof prompt,
            promptLength:
                typeof prompt === "string" ? prompt.length : JSON.stringify(prompt ?? {}).length,
            httpProxy: Boolean(process.env.HTTP_PROXY),
            httpsProxy: Boolean(process.env.HTTPS_PROXY),
            noProxy: Boolean(process.env.NO_PROXY)
        });

        if (typeof prompt !== "string" || !prompt.trim()) {
            throw new Error("GeminiProvider.generate() requires a non-empty prompt.");
        }

        try {
            const result = await this.generateWithMeta(prompt, opts);
            // Backward-compatible: trả về text string (mapper dùng). Metadata có thể lấy qua this.lastResponse.
            this.lastResponse = result;
            return result.text.trim();
        } catch (error) {
            console.error("[Gemini Error]", {
                name: error?.name,
                message: error?.message,
                code: error?.code,
                errno: error?.errno,
                syscall: error?.syscall,
                address: error?.address,
                port: error?.port,
                causeName: error?.cause?.name,
                causeMessage: error?.cause?.message,
                causeCode: error?.cause?.code,
                causeErrno: error?.cause?.errno,
                causeSyscall: error?.cause?.syscall,
                causeAddress: error?.cause?.address,
                causePort: error?.cause?.port,
                stack: error?.stack
            });

            const message = error?.message || "Unknown Gemini API error";
            const causeCode = error?.cause?.code || "";
            const causeMessage = error?.cause?.message || error?.cause?.code || "";

            const technicalDetails = [message, causeCode ? `cause code: ${causeCode}` : "", causeMessage ? `cause message: ${causeMessage}` : ""]
                .filter(Boolean)
                .join("; ");

            throw new Error(`GeminiProvider.generate() failed: ${technicalDetails}`, { cause: error });
        }
    }

    /** Ảnh UI → dữ liệu requirement có cấu trúc. AI chỉ quan sát/đề xuất; tester mới xác nhận. */
    async analyzeRequirementImages({ images = [], analysisMode = "FEATURES", correction = "" } = {}) {
        const prompt = `Bạn là trợ lý phân tích yêu cầu phần mềm từ ảnh giao diện.
VAI TRÒ VÀ RANH GIỚI:
- Ghi observations chỉ khi nhìn thấy bằng chứng trực tiếp trên ảnh.
- Nội dung suy luận (quyền, quan hệ dữ liệu, business rule, validation, ngoại lệ) phải đưa vào inferences, kèm evidence, confidence 0..1 và needsConfirmation=true.
- Không tự coi suy luận là sự thật. Không tạo testcase. Không tuyên bố đã xác nhận.
- document chỉ chứa nội dung quan sát được trực tiếp từ ảnh. Suy luận chưa được xác nhận không được chèn vào businessRules, validations, permissions, relationships hoặc exceptions; dùng "Chưa xác định" khi ảnh không cung cấp đủ bằng chứng.
- Một module có thể có nhiều feature. Dùng tiếng Việt, trừ Screen/Operation/Tags.
- Không dùng thuật ngữ UI tiếng Anh "Modal"; dùng "hộp thoại".
- Không tạo Feature chung chung tên "Quản lý ..." với Operation "CRUD".
- Mỗi Feature phải có sourceImages chỉ rõ ảnh nguồn và chỉ mô tả hành vi nhìn thấy trong các ảnh đó.
- document phải tuân thủ Requirement Markdown V1 giống mẫu canonical: mỗi Feature có đủ Mô tả, Điều kiện tiên quyết, Input, Luồng chính, Quy tắc nghiệp vụ, Validation, Kết quả mong đợi, Ngoại lệ và Automation.
- Luồng chính phải mô tả hành động nghiệp vụ rõ ràng. Với Search phải có bước "Người dùng thực hiện tìm kiếm" (có thể kèm nhấn nút Tìm); không chỉ ghi một động từ hoặc tên nút mơ hồ.
- Không rút gọn nhiều bước quan sát được thành một câu chung. Kết quả mong đợi phải gắn trực tiếp với Feature tương ứng.
${analysisMode === "FEATURES" ? `- CÁC ẢNH MÔ TẢ NHIỀU CHỨC NĂNG: phân tích từng ảnh theo thứ tự và tách mỗi hành vi nghiệp vụ khác nhau thành Feature độc lập.
- Ảnh danh sách/tìm kiếm, ảnh thêm mới, ảnh cập nhật và ảnh xác nhận xóa phải thành các Feature riêng với Operation lần lượt phù hợp như Search/View, Create, Update, Delete.
- Số Feature không bắt buộc bằng số ảnh, nhưng tuyệt đối không gom thêm/sửa/xóa/tìm kiếm thành một Feature CRUD.` : `- CÁC ẢNH CÙNG MỘT LUỒNG: có thể hợp nhất các bước liên tiếp thành một Feature nếu chúng thực sự phục vụ cùng một kết quả nghiệp vụ.`}
${correction ? `YÊU CẦU SỬA KẾT QUẢ TRƯỚC: ${correction}` : ""}
CHỈ trả JSON hợp lệ theo cấu trúc:
{
  "observations":[{"text":"...","evidence":"ảnh/tên vùng"}],
  "inferences":[{"text":"...","evidence":"...","confidence":0.0,"needsConfirmation":true}],
  "questions":["..."],
  "document":{
    "module":{"name":"","purpose":"","description":"","permissions":[],"sharedData":[{"Trường":"","Control Type":"","Nguồn dữ liệu":"","Bắt buộc":"Có|Không","Mô tả":""}],"relationships":[]},
    "features":[{"name":"","sourceImages":[1],"description":"","preconditions":[],"inputs":[{"Trường":"","Bắt buộc":"Có|Không","Quy tắc":""}],"mainFlow":[],"businessRules":[],"validations":[],"expectedResults":[],"exceptions":[],"automation":{"screen":"","operation":"Create|Update|Delete|Search|View|GenerateCode|Other","priority":"High|Medium|Low","candidate":true,"tags":[]}}]
  }
}`;
        const parts = [{ text: prompt }, ...images.map(image => ({ inlineData: { mimeType: image.mimeType, data: image.data } }))];
        const response = await this.client.models.generateContent({
            model: this.model,
            contents: [{ role: "user", parts }],
            config: {
                responseMimeType: "application/json",
                temperature: 0.1,
                maxOutputTokens: Number(process.env.GEMINI_IMAGE_REQUIREMENT_MAX_OUTPUT_TOKENS ?? 32768) || 32768,
                thinkingConfig: { thinkingLevel: "minimal" }
            }
        });
        const first = Array.isArray(response?.candidates) ? response.candidates[0] : null;
        const finishReason = first?.finishReason ?? null;
        const raw = (first ? this.concatCandidateText(first) : (typeof response?.text === "string" ? response.text : "")).trim();
        if (!raw) throw new Error(`Gemini không trả về kết quả phân tích ảnh (finishReason=${finishReason ?? "unknown"}).`);
        let parsed;
        try { parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "")); }
        catch (error) { throw new Error(`Gemini trả về JSON chưa hoàn chỉnh (finishReason=${finishReason ?? "unknown"}, length=${raw.length}).`, { cause: error }); }
        if (!parsed?.document || typeof parsed.document !== "object") throw new Error("Gemini không trả về document requirement hợp lệ.");
        const usage = response?.usageMetadata ?? {};
        return {
            ...parsed,
            model: this.model,
            usage: {
                inputTokens: usage.promptTokenCount ?? null,
                outputTokens: usage.candidatesTokenCount ?? null,
                totalTokens: usage.totalTokenCount ?? null
            }
        };
    }
}

export default GeminiProvider;
