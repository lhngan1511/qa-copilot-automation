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
        // Thư mục cố định chứa test sinh — khớp testDir trong playwright.config.js
        this.outputDir = outputDir ?? path.join(process.cwd(), "outputs", "generated-tests");
    }

    /** Trích locator page.getBy* từ một biểu thức (vd playwrightAssertion). */
    extractLocator(expr) {
        const re = /page\.(getByRole|getByText|getByPlaceholder|getByTestId|getByLabel|locator)\([^;]*?\)/;
        const m = re.exec(String(expr ?? ""));
        return m ? m[0].trim() : null;
    }

    /**
     * Xây allowlist locator từ APPROVED mapping — CHỈ từ mapping, KHÔNG từ codegen/đoán.
     * @returns {Map<string,string>} locatorId -> locator
     */
    buildLocatorAllowlist(mapping) {
        const allow = new Map();
        for (const s of mapping?.stepMappings ?? []) {
            const loc = this.extractLocator(s.locator) || s.locator;
            if (loc) allow.set(`step-${s.stepOrder}`, loc);
        }
        for (const a of mapping?.assertionMappings ?? []) {
            const loc = this.extractLocator(a.playwrightAssertion) || a.playwrightAssertion;
            if (loc) allow.set(`assert-${a.assertionIndex ?? allow.size}`, loc);
        }
        if (mapping?.route?.value && mapping.route.value.startsWith("page.")) {
            const loc = this.extractLocator(mapping.route.value) || mapping.route.value;
            allow.set("route", loc);
        }
        return allow;
    }

    /** Lọc chỉ những locator thuộc allowlist (để khớp). */
    collectMappingLocators(mapping) {
        return Array.from(this.buildLocatorAllowlist(mapping).values());
    }

    buildPrompt({ testCase, mapping, confirmedFacts }) {
        const allowlist = this.buildLocatorAllowlist(mapping);
        const allowListText = Array.from(allowlist.entries())
            .map(([id, loc]) => `  ${id}: ${loc}`)
            .join("\n");

        return [
            "Bạn là chuyên gia Playwright. Hãy sinh file test Playwright hoàn chỉnh cho testcase.",
            "Code phải là JAVASCRIPT THUẦN (.js). KHÔNG TypeScript: KHÔNG non-null assertion `!` (vd process.env.X!), KHÔNG type annotation `: string`, KHÔNG interface/type/enum, KHÔNG `as`. KHÔNG dùng `!` sau process.env.",
            "Dùng ES MODULE: dòng đầu phải là `import { test, expect } from '@playwright/test';`. TUYỆT ĐỐI KHÔNG dùng `require(...)` (dự án là ESM, package.json type:module).",
            "### QUY TẮC BẮT BUỘC — LOCATOR ALLOWLIST TUYỆT ĐỐI ###",
            "Chỉ được dùng CHÍNH XÁC locator có trong danh sách ALLOWED LOCATORS bên dưới (theo locatorId).",
            "KHÔNG tự viết locator bằng tên nghiệp vụ (vd getByLabel('Username')), KHÔNG suy đoán từ testcase.",
            "KHÔNG chuyển đổi: getByRole(...) -> getByLabel(...), hoặc tên tiếng Việt -> Username/Password/Captcha.",
            "Mỗi action/assertion phải dùng đúng locator đã approved. Nếu approved mapping thiếu locator cho một business step -> KHÔNG đoán, trả về ghi chú thiếu.",
            "Assertion implementation chỉ dùng từ assertionMappings đã approved. KHÔNG tự tạo message regex.",
            "Credential (username/password) lấy từ process.env.LOGIN_USERNAME và process.env.LOGIN_PASSWORD. KHÔNG hardcode.",
            "Base URL lấy từ process.env.BASE_URL. KHÔNG hardcode URL/host thật.",
            "Mã xác nhận (CAPTCHA) dùng Confirmed Fact ARBITRARY_NON_EMPTY_TEXT: là chuỗi bất kỳ KHÔNG RỖNG. KHÔNG được dùng lại sample từ Codegen (123456, 11111, 1234566, 123456@Aa...). Dùng một chuỗi khác, ví dụ '999999'.",
            "Tiêu đề test phải chứa mã testcase (vd TC001).",
            "Không sửa nội dung testcase. Không sinh thêm testcase.",
            "",
            "=== ALLOWED LOCATORS (chỉ dùng các locator này, theo locatorId) ===",
            allowListText || "  (KHÔNG có locator nào được phép — testcase không có locator approved)",
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
            "  LƯU Ý route: dùng CHÍNH XÁC mapping.route.value. KHÔNG thêm query returnUrl, KHÔNG hardcode host/IP.",
            "- fill/click theo từng step, dùng CHÍNH XÁC locator từ ALLOWED LOCATORS",
            "- assertion dùng playwrightAssertion từ mapping (chỉ locator approved)",
            "- KHÔNG hardcode credential, KHÔNG hardcode URL, KHÔNG dùng locator ngoài allowlist"
        ].join("\n");
    }

    /**
     * Xác định env credential nào BẮT BUỘC phải có trong code, dựa vào stepMappings.
     * - Có bước fill target chứa "Tài khoản"/"username" -> cần LOGIN_USERNAME.
     * - Có bước fill target chứa "Mật khẩu"/"password" -> cần LOGIN_PASSWORD.
     * Validation testcase bỏ trống field sẽ không yêu cầu env đó.
     * @returns {Set<string>}
     */
    requiredCredentialEnv(mapping) {
        const set = new Set();
        const steps = mapping?.stepMappings ?? [];
        for (const s of steps) {
            const business = String(s.businessStep ?? "").toLowerCase();
            const text = `${business} ${s.target ?? ""}`.toLowerCase();
            const isFill = String(s.actionType ?? "").toUpperCase() === "FILL";
            // Bước "để trống / bỏ trống" KHÔNG điền giá trị thật -> không cần env credential cho field đó
            const isEmptyStep = /để trống|bỏ trống|để trống field/.test(business);
            if (!isFill || isEmptyStep) continue;
            if (/tài khoản|username|account/.test(text)) set.add("LOGIN_USERNAME");
            if (/mật khẩu|password/.test(text)) set.add("LOGIN_PASSWORD");
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

        // 2. import — phải dùng ES module import (package.json type:module)
        if (!code.includes("import { test, expect } from '@playwright/test'") && !code.includes('import { test, expect } from "@playwright/test"')) {
            errors.push('Code phải dùng `import { test, expect } from "@playwright/test";` (ES module).');
        }
        // 2a. cấm require (CommonJS) — dự án ESM, require sẽ lỗi "require is not defined"
        if (/require\(\s*['"]@playwright\/test['"]\s*\)/.test(code)) {
            errors.push('Code dùng require("@playwright/test") (CommonJS) — dự án là ES module. Phải dùng `import { test, expect } from "@playwright/test";`.');
        }

        // 2b. JavaScript thuần (không TypeScript)
        const tsHints = [
            [/process\.env\.[A-Z_]+!/, "cú pháp non-null assertion `!` (TypeScript)"],
            [/:\s*(string|number|boolean|any|void|Promise<\w+>)\b/, "type annotation (TypeScript)"],
            [/\b(interface|type|enum)\s+\w+/, "khai báo interface/type/enum (TypeScript)"],
            [/\b(as\s+(string|number|any))\b/, "type assertion `as` (TypeScript)"]
        ];
        for (const [re, label] of tsHints) {
            if (re.test(code)) {
                errors.push(`Code chứa ${label} — phải là JavaScript thuần (.js), không dùng TypeScript.`);
            }
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
        // Chỉ yêu cầu env khi mapping CÓ bước fill field tương ứng
        // (TC002 bỏ trống Tài khoản -> không cần LOGIN_USERNAME; TC003 bỏ trống Mật khẩu -> không cần LOGIN_PASSWORD).
        const requiredEnv = this.requiredCredentialEnv(mapping);
        if (requiredEnv.has("LOGIN_USERNAME") && !code.includes("process.env.LOGIN_USERNAME")) {
            errors.push("Code không dùng process.env.LOGIN_USERNAME cho Tài khoản.");
        }
        if (requiredEnv.has("LOGIN_PASSWORD") && !code.includes("process.env.LOGIN_PASSWORD")) {
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

        // 6. locator — đối chiếu CHÍNH XÁC từng locator với allowlist (approved mapping).
        //    Không chấp nhận locator ngoài mapping, kể cả nếu có trong codegen.
        const allowlist = this.buildLocatorAllowlist(mapping);
        const allowedSet = new Set(
            Array.from(allowlist.values()).map((l) => this.normalizeLocator(l))
        );
        const re = /page\.(getByRole|getByText|getByPlaceholder|getByTestId|getByLabel|locator)\([^;]*?\)/g;
        let m;
        let foundLocator = false;
        while ((m = re.exec(code)) !== null) {
            const raw = m[0];
            foundLocator = true;
            const norm = this.normalizeLocator(raw);
            if (!allowedSet.has(norm)) {
                errors.push(`Code dùng locator KHÔNG thuộc approved mapping: "${raw}" — reject toàn bộ output.`);
            }
        }
        // Nếu approved mapping có locator nhưng code không dùng tới bất kỳ locator nào (cần đủ step)
        // => vẫn OK; chỉ reject khi có locator ngoài allowlist.

        return { ok: errors.length === 0, errors };
    }

    /** Chuẩn hóa locator để so khớp chính xác (bỏ khoảng trắng thừa, thống nhất nháy). */
    normalizeLocator(locator) {
        return String(locator ?? "")
            .replace(/\s+/g, " ")
            .replace(/"([^"]*)"/g, "'$1'")
            .replace(/\s*([(),{}])\s*/g, "$1")
            .trim();
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
        fs.mkdirSync(this.outputDir, { recursive: true });
        const file = path.join(this.outputDir, `${testCaseId}.spec.js`);
        fs.writeFileSync(file, code);
        return file;
    }
}
