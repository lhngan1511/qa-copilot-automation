import testerFacingText from "../utils/TesterFacingText.js";

export const ClarificationQuestionType = Object.freeze({
    YES_NO: "YES_NO",
    SINGLE_CHOICE: "SINGLE_CHOICE",
    FREE_TEXT: "FREE_TEXT",
    CONFIRM_ASSUMPTION: "CONFIRM_ASSUMPTION"
});

const NOT_SPECIFIED = "Requirement không đề cập";
const LEGACY_NOT_SPECIFIED = new Set([
    "chua xac dinh",
    "khong xac dinh",
    "requirement khong de cap",
    "requirement khong noi"
]);

export default class ClarificationQuestion {
    constructor({
        id = "",
        category = "General",
        priority = "Medium",
        question = "",
        type = ClarificationQuestionType.FREE_TEXT,
        reason = "",
        targetField = "",
        targetRule = "",
        options = [],
        allowNotSpecified = false,
        requirementReferences = []
    } = {}) {
        this.id = ClarificationQuestion.normalizeString(id, "");
        this.category = ClarificationQuestion.normalizeString(category, "General");
        this.priority = ClarificationQuestion.normalizeString(priority, "Medium");
        this.question = testerFacingText(question);
        this.type = ClarificationQuestion.normalizeType(type);
        this.reason = testerFacingText(reason);
        this.targetField = ClarificationQuestion.normalizeString(targetField, "");
        this.targetRule = ClarificationQuestion.normalizeString(targetRule, "");
        this.allowNotSpecified = allowNotSpecified === true;
        this.options = ClarificationQuestion.optionsForType(
            this.type,
            options,
            this.allowNotSpecified
        );
        this.requirementReferences = ClarificationQuestion.normalizeOptions(requirementReferences);
    }

    static from(value, fallbackId = "") {
        if (typeof value === "string") {
            const question = value.trim();
            if (!question) return null;
            const type = this.inferType({ question });
            return new ClarificationQuestion({
                id: fallbackId,
                question,
                type,
                allowNotSpecified: true
            });
        }

        if (!this.isPlainObject(value)) return null;

        const question = this.normalizeString(
            value.question ?? value.content ?? value.text ?? value.title,
            ""
        );
        if (!question) return null;

        const normalizedOptions = this.normalizeOptions(value.options);
        const explicitType = this.normalizeType(value.type ?? value.questionType, "");
        let type = explicitType || this.inferType({ question, options: normalizedOptions });
        if (
            type === ClarificationQuestionType.SINGLE_CHOICE &&
            this.realOptions(normalizedOptions).length < 2
        ) {
            type = ClarificationQuestionType.FREE_TEXT;
        }

        const legacyAllowsNotSpecified = normalizedOptions.some(option =>
            LEGACY_NOT_SPECIFIED.has(this.comparable(option))
        );
        const allowNotSpecified =
            typeof value.allowNotSpecified === "boolean"
                ? value.allowNotSpecified
                : legacyAllowsNotSpecified || !explicitType;

        return new ClarificationQuestion({
            ...value,
            id: this.normalizeString(value.id ?? value.questionId, "") || fallbackId,
            question,
            type,
            targetField: value.targetField ?? value.field ?? "",
            targetRule: value.targetRule ?? value.rule ?? "",
            options: normalizedOptions,
            allowNotSpecified,
            requirementReferences: value.requirementReferences
        });
    }

    static normalizeType(value, fallback = ClarificationQuestionType.FREE_TEXT) {
        const normalized = String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_");
        const aliases = {
            BOOLEAN: ClarificationQuestionType.YES_NO,
            CHOICE: ClarificationQuestionType.SINGLE_CHOICE,
            SELECT: ClarificationQuestionType.SINGLE_CHOICE,
            TEXT: ClarificationQuestionType.FREE_TEXT,
            ASSUMPTION: ClarificationQuestionType.CONFIRM_ASSUMPTION
        };
        const resolved = aliases[normalized] ?? normalized;
        return Object.values(ClarificationQuestionType).includes(resolved) ? resolved : fallback;
    }

    static inferType({ question = "", options = [] } = {}) {
        const realOptions = this.realOptions(options);
        if (realOptions.length >= 2) {
            const optionKeys = new Set(realOptions.map(this.comparable));
            if (optionKeys.has("co") && optionKeys.has("khong")) {
                return ClarificationQuestionType.YES_NO;
            }
            return ClarificationQuestionType.SINGLE_CHOICE;
        }

        const normalized = this.comparable(question);
        if (/^(co|he thong co|nguoi dung co|co cho phep)\b/.test(normalized)) {
            return ClarificationQuestionType.YES_NO;
        }
        if (/\b(dung khong|co phai)\b/.test(normalized)) {
            return ClarificationQuestionType.CONFIRM_ASSUMPTION;
        }
        return ClarificationQuestionType.FREE_TEXT;
    }

    static optionsForType(type, options, allowNotSpecified) {
        let result = [];
        if (type === ClarificationQuestionType.YES_NO) result = ["Có", "Không"];
        if (type === ClarificationQuestionType.CONFIRM_ASSUMPTION) {
            result = ["Đúng", "Không đúng"];
        }
        if (type === ClarificationQuestionType.SINGLE_CHOICE) {
            result = this.realOptions(options);
        }
        if (
            allowNotSpecified &&
            type !== ClarificationQuestionType.FREE_TEXT &&
            !result.includes(NOT_SPECIFIED)
        ) {
            result.push(NOT_SPECIFIED);
        }
        return result;
    }

    static realOptions(options) {
        return this.normalizeOptions(options).filter(
            option => !LEGACY_NOT_SPECIFIED.has(this.comparable(option))
        );
    }

    static normalizeString(value, defaultValue) {
        return typeof value === "string" ? value.trim() : defaultValue;
    }

    static normalizeOptions(options) {
        if (!Array.isArray(options)) return [];
        const seen = new Set();
        return options.reduce((result, option) => {
            if (typeof option !== "string") return result;
            const normalizedOption = option.trim();
            const key = this.comparable(normalizedOption);
            if (!normalizedOption || seen.has(key)) return result;
            seen.add(key);
            result.push(normalizedOption);
            return result;
        }, []);
    }

    static deduplicationKey(value) {
        const question = value instanceof ClarificationQuestion ? value : this.from(value);
        if (!question) return "";
        const target = question.targetField
            ? `field:${this.comparable(question.targetField)}`
            : question.targetRule
              ? `rule:${this.comparable(question.targetRule)}`
              : "";
        const fact = this.missingFact(question.question);
        return target ? `${target}|${fact}` : this.comparable(question.question);
    }

    static missingFact(question) {
        const normalized = this.comparable(question);
        const facts = [
            ["length", /do dai|toi da|toi thieu|max|min|bao nhieu ky tu/],
            ["required", /bat buoc|de trong|bo trong/],
            ["unique", /duy nhat|trung|phan biet hoa thuong/],
            ["delete", /xoa|khoi phuc|su dung/],
            ["permission", /quyen|vai tro|ai duoc phep/],
            ["default", /mac dinh/],
            ["format", /dinh dang|format|pattern/],
            ["choice", /gia tri nao|lua chon|trang thai nao/]
        ];
        return facts.find(([, pattern]) => pattern.test(normalized))?.[0] ?? normalized;
    }

    static comparable(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    static isPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    isValid() {
        if (!this.id || !this.question) return false;
        if (this.type === ClarificationQuestionType.SINGLE_CHOICE) {
            return this.options.filter(option => option !== NOT_SPECIFIED).length >= 2;
        }
        return true;
    }

    toJSON() {
        const result = {
            id: this.id,
            category: this.category,
            priority: this.priority,
            question: this.question,
            type: this.type,
            reason: this.reason,
            allowNotSpecified: this.allowNotSpecified
        };
        if (this.targetField) result.targetField = this.targetField;
        if (this.targetRule) result.targetRule = this.targetRule;
        if (this.options.length > 0) result.options = [...this.options];
        if (this.requirementReferences.length > 0) {
            result.requirementReferences = [...this.requirementReferences];
        }
        return result;
    }
}
