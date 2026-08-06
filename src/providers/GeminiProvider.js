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
}

export default GeminiProvider;
