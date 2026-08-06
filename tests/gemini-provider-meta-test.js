import assert from "node:assert/strict";
import GeminiProvider from "../src/providers/GeminiProvider.js";

/* P0 BLOCKER — Provider ghép toàn bộ text parts + trả metadata (finishReason, usage, parts). */

// Mock client để không gọi API thật.
function makeProvider(response) {
    const provider = new GeminiProvider({ apiKey: "test-key", model: "test-model" });
    provider.client = {
        models: {
            generateContent: async () => response
        }
    };
    return provider;
}

async function main() {
    // 1. response có nhiều parts -> ghép tất cả text parts (không chỉ part[0]).
    const multiPart = makeProvider({
        candidates: [
            {
                finishReason: "STOP",
                content: {
                    parts: [
                        { text: "import { test } from '@playwright/test';\n" },
                        { text: "test('x', () => {});\n" }
                    ]
                }
            }
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 }
    });
    const r = await multiPart.generateWithMeta("prompt", { maxOutputTokens: 8192 });
    assert.equal(r.text, "import { test } from '@playwright/test';\ntest('x', () => {});\n", "ghép đủ cả 2 parts");
    assert.equal(r.finishReason, "STOP");
    assert.equal(r.partsCount, 2);
    assert.equal(r.candidateCount, 1);
    assert.equal(r.totalTextLength, r.text.length);
    assert.equal(r.promptTokenCount, 10);
    assert.equal(r.maxOutputTokens, 8192);
    assert.equal(r.textPartLengths[0], 41);
    assert.equal(r.textPartLengths[1], 21);

    // 2. response.text (backward compat) trả string.
    const plain = makeProvider({ candidates: [{ content: { parts: [{ text: "abc" }] } }] });
    const s = await plain.generate("prompt");
    assert.equal(s, "abc");

    // 3. maxOutputTokens từ env override.
    process.env.GEMINI_MAX_OUTPUT_TOKENS = "4096";
    const r2 = await makeProvider({ candidates: [{ content: { parts: [{ text: "x" }] } }] }).generateWithMeta("p");
    assert.equal(r2.maxOutputTokens, 4096);
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS;

    // 4. empty response -> lỗi rõ (có finishReason).
    const empty = makeProvider({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] });
    let thrown = null;
    try { await empty.generateWithMeta("p"); } catch (e) { thrown = e; }
    assert.ok(thrown, "empty response phải lỗi");
    assert.match(thrown.message, /empty response/);

    console.log("Gemini Provider Meta test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
