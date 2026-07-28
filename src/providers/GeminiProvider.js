import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import AIProvider from "./AIProvider.js";

class GeminiProvider extends AIProvider {
    constructor(config = {}) {
        super();

        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || "";

        this.model = config.model || process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

        // console.log("ENV:", process.env.GEMINI_MODEL);
        //console.log("PROVIDER:", this.model);

        if (!this.apiKey) {
            throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini.");
        }

        this.client = new GoogleGenAI({
            apiKey: this.apiKey
        });
    }

    async generate(prompt) {
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
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: prompt
            });

            const text = response.text;

            if (typeof text !== "string" || !text.trim()) {
                throw new Error("Gemini returned an empty response.");
            }

            return text.trim();
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

            console.error("Gemini technical error:", {
                message,
                causeCode,
                causeMessage
            });

            const technicalDetails = [
                message,
                causeCode ? `cause code: ${causeCode}` : "",
                causeMessage ? `cause message: ${causeMessage}` : ""
            ]
                .filter(Boolean)
                .join("; ");

            throw new Error(`GeminiProvider.generate() failed: ${technicalDetails}`, {
                cause: error
            });
        }
    }
}

export default GeminiProvider;
