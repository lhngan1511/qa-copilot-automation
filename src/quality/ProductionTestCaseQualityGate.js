import TestStepNormalizer from "../normalizers/TestStepNormalizer.js";
import testerFacingText from "../utils/TesterFacingText.js";
import { resolveExecutionReadiness } from "../utils/TestDataReadiness.js";

const FINAL_TYPES = new Set([
    "POSITIVE",
    "CONFIRMED_FACT",
    "VALIDATION",
    "NEGATIVE",
    "BUSINESS_RULE",
    "PERMISSION",
    "BOUNDARY",
    "DATA_INTEGRITY"
]);

export default class ProductionTestCaseQualityGate {
    constructor({ stepNormalizer = new TestStepNormalizer() } = {}) {
        this.stepNormalizer = stepNormalizer;
        this.lastSummary = this.emptySummary();
    }

    apply(testCases, { requirement = {}, knowledge = {} } = {}) {
        const candidates = Array.isArray(testCases) ? testCases : [];
        const context = this.context(requirement, knowledge);
        const accepted = [];
        const excluded = [];
        const corrected = [];
        const held = [];
        const seen = new Set();

        candidates.forEach((source, index) => {
            const testCase = structuredClone(source ?? {});
            const originalId = testCase.id ?? testCase.testcaseId ?? `#${index + 1}`;
            const issues = [];

            this.cleanTesterFacingContent(testCase);
            this.normalizeType(testCase);
            const dataResult = this.resolveFieldConflicts(testCase.testData);
            testCase.testData = dataResult.testData;
            this.normalizeTitleFromBehavior(testCase);
            if (dataResult.corrected) {
                issues.push("CONFLICTING_TEST_DATA_RESOLVED");
                testCase.executionReadiness = resolveExecutionReadiness(testCase.testData);
            }

            testCase.steps = this.stepNormalizer.normalize(testCase.steps, {
                ...testCase,
                preserveManualSteps: true
            });
            testCase.steps = this.removeRedundantDataSteps(testCase);

            const decision = this.evaluate(testCase, context);
            if (!decision.accepted) {
                const item = {
                    testcaseId: originalId,
                    code: decision.code,
                    testerMessage: decision.testerMessage
                };
                excluded.push(item);
                if (decision.hold) held.push(item);
                return;
            }

            const signature = this.signature(testCase);
            if (signature && seen.has(signature)) {
                excluded.push({
                    testcaseId: originalId,
                    code: "DUPLICATE_TESTCASE",
                    testerMessage: "Testcase này kiểm tra cùng một nội dung với testcase đã có."
                });
                return;
            }
            if (signature) seen.add(signature);

            if (issues.length > 0) {
                corrected.push({ testcaseId: originalId, codes: issues });
            }
            accepted.push(testCase);
        });

        accepted.forEach((testCase, index) => {
            const id = `TC${String(index + 1).padStart(3, "0")}`;
            testCase.id = id;
            testCase.testcaseId = id;
        });

        this.lastSummary = {
            generatedCount: candidates.length,
            finalCount: accepted.length,
            excludedCount: excluded.length,
            correctedCount: corrected.length,
            heldCount: held.length,
            excluded,
            corrected,
            held,
            countByType: this.countByType(accepted)
        };
        return { testCases: accepted, summary: structuredClone(this.lastSummary) };
    }

    evaluate(testCase, context) {
        const type = String(testCase.type ?? "").toUpperCase();
        const source = this.sourceText(testCase);
        if (!this.isGrounded(testCase, context)) {
            return this.reject(
                "UNSUPPORTED_BY_REQUIREMENT",
                "Testcase này chưa có thông tin xác nhận trong requirement."
            );
        }
        if (testCase.needsClarification === true || this.isAmbiguous(source)) {
            return this.reject(
                "TESTER_INFORMATION_REQUIRED",
                "Testcase này chưa có đủ thông tin để thực hiện.",
                true
            );
        }
        if (testCase.needsEnrichment === true) {
            return this.reject(
                "MISSING_EXECUTION_DETAIL",
                "Testcase này chưa có đủ thông tin để thực hiện.",
                true
            );
        }
        if (type === "PERMISSION" && !this.hasPermissionEvidence(testCase, context)) {
            return this.reject(
                "UNSUPPORTED_PERMISSION",
                "Requirement hiện chưa mô tả phân quyền nên chưa tạo testcase phân quyền."
            );
        }
        if (type === "BOUNDARY" && !this.hasConcreteBoundary(testCase)) {
            return this.reject(
                "UNSUPPORTED_BOUNDARY",
                "Requirement chưa có giới hạn rõ ràng nên chưa tạo testcase kiểm tra giới hạn.",
                true
            );
        }
        if (!FINAL_TYPES.has(type)) {
            return this.reject(
                "UNSUPPORTED_TESTCASE_TYPE",
                "Loại kiểm tra của testcase này chưa phù hợp với nội dung requirement."
            );
        }
        if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) {
            return this.reject(
                "MISSING_STEPS",
                "Testcase này chưa có đủ thông tin để thực hiện.",
                true
            );
        }
        if (testCase.steps.some(step => this.isVagueStep(step?.action))) {
            return this.reject(
                "VAGUE_STEPS",
                "Các bước thực hiện chưa mô tả rõ tester cần làm gì.",
                true
            );
        }
        if (!this.hasMainAction(testCase)) {
            return this.reject(
                "MISSING_MAIN_ACTION",
                "Testcase này chưa nêu rõ thao tác chính cần thực hiện.",
                true
            );
        }
        if (!this.expectedMatches(testCase)) {
            return this.reject(
                "EXPECTED_RESULT_MISMATCH",
                "Kết quả mong đợi chưa phù hợp với tình huống kiểm thử."
            );
        }
        return { accepted: true };
    }

    normalizeType(testCase) {
        const classification = this.key(testCase.ruleClassification);
        const category = this.key(
            testCase.sourceItem?.source ??
                testCase.sourceItem?.category ??
                testCase.sourceCategories?.[0]
        );
        let type = String(testCase.type ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");

        if (classification === "required") type = "VALIDATION";
        else if (["invalid reference", "invalid option"].includes(classification)) {
            type = category.includes("business rule") ? "BUSINESS_RULE" : "VALIDATION";
        } else if (classification === "duplicate") type = "BUSINESS_RULE";
        else if (classification === "permission denied") type = "PERMISSION";
        else if (classification.startsWith("boundary")) type = "BOUNDARY";
        else if (classification === "related data") type = "DATA_INTEGRITY";
        else if (category.includes("required validation") || category.includes("format or value")) {
            type = "VALIDATION";
        } else if (category.includes("business rule")) type = "BUSINESS_RULE";

        const aliases = {
            DATA_VALIDATION: "VALIDATION",
            RULE: "BUSINESS_RULE",
            EXCEPTION: "NEGATIVE",
            RISK: "NEGATIVE"
        };
        testCase.type = aliases[type] ?? type;
    }

    normalizeTitleFromBehavior(testCase) {
        const classification = String(testCase.ruleClassification ?? "").toUpperCase();
        const targetField = Object.entries(testCase.testData?.fields ?? {}).find(
            ([, field]) => String(field?.purpose ?? "VALID") !== "VALID"
        )?.[0];
        if (classification === "REQUIRED" && targetField) {
            testCase.title = `Hiển thị cảnh báo khi bỏ trống ${targetField}`;
            testCase.scenario = testCase.title;
            testCase.testScenario = testCase.title;
        }
        if (classification === "EMPTY_RESULT") {
            testCase.title = "Hiển thị trạng thái phù hợp khi không có dữ liệu";
            testCase.scenario = testCase.title;
            testCase.testScenario = testCase.title;
        }
    }

    resolveFieldConflicts(value) {
        const testData = value && typeof value === "object" ? structuredClone(value) : { fields: {} };
        const sourceFields =
            testData.fields && typeof testData.fields === "object" && !Array.isArray(testData.fields)
                ? testData.fields
                : {};
        const fields = {};
        const names = new Map();
        let corrected = false;

        Object.entries(sourceFields).forEach(([name, field]) => {
            const displayName = testerFacingText(name);
            const key = this.key(displayName);
            const existingName = names.get(key);
            if (!existingName) {
                names.set(key, displayName);
                fields[displayName] = structuredClone(field);
                if (displayName !== name) corrected = true;
                return;
            }
            corrected = true;
            fields[existingName] = this.resolveFieldState(existingName, fields[existingName], field);
        });

        testData.fields = fields;
        testData.requiresTesterInput = Object.values(fields).some(
            field => field?.requiresTesterInput === true
        );
        if (testData.requiresTesterInput && !String(testData.requirement ?? "").trim()) {
            testData.requirement = Object.values(fields)
                .filter(field => field?.requiresTesterInput)
                .map(field => field.instruction)
                .filter(Boolean)
                .join("; ");
        }
        return { testData, corrected };
    }

    resolveFieldState(name, first, second) {
        const left = first && typeof first === "object" ? first : { value: first, purpose: "VALID" };
        const right = second && typeof second === "object" ? second : { value: second, purpose: "VALID" };
        if (this.sameState(left, right)) return structuredClone(left);
        const leftValid = String(left.purpose ?? "VALID") === "VALID";
        const rightValid = String(right.purpose ?? "VALID") === "VALID";
        if (leftValid !== rightValid) return structuredClone(leftValid ? right : left);
        return {
            value: null,
            purpose: "INVALID",
            requiresTesterInput: true,
            instruction: `Xác định một giá trị kiểm thử duy nhất cho ${name}`
        };
    }

    removeRedundantDataSteps(testCase) {
        const functionName = this.key(testCase.function ?? testCase.feature);
        const nonValidFields = Object.entries(testCase.testData?.fields ?? {})
            .filter(([, field]) => String(field?.purpose ?? "VALID") !== "VALID")
            .map(([name]) => this.key(name));
        const actions = this.array(testCase.steps).map(step => this.key(step?.action));
        const hasSpecificInput = actions.some(action =>
            /^(nhap|chon mot|de trong) .+/.test(action)
        );
        return this.array(testCase.steps).filter((step, index) => {
            const action = actions[index];
            if (hasSpecificInput && /^(nhap|thay doi) thong tin/.test(action)) return false;
            if (/nhap gia tri .* da ton tai/.test(action)) {
                const namesSpecificField = nonValidFields.some(field => action.includes(field));
                if (!namesSpecificField && action.includes(functionName)) return false;
            }
            const existingRecord = action.match(/^chon mot (.+?) can (?:sua|xoa) dang ton tai$/)?.[1];
            if (
                existingRecord &&
                actions.some(
                    (other, otherIndex) =>
                        otherIndex !== index &&
                        (other === `chon ${existingRecord}` || other.includes(`tim kiem ${existingRecord}`))
                )
            ) {
                return false;
            }
            return true;
        });
    }

    cleanTesterFacingContent(testCase) {
        const clean = value =>
            testerFacingText(value)
                .replace(/\b(?:condition|source|ruleId)\s*:\s*/gi, "")
                .trim();
        ["title", "scenario", "testScenario", "objective", "testObjective", "expectedResult"].forEach(
            field => {
                if (typeof testCase[field] === "string") testCase[field] = clean(testCase[field]);
            }
        );
        testCase.expectedResults = this.array(testCase.expectedResults).map(clean).filter(Boolean);
        testCase.preconditions = this.array(testCase.preconditions).map(clean).filter(Boolean);
        this.array(testCase.steps).forEach(step => {
            if (typeof step?.action === "string") step.action = clean(step.action);
            if (typeof step?.expected === "string") step.expected = clean(step.expected);
        });
        Object.values(testCase.testData?.fields ?? {}).forEach(field => {
            if (typeof field?.instruction === "string") field.instruction = clean(field.instruction);
        });
        ["recordState", "dataState", "requirement"].forEach(field => {
            if (typeof testCase.testData?.[field] === "string") {
                testCase.testData[field] = clean(testCase.testData[field]);
            }
        });
    }

    isGrounded(testCase, context) {
        const candidates = [
            testCase.function,
            testCase.feature,
            testCase.sourceItem?.content,
            testCase.sourceItem?.text,
            ...this.array(testCase.coveredRules),
            ...this.array(testCase.requirementReferences)
        ]
            .map(value => this.key(value))
            .filter(value => value.length >= 4 && !/^(br|func|mod)\s*\d+$/.test(value));
        return candidates.some(value => context.evidence.includes(value) || value.includes(context.module));
    }

    hasPermissionEvidence(testCase, context) {
        const functionName = this.key(testCase.function ?? testCase.feature);
        const functionPermissions = context.functionPermissions.get(functionName) ?? [];
        const source = this.key(this.sourceText(testCase));
        return (
            /quyen|vai tro|duoc phep|khong duoc phep|permission|role/.test(
                this.key(`${source} ${functionPermissions.join(" ")}`)
            ) &&
            (functionPermissions.length > 0 || context.evidence.includes(source))
        );
    }

    hasConcreteBoundary(testCase) {
        const source = testerFacingText(this.sourceText(testCase));
        return (
            (/\d/.test(source) &&
                /toi da|toi thieu|min|max|gioi han|do dai|ky tu|so luong|khong qua|it nhat|nhieu nhat/.test(
                    this.key(source)
                )) ||
            /(?:<=|>=|<|>)|ngay bat dau.*ngay ket thuc/i.test(source) ||
            Object.keys(testCase.testData?.constraints ?? {}).length > 0
        );
    }

    hasMainAction(testCase) {
        const steps = this.array(testCase.steps);
        const type = String(testCase.type ?? "").toUpperCase();
        const operation = this.operation(testCase);
        const hasAction = steps.some(step => {
            const action = this.key(step?.action);
            if (!action) return false;
            if (operation === "SEARCH" && /\b(tim|tim kiem|loc|tra cuu)\b/.test(action)) {
                return true;
            }
            if (/^(mo|truy cap|di den) /.test(action)) return operation === "VIEW";
            if (/^(nhap|chon mot|de trong|chon ban ghi|bat dau) /.test(action)) {
                return /^(chon) /.test(action) && ["AUTHENTICATE", "GENERATE", "NAVIGATE"].includes(operation);
            }
            return /luu|xoa|tim kiem|xac nhan|dang nhap|tao|sinh|cap nhat|chon/.test(action);
        });
        if (hasAction) return true;
        return type === "POSITIVE" && operation === "VIEW" && steps.length > 0;
    }

    expectedMatches(testCase) {
        const expected = this.key(testCase.expectedResult);
        if (!expected) return false;
        if (
            [
                "thao tac khong thanh cong",
                "he thong xu ly dung",
                "he thong khong luu du lieu",
                "du lieu khong thay doi"
            ].includes(expected)
        ) {
            return false;
        }
        const field = Object.entries(testCase.testData?.fields ?? {}).find(
            ([, value]) => String(value?.purpose ?? "VALID") !== "VALID"
        )?.[0];
        if (field && ["VALIDATION", "BOUNDARY"].includes(String(testCase.type).toUpperCase())) {
            return expected.includes(this.key(field));
        }
        return true;
    }

    signature(testCase) {
        const fields = Object.entries(testCase.testData?.fields ?? {})
            .filter(([, field]) => String(field?.purpose ?? "VALID") !== "VALID")
            .map(([name, field]) => `${this.key(name)}:${this.key(field?.purpose)}`)
            .sort();
        const classification = this.key(testCase.ruleClassification);
        const behavior =
            classification && classification !== "generic rule"
                ? `${classification}|${fields.join(",")}`
                : this.key(this.sourceText(testCase));
        return [
            this.key(testCase.module),
            this.key(testCase.function ?? testCase.feature),
            behavior,
            this.key(testCase.expectedResult)
        ].join("|");
    }

    context(requirement, knowledge) {
        const source = typeof knowledge?.toJSON === "function" ? knowledge.toJSON() : knowledge;
        const evidence = this.key(JSON.stringify({ requirement, knowledge: source }));
        const functions = this.array(source?.functions);
        const functionPermissions = new Map(
            functions.map(item => [
                this.key(item?.name),
                this.array(item?.permissions).filter(value => typeof value === "string" && value.trim())
            ])
        );
        return {
            evidence,
            module: this.key(source?.module?.name ?? requirement?.module),
            functionPermissions
        };
    }

    operation(testCase) {
        const explicit = String(
            testCase.operation ?? testCase.automation?.operation ?? testCase.automationHints?.operation ?? ""
        ).toUpperCase();
        if (/CREATE|ADD/.test(explicit)) return "CREATE";
        if (/UPDATE|EDIT/.test(explicit)) return "UPDATE";
        if (/DELETE|REMOVE/.test(explicit)) return "DELETE";
        if (/SEARCH|FIND/.test(explicit)) return "SEARCH";
        if (/LOGIN|AUTHENTICATE/.test(explicit)) return "AUTHENTICATE";
        if (/GENERATE/.test(explicit)) return "GENERATE";
        if (/NAVIGATE/.test(explicit)) return "NAVIGATE";
        if (/VIEW|DISPLAY|LOAD/.test(explicit)) return "VIEW";
        const text = this.key(
            `${testCase.function ?? testCase.feature} ${testCase.title} ${testCase.expectedResult}`
        );
        if (/them|tao moi/.test(text)) return "CREATE";
        if (/sua|cap nhat|chinh sua/.test(text)) return "UPDATE";
        if (/xoa/.test(text)) return "DELETE";
        if (/tim kiem|tra cuu|loc/.test(text)) return "SEARCH";
        if (/dang nhap|xac thuc/.test(text)) return "AUTHENTICATE";
        if (/sinh|tao ma/.test(text)) return "GENERATE";
        if (/hien thi|xem|theo doi|danh sach|thong ke/.test(text)) return "VIEW";
        return "OTHER";
    }

    sourceText(testCase) {
        return String(
            testCase.sourceItem?.content ??
                testCase.sourceItem?.text ??
                testCase.requirementReference ??
                testCase.title ??
                ""
        );
    }

    isAmbiguous(value) {
        return /\b(có thể|tùy thiết kế|tuỳ thiết kế|nếu có|theo cấu hình|chưa xác định|nếu hệ thống (?:cho phép|không cho phép|hỗ trợ))\b/i.test(
            String(value ?? "")
        );
    }

    isVagueStep(value) {
        return /^(mở màn hình hoặc chức năng|thực hiện chức năng|thực hiện thao tác|thiết lập điều kiện kiểm thử|không xác nhận thao tác|kiểm tra hệ thống|thực hiện lưu dữ liệu|chuẩn bị điều kiện kiểm thử)$/i.test(
            String(value ?? "").trim()
        );
    }

    sameState(left, right) {
        return (
            this.key(left?.purpose) === this.key(right?.purpose) &&
            JSON.stringify(left?.value ?? null) === JSON.stringify(right?.value ?? null)
        );
    }

    reject(code, testerMessage, hold = false) {
        return { accepted: false, code, testerMessage, hold };
    }

    countByType(values) {
        return values.reduce((result, testCase) => {
            const type = testCase.type || "UNKNOWN";
            result[type] = (result[type] ?? 0) + 1;
            return result;
        }, {});
    }

    emptySummary() {
        return {
            generatedCount: 0,
            finalCount: 0,
            excludedCount: 0,
            correctedCount: 0,
            heldCount: 0,
            excluded: [],
            corrected: [],
            held: [],
            countByType: {}
        };
    }

    array(value) {
        return Array.isArray(value) ? value : [];
    }

    key(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[^a-z0-9\s<>=]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
}
