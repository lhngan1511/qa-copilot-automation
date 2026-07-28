const DEFAULT_OPTIONS = [
    "Có",
    "Không",
    "Chưa xác định"
];

export default class ClarificationQuestion {
    constructor({
        id = "",
        category = "General",
        priority = "Medium",
        question = "",
        reason = "",
        options = []
    } = {}) {
        this.id = ClarificationQuestion.normalizeString(id, "");
        this.category = ClarificationQuestion.normalizeString(category, "General");
        this.priority = ClarificationQuestion.normalizeString(priority, "Medium");
        this.question = ClarificationQuestion.normalizeString(question, "");
        this.reason = ClarificationQuestion.normalizeString(reason, "");
        this.options = ClarificationQuestion.normalizeOptions(options);
    }

    static from(value, fallbackId = "") {
        if (typeof value === "string") {
            const question = value.trim();

            if (!question) {
                return null;
            }

            return new ClarificationQuestion({
                id: fallbackId,
                question,
                options: DEFAULT_OPTIONS
            });
        }

        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            Object.getPrototypeOf(value) !== Object.prototype
        ) {
            return null;
        }

        const id = ClarificationQuestion.normalizeString(value.id, "");
        const normalizedOptions = ClarificationQuestion.normalizeOptions(value.options);

        return new ClarificationQuestion({
            ...value,
            id: id || fallbackId,
            options: normalizedOptions.length >= 2 ? normalizedOptions : DEFAULT_OPTIONS
        });
    }

    static normalizeString(value, defaultValue) {
        return typeof value === "string" ? value.trim() : defaultValue;
    }

    static normalizeOptions(options) {
        if (!Array.isArray(options)) {
            return [];
        }

        const seen = new Set();

        return options.reduce((result, option) => {
            if (typeof option !== "string") {
                return result;
            }

            const normalizedOption = option.trim();

            if (!normalizedOption || seen.has(normalizedOption)) {
                return result;
            }

            seen.add(normalizedOption);
            result.push(normalizedOption);

            return result;
        }, []);
    }

    isValid() {
        return Boolean(this.id && this.question && this.options.length >= 2);
    }

    toJSON() {
        return {
            id: this.id,
            category: this.category,
            priority: this.priority,
            question: this.question,
            reason: this.reason,
            options: [...this.options]
        };
    }
}
