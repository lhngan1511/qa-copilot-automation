/**
 * AIAutomationCodegen — Giai đoạn 2: AI Automation Code Generation.
 *
 * Nhận provider (GeminiProvider production / FakeAIProvider test) qua constructor/DI.
 * Nhận testcase + APPROVED mapping + confirmed facts + rules test data (credential từ .env),
 * gọi provider.generate(prompt) -> sinh file Playwright hoàn chỉnh.
 *
 * Code chỉ dùng locator trong mapping. Không bịa locator mới.
 * Credential lấy từ process.env.LOGIN_USERNAME / LOGIN_PASSWORD — không hardcode.
 * Base URL lấy từ process.env.BASE_URL — không hardcode URL.
 * CAPTCHA (Mã xác nhận) dùng Confirmed Fact ARBITRARY_NON_EMPTY_TEXT — không dùng sample từ Codegen.
 */
import fs from "node:fs";
import path from "node:path";
import { buildCodegenLocatorSet, isLocatorInCodegen } from "./locatorValidation.js";

// Sample CAPTCHA quan sát được trong Codegen — Generator KHÔNG được dùng lại.
const CAPTCHA_SAMPLES = ["123456", "11111", "1234566"];
// Sample password quan sát được trong Codegen — KHÔNG được dùng (credential phải từ env).
const PASSWORD_SAMPLES = ["123456@Aa", "123456@Â"];
// Host URL bị hardcode — phải thay bằng process.env.BASE_URL.
const HARDCODED_HOST = "172.16.1.100";

export default class AIAutomationCodegen {
    /**
     * @param {object} aiProvider  provider có async generate(prompt)
     * @param {object} [opts]
     * @param {object} [opts.env]  dùng cho test (mặc định process.env)
     * @param {string} [opts.outputDir]
     */
    constructor(aiProvider, { env = null, outputDir = null } = {}) {
        if (!aiProvider || typeof aiProvider.generate !== "function") {
            throw new Error("AIAutomationCodegen cần aiProvider có generate(prompt).");
        }
        this.aiProvider = aiProvider;
        this.env = env ?? process.env;
        this.outputDir = outputDir ?? path.join(process.cwd(), "outputs", "generated");
    }

    collectMappingLocators(mapping) {
        const locators = [];
        for (const s of mapping.stepMappings ?? []) {
            if (s.locator) locators.push(s.locator);
        }
        for (const a of mapping.assertionMappings ?? []) {
            if (a.playwrightAssertion) locators.push(a.playwrightAssertion);
        }
        if (mapping.route?.value && mapping.route.value.startsWith("page.")) {
            locators.push(mapping.route.value);
        }
        return locators;
    }

    buildPrompt({ testCase, mapping, confirmedFacts }) {
        return [
            "Bạn là chuyên gia Playwright. Hãy sinh file test Playwright hoàn chỉnh cho testcase.",
            "CHỈ dùng locator có trong APPROVED MAPPING. Không bịa locator mới.",
            "Credential (username/password) lấy từ process.env.LOGIN_USERNAME và process.env.LOGIN_PASSWORD. KHÔNG hardcode.",
            "Base URL lấy từ process.env.BASE_URL. KHÔNG hardcode URL/host thật.",
            "Mã xác nhận (CAPTCHA) dùng Confirmed Fact ARBITRARY_NON_EMPTY_TEXT: là chuỗi bất kỳ KHÔNG RỖNG. KHÔNG được dùng lại sample từ Codegen (123456, 11111, 1234566, 123456@Aa...). Dùng một chuỗi khác, ví dụ '999999' hoặc bất kỳ chuỗi không rỗng nào.",
            "Tiêu đề test phải chứa mã testcase (vd TC001).",
            "Không sửa nội dung testcase. Không sinh thêm testcase.",
            "",
            "=== TESTCASE (approved) ===",
            JSON.stringify(testCase, null, 2),
            "",
            "=== APPROVED MAPPING ===",
            JSON.stringify(mapping, null, 2),
            "",
            "=== CONFIRMED FACTS ===",
            JSON.stringify(confirmedFacts ?? [], null, 2),
            "",
            "=== YÊU CẦU OUTPUT ===",
            "Trả về DUY NHẤT file Playwright hoàn chỉnh, có:",
            "- import { test, expect } from '@playwright/test';",
            "- test('<TC001 - tên>', async ({ page }) => { ... })  // tiêu đề chứa TC001",
            "- goto: await page.goto(process.env.BASE_URL + '<route từ mapping>');",
            "  LƯU Ý route: dùng CHÍNH XÁC mapping.route.value (vd '/user/login'). KHÔNG thêm query returnUrl, KHÔNG hardcode host/IP vào chuỗi route.",
            "- fill/click theo từng step, dùng locator từ mapping",
            "- Tài khoản: fill(process.env.LOGIN_USERNAME)",
            "- Mật khẩu: fill(process.env.LOGIN_PASSWORD)",
            "- Mã xác nhận: fill(<chuỗi không rỗng, KHÔNG phải sample codegen>)",
            "- assertion dùng playwrightAssertion từ mapping",
            "- KHÔNG hardcode credential, KHÔNG hardcode URL, KHÔNG dùng locator ngoài mapping"
        ].join("\n");
    }

    collectAllowedLocators(mapping, codegenText) {
        const set = buildCodegenLocatorSet(codegenText);
        for (const loc of this.collectMappingLocators(mapping)) {
            set.add(loc);
        }
        return set;
    }

    /**
     * Validate code sau khi sinh.
     * Trả về errors (rỗng = OK).
     */
    validateCode({ code, mapping, codegenText, testCaseId }) {
        const errors = [];
        const id = testCaseId || "";

        // 1. testcase id — phải xuất hiện trong code (tiêu đề test)
        if (!id || !code.includes(id)) {
            errors.push(`Code thiếu testcase ID "${id}" (tiêu đề test phải chứa ${id}).`);
        }

        // 2. import
        if (!code.includes("from '@playwright/test'") && !code.includes('from "@playwright/test"')) {
            errors.push('Code thiếu import "@playwright/test".');
        }

        // 3. URL hardcode — goto phải dùng process.env.BASE_URL.
        //    Chỉ flag khi đối số goto là string literal http://... hardcode (không phải returnUrl trong route).
        const gotoHardcode = /page\.goto\(\s*['"`][^'"`]*https?:\/\/[^'"`]*['"`]/i;
        if (gotoHardcode.test(code)) {
            errors.push("Code hardcode URL trong page.goto(). Phải dùng process.env.BASE_URL + '<route>'. Không hardcode host/host:port.");
        }
        if (!code.includes("process.env.BASE_URL")) {
            errors.push("Code không dùng process.env.BASE_URL cho page.goto().");
        }

        // 4. Credential — phải dùng env. Chỉ flag khi một STRING LITERAL trong code BẰNG giá trị credential thật
        //    (tránh false-positive khi code chỉ dùng process.env.LOGIN_USERNAME/LOGIN_PASSWORD).
        const literals = code.match(/['"`][^'"`]*['"`]/g) || [];
        const literalValues = new Set(literals.map((l) => l.slice(1, -1)));
        const credentialValues = [this.env.LOGIN_USERNAME, this.env.LOGIN_PASSWORD].filter(Boolean);
        for (const v of credentialValues) {
            if (v && literalValues.has(v)) {
                errors.push("Code hardcode giá trị credential (lộ LOGIN_USERNAME/LOGIN_PASSWORD). Phải dùng process.env.");
            }
        }
        if (!code.includes("process.env.LOGIN_USERNAME")) {
            errors.push("Code không dùng process.env.LOGIN_USERNAME cho Tài khoản.");
        }
        if (!code.includes("process.env.LOGIN_PASSWORD")) {
            errors.push("Code không dùng process.env.LOGIN_PASSWORD cho Mật khẩu.");
        }

        // 5. CAPTCHA — không dùng sample từ Codegen
        for (const sample of CAPTCHA_SAMPLES) {
            if (code.includes(sample)) {
                errors.push(`Code dùng sample CAPTCHA từ Codegen ("${sample}") — phải dùng chuỗi không rỗng khác (Confirmed Fact ARBITRARY_NON_EMPTY_TEXT).`);
            }
        }
        // password sample cũng không được dùng
        for (const sample of PASSWORD_SAMPLES) {
            if (code.includes(sample)) {
                errors.push(`Code chứa sample credential từ Codegen ("${sample}") — không được dùng.`);
            }
        }

        // 6. locator — mọi page.getBy* phải nằm trong allowed set
        const allowed = this.collectAllowedLocators(mapping, codegenText);
        const re = /page\.(getByRole|getByText|getByPlaceholder|getByTestId|locator|getByLabel)\([^;]*?\)/g;
        let m;
        while ((m = re.exec(code)) !== null) {
            const raw = m[0];
            if (!isLocatorInCodegen(raw, allowed)) {
                errors.push(`Code dùng locator ngoài mapping/codegen: "${raw}"`);
            }
        }

        return { ok: errors.length === 0, errors };
    }

    async generate({ testCase, mapping, codegenFile = null, codegenText = null, confirmedFacts = [] }) {
        const text = codegenText ?? (codegenFile ? fs.readFileSync(codegenFile, "utf8") : "");
        const prompt = this.buildPrompt({ testCase, mapping, confirmedFacts });
        const code = await this.aiProvider.generate(prompt);
        const clean = code.replace(/^```(?:js|javascript)?\s*/i, "").replace(/```\s*$/, "").trim();
        const validation = this.validateCode({
            code: clean,
            mapping,
            codegenText: text,
            testCaseId: testCase.id ?? testCase.testcaseId ?? ""
        });
        return { code: clean, validation };
    }

    writeFile({ code, testCaseId, module = "Login" }) {
        const dir = path.join(this.outputDir, module);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${testCaseId}.spec.js`);
        fs.writeFileSync(file, code);
        return file;
    }
}
