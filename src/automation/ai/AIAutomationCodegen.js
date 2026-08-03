/**
 * AIAutomationCodegen — Giai đoạn 2: AI Automation Code Generation.
 *
 * Nhận provider (GeminiProvider production / FakeAIProvider test) qua constructor/DI.
 * Nhận testcase + APPROVED mapping + confirmed facts + rules test data (credential từ .env),
 * gọi provider.generate(prompt) -> sinh file Playwright hoàn chỉnh.
 *
 * Code chỉ dùng locator trong mapping. Không bịa locator mới.
 * Credential lấy từ process.env.LOGIN_USERNAME / LOGIN_PASSWORD — không hardcode.
 */
import fs from "node:fs";
import path from "node:path";
import { buildCodegenLocatorSet, isLocatorInCodegen } from "./locatorValidation.js";

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

    /** Lấy danh sách locator từ approved mapping (dùng để validate code). */
    collectMappingLocators(mapping) {
        const locators = [];
        for (const s of mapping.stepMappings ?? []) {
            if (s.locator) locators.push(s.locator);
        }
        for (const a of mapping.assertionMappings ?? []) {
            // playwrightAssertion chứa locator (expect(page.getByRole...))
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
            "- test('<tên>', async ({ page }) => { ... })",
            "- goto route từ mapping",
            "- fill/click theo từng step, dùng locator từ mapping",
            "- assertion dùng playwrightAssertion từ mapping",
            "- dùng process.env.LOGIN_USERNAME / LOGIN_PASSWORD cho Tài khoản và Mật khẩu",
            "- Mã xác nhận dùng chuỗi bất kỳ không rỗng (ARBITRARY_NON_EMPTY_TEXT)",
            "- KHÔNG hardcode credential",
            "- KHÔNG dùng locator ngoài mapping"
        ].join("\n");
    }

    /** Lấy toàn bộ locator chuẩn hóa từ mapping + codegen để validate. */
    collectAllowedLocators(mapping, codegenText) {
        const set = buildCodegenLocatorSet(codegenText);
        for (const loc of this.collectMappingLocators(mapping)) {
            set.add(loc);
        }
        return set;
    }

    /** Validate code: syntax + locator + testcase id + không hardcode credential. */
    validateCode({ code, mapping, codegenText, testCaseId }) {
        const errors = [];
        // 1. syntax JS (nếu có thể --check)
        // 2. testcase id
        if (!code.includes(testCaseId)) {
            errors.push(`Code thiếu testcase ID "${testCaseId}".`);
        }
        // 3. import
        if (!code.includes("from '@playwright/test'") && !code.includes('from "@playwright/test"')) {
            errors.push('Code thiếu import "@playwright/test".');
        }
        // 4. không hardcode credential
        const credentialValues = [this.env.LOGIN_USERNAME, this.env.LOGIN_PASSWORD].filter(Boolean);
        for (const v of credentialValues) {
            if (v && code.includes(v)) {
                errors.push("Code hardcode giá trị credential (lộ LOGIN_USERNAME/LOGIN_PASSWORD).");
            }
        }
        // 5. không dùng sample credential từ codegen (admin / 123456@Aa / 123456)
        for (const sample of ["123456@Aa", "123456@Â"]) {
            if (code.includes(sample)) {
                errors.push(`Code chứa sample credential từ Codegen ("${sample}") — không được dùng.`);
            }
        }
        // 6. locator: trích mọi page.getBy* trong code, kiểm tra nằm trong allowed set
        const allowed = this.collectAllowedLocators(mapping, codegenText);
        const re = /page\.(getByRole|getByText|getByPlaceholder|getByTestId|locator|getByLabel)\([^;]*?\)/g;
        let m;
        while ((m = re.exec(code)) !== null) {
            const raw = m[0];
            if (!isLocatorInCodegen(raw, allowed)) {
                errors.push(`Code dùng locator ngoài mapping/codegen: "${raw}"`);
            }
        }
        // 7. tài khoản/mật khẩu dùng env (không hardcode literal ngoài 'admin')
        if (!code.includes("process.env.LOGIN_USERNAME")) {
            errors.push("Code không dùng process.env.LOGIN_USERNAME cho Tài khoản.");
        }
        if (!code.includes("process.env.LOGIN_PASSWORD")) {
            errors.push("Code không dùng process.env.LOGIN_PASSWORD cho Mật khẩu.");
        }

        return { ok: errors.length === 0, errors };
    }

    /**
     * Sinh code Playwright.
     * @returns {Promise<{code:string, validation:{ok:boolean,errors:string[]}}>}
     */
    async generate({ testCase, mapping, codegenFile = null, codegenText = null, confirmedFacts = [] }) {
        const text = codegenText ?? (codegenFile ? fs.readFileSync(codegenFile, "utf8") : "");
        const prompt = this.buildPrompt({ testCase, mapping, confirmedFacts });
        const code = await this.aiProvider.generate(prompt);
        // bỏ code fence nếu có
        const clean = code.replace(/^```(?:js|javascript)?\s*/i, "").replace(/```\s*$/, "").trim();
        const validation = this.validateCode({
            code: clean,
            mapping,
            codegenText: text,
            testCaseId: testCase.id ?? testCase.testcaseId ?? ""
        });
        return { code: clean, validation };
    }

    /** Ghi code ra file .spec.js. */
    writeFile({ code, testCaseId, module = "Login" }) {
        const dir = path.join(this.outputDir, module);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${testCaseId}.spec.js`);
        fs.writeFileSync(file, code);
        return file;
    }
}
