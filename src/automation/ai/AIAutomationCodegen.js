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
import { extractFencedCode, validateGeneratedCode } from "./codegenGuard.js";
import { buildSpecFromMapping } from "./codegenSkeleton.js";
import { extractCodegenLocators } from "./locatorValidation.js";
import { renderGotoStatement } from "./testDataBinding.js";

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
     * Bao gồm locator của authenticationSetup + navigationChain (đã APPROVED) + business steps + assertions.
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
        // authenticationSetup (steps)
        for (const st of mapping?.authenticationSetup?.steps ?? []) {
            const loc = this.extractLocator(st.locator) || st.locator;
            if (loc) allow.set(`auth-${st.stepOrder ?? allow.size}`, loc);
        }
        // navigationChain (steps)
        for (const st of mapping?.navigationChain?.steps ?? []) {
            const loc = this.extractLocator(st.locator) || st.locator;
            if (loc) allow.set(`nav-${st.stepOrder ?? allow.size}`, loc);
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
            "Credential (username/password/captcha) lấy từ process.env.LOGIN_USERNAME, LOGIN_PASSWORD, LOGIN_CAPTCHA. KHÔNG hardcode.",
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
            "- KHÔNG hardcode credential, KHÔNG hardcode URL, KHÔNG dùng locator ngoài allowlist",
            "",
            "### QUAN TRỌNG — KHÔNG LẶP LẠI AUTH/NAVIGATION ###",
            "Nếu mapping có authenticationSetup + navigationChain (đã APPROVED), Generator sẽ TỰ chèn sẵn: goto entryRoute, login, và navigationChain.",
            "Bạn CHỈ cần sinh PHẦN BUSINESS STEPS + ASSERTION.",
            "KHÔNG sinh lại page.goto('/wasuco/login'), KHÔNG sinh lại fill Tài khoản/Mật khẩu/Mã xác nhận/click Đăng nhập, KHÔNG sinh lại click Asset/Danh mục/Đơn vị tính.",
            "Bắt đầu trực tiếp từ business steps (vd click 'Thêm mới', fill 'Tên đơn vị tính', ...) rồi assertion."
        ].join("\n");
    }

    /** Rút gọn prompt Generate: chỉ gửi testcase + mapping + output contract (tránh tốn token). */
    buildCompactPrompt({ testCase, mapping, codegenText }) {
        const id = String(testCase?.id ?? testCase?.testcaseId ?? "TC");
        const title = testCase?.title || testCase?.testScenario || "Automation";
        const compactTestCase = {
            id,
            title,
            module: testCase?.module,
            type: testCase?.type,
            testData: testCase?.testData,
            expectedResult: testCase?.expectedResult || testCase?.expectedResults?.[0] || ""
        };
        const compactMapping = {
            entryRoute: mapping?.entryRoute?.value,
            authenticationSetup: mapping?.authenticationSetup,
            navigationChain: mapping?.navigationChain,
            stepMappings: mapping?.stepMappings,
            assertionMappings: mapping?.assertionMappings
        };
        return [
            "Bạn là chuyên gia Playwright. Sinh file test Playwright cho testcase.",
            "Chỉ trả JavaScript thuần (.js). KHÔNG Markdown, KHÔNG giải thích, KHÔNG code fence.",
            "Dòng đầu: import { test, expect } from '@playwright/test'; (ES module, KHÔNG require).",
            "Tiêu đề test phải chứa " + id + ".",
            "page.goto dùng process.env.BASE_URL + route từ mapping (KHÔNG hardcode URL/host).",
            "Credential (tài khoản/mật khẩu/mã xác nhận) dùng process.env.LOGIN_USERNAME/LOGIN_PASSWORD/LOGIN_CAPTCHA (KHÔNG hardcode).",
            "Chỉ dùng locator CÓ trong mapping. KHÔNG bịa locator.",
            "Bắt buộc: đúng một test(...); ít nhất một assertion; kết thúc chính xác bằng });",
            "",
            "=== TESTCASE ===",
            JSON.stringify(compactTestCase),
            "",
            "=== MAPPING ===",
            JSON.stringify(compactMapping),
            "",
            "=== CODEGEN (tham khảo locator) ===",
            String(codegenText ?? "").slice(0, 4000),
            "",
            "=== OUTPUT CONTRACT ===",
            "Chỉ trả JavaScript thuần.\nKhông Markdown.\nKhông giải thích.\nPhải có:\n- import test/expect;\n- đúng một test(...);\n- page.goto dùng BASE_URL;\n- các steps;\n- ít nhất một assertion;\n- kết thúc chính xác bằng });"
        ].join("\n");
    }

    /**
     * Xác định env credential nào BẮT BUỘC phải có trong code.
     * Xét cả authenticationSetup.steps (login) và stepMappings.
     * - "Tài khoản"/"username" -> LOGIN_USERNAME.
     * - "Mật khẩu"/"password" -> LOGIN_PASSWORD.
     * - "Mã xác nhận"/"captcha" -> LOGIN_CAPTCHA.
     * Validation testcase bỏ trống field sẽ không yêu cầu env đó.
     * @returns {Set<string>}
     */
    requiredCredentialEnv(mapping) {
        const set = new Set();
        const allSteps = [
            ...(mapping?.authenticationSetup?.steps ?? []),
            ...(mapping?.stepMappings ?? [])
        ];
        for (const s of allSteps) {
            const business = String(s.businessStep ?? "").toLowerCase();
            const target = String(s.target ?? "").toLowerCase();
            const text = `${business} ${target}`.toLowerCase();
            const isFill = String(s.actionType ?? "").toUpperCase() === "FILL";
            // Bước "để trống / bỏ trống" KHÔNG điền giá trị thật -> không cần env credential cho field đó
            const isEmptyStep = /để trống|bỏ trống|để trống field/.test(business);
            if (!isFill || isEmptyStep) continue;
            if (/tài khoản|username|account/.test(text)) set.add("LOGIN_USERNAME");
            if (/mật khẩu|password/.test(text)) set.add("LOGIN_PASSWORD");
            if (/mã xác nhận|captcha/.test(text)) set.add("LOGIN_CAPTCHA");
        }
        return set;
    }

    /**
     * Validate code sau khi sinh.
     * Trả về errors (rỗng = OK).
     */
    validateCode({ code, mapping, codegenText, testCaseId, allowCodegenLocators = false }) {
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
        // Chỉ yêu cầu env khi mapping CÓ bước fill field tương ứng.
        // Chấp nhận cả LOGIN_* (cũ) và TESTDATA_* (runtime binding mới theo contract).
        const requiredEnv = this.requiredCredentialEnv(mapping);
        const envPresent = (key) => code.includes(`process.env.${key}`);
        if (requiredEnv.has("LOGIN_USERNAME") && !envPresent("LOGIN_USERNAME") && !envPresent("TESTDATA_USERNAME")) {
            errors.push("Code không dùng process.env.LOGIN_USERNAME / TESTDATA_USERNAME cho Tài khoản.");
        }
        if (requiredEnv.has("LOGIN_PASSWORD") && !envPresent("LOGIN_PASSWORD") && !envPresent("TESTDATA_PASSWORD")) {
            errors.push("Code không dùng process.env.LOGIN_PASSWORD / TESTDATA_PASSWORD cho Mật khẩu.");
        }
        if (requiredEnv.has("LOGIN_CAPTCHA") && !envPresent("LOGIN_CAPTCHA") && !envPresent("TESTDATA_CAPTCHA")) {
            errors.push("Code không dùng process.env.LOGIN_CAPTCHA / TESTDATA_CAPTCHA cho Mã xác nhận.");
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
        //    Khi fallback deterministic dùng assertion/locator trích từ CodeGen, cho phép
        //    thêm locator CÓ trong codegen source (CodeGen là nguồn "làm gì" theo contract).
        const allowlist = this.buildLocatorAllowlist(mapping);
        const allowedSet = new Set(
            Array.from(allowlist.values()).map((l) => this.normalizeLocator(l))
        );
        if (allowCodegenLocators && String(codegenText ?? "").trim()) {
            for (const loc of extractCodegenLocators(String(codegenText))) {
                allowedSet.add(this.normalizeLocator(loc));
            }
        }
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

    /**
     * Dựng prefix code cho entryRoute + authenticationSetup + navigationChain (từ mapping APPROVED).
     * Đảm bảo testcase mở entry route, đăng nhập, điều hướng trước khi business steps.
     * Chỉ dùng khi mapping có authenticationSetup/navigationChain (đã APPROVED).
     */
    buildSetupPrefix(mapping) {
        const lines = [];
        const entryRoute = mapping?.entryRoute?.value;
        // Chỉ loại bỏ nếu là mô tả (chứa '->' hoặc '→'), KHÔNG loại URL path có dấu gạch (vd /danh-muc).
        // Nếu entryRoute là URL tuyệt đối -> không nối BASE_URL (tránh URL đúp).
        const goto = renderGotoStatement(entryRoute);
        if (goto) lines.push(goto);
        // authenticationSetup steps (đã approved)
        for (const st of mapping?.authenticationSetup?.steps ?? []) {
            lines.push(this.renderStep(st));
        }
        // navigationChain steps (đã approved)
        for (const st of mapping?.navigationChain?.steps ?? []) {
            lines.push(this.renderStep(st));
        }
        return lines;
    }

    /** Render 1 step (auth/nav) thành dòng Playwright, dùng locator + actionType approved. */
    renderStep(st) {
        const loc = st.locator ?? "";
        const action = String(st.actionType ?? "CLICK").toUpperCase();
        const target = String(st.target ?? "").toLowerCase();
        // map credential theo target (chỉ cho auth steps)
        let value = st.valueRef ? this.valueExpr(st.valueRef) : null;
        if (action === "FILL" && !value) {
            if (/tài khoản|username|account/.test(target)) value = "process.env.LOGIN_USERNAME";
            else if (/mật khẩu|password/.test(target)) value = "process.env.LOGIN_PASSWORD";
            else if (/mã xác nhận|captcha/.test(target)) value = "process.env.LOGIN_CAPTCHA";
        }
        switch (action) {
            case "FILL": return `  await ${loc}.fill(${value ?? "''"});`;
            case "CLICK": return `  await ${loc}.click();`;
            case "PRESS": return `  await ${loc}.press(${value ?? "'Enter'"});`;
            case "SELECT": return `  await ${loc}.selectOption(${value ?? "''"});`;
            default: return `  await ${loc}.click();`;
        }
    }

    valueExpr(v) {
        if (typeof v === "string" && v.startsWith("literal:")) return JSON.stringify(v.slice(8));
        if (typeof v === "string" && v.startsWith("env:")) return `process.env.${v.slice(4)}`;
        return JSON.stringify(v ?? "");
    }

    /**
     * Loại bỏ phần auth/navigation bị Gemini sinh trùng trong body (đã có prefix).
     * Nếu mapping có authenticationSetup/navigationChain, xoá các dòng goto login / fill credential /
     * click Đăng nhập / click Asset/Danh mục/Đơn vị tính khỏi phần code do Gemini sinh.
     */
    stripDuplicateSetup(code, mapping) {
        const hasSetup = (mapping?.authenticationSetup?.steps?.length > 0) ||
                         (mapping?.navigationChain?.steps?.length > 0);
        if (!hasSetup) return code;
        const lines = code.split("\n");
        const keep = [];
        let skipBlock = false;
        // các từ khoá login/nav lặp (nếu gặp goto login hoặc login block bắt đầu)
        const authNavLocators = new Set([
            "login", "Tài khoản", "Mật khẩu", "Mã xác nhận", "Đăng nhập",
            "Asset Quản lý trang thiết bị", "Danh mục", "Đơn vị tính"
        ]);
        for (const raw of lines) {
            const line = raw.trim();
            // bắt đầu một block goto login -> bỏ từ đây cho tới hết login
            if (/page\.goto\(.*\/wasuco\/login/.test(line)) {
                skipBlock = true;
                continue;
            }
            // nếu đang trong block login, bỏ các dòng fill/click login
            if (skipBlock) {
                // kết thúc block login khi gặp business step đầu tiên (không phải auth/nav)
                const isBusiness = /Thêm mới|Tên đơn vị|text search|Tìm|Cập nhật/.test(line) && !/login/i.test(line);
                if (isBusiness) {
                    skipBlock = false;
                    keep.push(raw);
                }
                continue;
            }
            // bỏ dòng click navigation trùng (Asset/Danh mục/Đơn vị tính) khi đã có prefix
            if (/getByRole\('(link|button)'\s*,\s*\{\s*name:\s*'(Asset Quản lý trang thiết bị|Danh mục|Đơn vị tính)'/.test(line)) {
                continue;
            }
            keep.push(raw);
        }
        return keep.join("\n");
    }

    /** Làm sạch code AI: bỏ fence, strip auth/nav trùng, chèn setup prefix. */
    assembleAiCode(raw, mapping) {
        const clean = extractFencedCode(raw);
        const stripped = this.stripDuplicateSetup(clean, mapping);
        const setupPrefix = this.buildSetupPrefix(mapping);
        let final = stripped;
        if (setupPrefix.length > 0) {
            const prefixBlock = setupPrefix.join("\n") + "\n";
            const bodyMatch = /(\basync\s*\(\{\s*page\s*\}\)\s*=>\s*\{)([\s\S]*)$/;
            if (bodyMatch.test(final)) {
                final = final.replace(bodyMatch, (_m, open, rest) => open + "\n" + prefixBlock + rest);
            }
        }
        return final;
    }

    /** Gọi provider lấy code (ưu tiên generateWithMeta nếu có, rồi generate). */
    async callProvider(prompt, opts = {}) {
        this.lastFinishReason = null;
        if (typeof this.aiProvider.generateWithMeta === "function") {
            const r = await this.aiProvider.generateWithMeta(prompt, opts);
            this.lastFinishReason = r?.finishReason ?? null;
            this.lastProviderMeta = r;
            return String(r?.text ?? "");
        }
        const raw = await this.aiProvider.generate(prompt, opts);
        if (typeof raw === "string") return raw;
        if (raw && typeof raw === "object") {
            this.lastFinishReason = raw.finishReason ?? raw.finish_reason ?? null;
            return String(raw.text ?? raw.code ?? "");
        }
        return String(raw ?? "");
    }

    async generate({ testCase, mapping, codegenFile = null, codegenText = null, confirmedFacts = [] }) {
        const text = codegenText ?? (codegenFile ? fs.readFileSync(codegenFile, "utf8") : "");
        const testCaseId = testCase.id ?? testCase.testcaseId ?? "";

        // Prompt rút gọn — chỉ gửi TC + mapping + output contract.
        const compactPrompt = this.buildCompactPrompt({ testCase, mapping, codegenText: text });
        console.log(`[CODEGEN_PROMPT] characterCount=${compactPrompt.length}`);

        const maxTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 8192) || 8192;

        let final = "";
        let guard = { ok: false, errorCode: "?", reason: "" };
        let source = "ai";
        let finishReasons = [];

        // Lần 1: AI (prompt rút gọn, đủ token).
        {
            const raw = await this.callProvider(compactPrompt, { maxOutputTokens: maxTokens });
            finishReasons.push(this.lastFinishReason ?? "?");
            console.log(`[CODEGEN_AI_RAW] characterCount=${String(raw).length} finishReason=${this.lastFinishReason ?? "?"}`);
            final = this.assembleAiCode(raw, mapping);
            guard = validateGeneratedCode({ code: final, testCaseId });
            console.log(`[CODEGEN_GUARD] attempt=1 ok=${guard.ok} errorCode=${guard.errorCode ?? "?"} reason=${guard.reason || "?"}`);
        }

        // Lần 2: retry đúng 1 lần nếu chưa hoàn chỉnh (tăng token / nhắc lại).
        if (!guard.ok) {
            const retryPrompt =
                this.buildCompactPrompt({ testCase, mapping, codegenText: text }) +
                "\n\nLẦN 2: Output trước bị cắt cụt. Phải trả code ĐẦY ĐỦ, đóng chính xác bằng `});`. KHÔNG viết giải thích.";
            const raw2 = await this.callProvider(retryPrompt, { maxOutputTokens: Math.max(maxTokens, 8192) });
            finishReasons.push(this.lastFinishReason ?? "?");
            console.log(`[CODEGEN_AI_RAW] attempt=2 characterCount=${String(raw2).length} finishReason=${this.lastFinishReason ?? "?"}`);
            final = this.assembleAiCode(raw2, mapping);
            guard = validateGeneratedCode({ code: final, testCaseId });
            console.log(`[CODEGEN_GUARD] attempt=2 ok=${guard.ok} errorCode=${guard.errorCode ?? "?"} reason=${guard.reason || "?"}`);
            if (guard.ok) source = "ai-retry";
        }

        // Fallback: deterministic code builder từ mapping đã xác nhận (không gọi AI lần 3).
        // Giữ action CodeGen + resolve testData theo thứ tự ưu tiên + assertion thật.
        if (!guard.ok) {
            const fallback = buildSpecFromMapping({ testCase, mapping, codegenText: text });
            if (fallback.ok) {
                final = fallback.code;
                guard = validateGeneratedCode({ code: final, testCaseId });
                source = "deterministic-fallback";
            } else {
                // Fallback từ chối (thiếu data / thiếu assertion thật) — báo rõ, không tự bịa.
                final = "";
                guard = { ok: false, errorCode: fallback.errorCode, reason: fallback.reason };
                source = "deterministic-fallback-rejected";
            }
            console.log(`[CODEGEN_FALLBACK] ok=${guard.ok} errorCode=${guard.errorCode ?? "?"} reason=${guard.reason || "?"}`);
        }

        console.log(
            `[CODEGEN_EXTRACTED] characterCount=${String(final ?? "").length} source=${source} ` +
            `startsWith=${JSON.stringify(String(final).slice(0, 30))} ` +
            `endsWith=${JSON.stringify(String(final).slice(-40))} ` +
            `finishReasons=${JSON.stringify(finishReasons)}`
        );

        // Truy vết khoảng đứt: EXTRACTED -> rule validation -> WRITE.
        console.log(
            `[CODEGEN_RULE_VALIDATION_START] testCaseId=${testCaseId || "?"} source=${source} characterCount=${String(final ?? "").length}`
        );
        const validation = this.validateCode({
            code: final,
            mapping,
            codegenText: text,
            testCaseId,
            allowCodegenLocators: source.startsWith("deterministic-fallback")
        });
        console.log(
            `[CODEGEN_RULE_VALIDATION_RESULT] ok=${validation.ok} errors=${JSON.stringify(validation.errors ?? [])} warnings=${JSON.stringify(validation.warnings ?? [])} rejectedRule=${validation.ok ? "?" : "CODEGEN_RULE_VALIDATION_FAILED"}`
        );

        return { code: final, validation, guard, source, finishReasons };
    }

    writeFile({ code, testCaseId, module = "Login" }) {
        fs.mkdirSync(this.outputDir, { recursive: true });
        const file = path.join(this.outputDir, `${testCaseId}.spec.js`);
        // Ghi UTF-8 tường minh (không dùng Buffer latin1/binary, không URI-encode).
        fs.writeFileSync(file, code, "utf8");
        const stat = fs.statSync(file);
        // Truy vết sau khi ghi.
        console.log(`[CODEGEN_WRITE] characterCount=${String(code ?? "").length} fileSize=${stat.size} encoding=utf8`);
        return file;
    }
}
