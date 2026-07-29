export default class WorkflowListQueryValidator {
    constructor({ defaultLimit = 20, maxLimit = 100 } = {}) {
        this.defaultLimit = defaultLimit;
        this.maxLimit = maxLimit;
    }

    validate(query = {}) {
        return {
            limit: this.parseInteger(query.limit, {
                name: "limit",
                defaultValue: this.defaultLimit,
                minimum: 1,
                maximum: this.maxLimit
            }),
            offset: this.parseInteger(query.offset, {
                name: "offset",
                defaultValue: 0,
                minimum: 0
            })
        };
    }

    parseInteger(value, { name, defaultValue, minimum, maximum }) {
        if (value === undefined || value === null || value === "") return defaultValue;

        const normalized = typeof value === "string" ? value.trim() : value;
        const number = Number(normalized);
        if (!Number.isInteger(number)) {
            throw this.error(`${name} must be an integer.`);
        }
        if (number < minimum) {
            throw this.error(`${name} must be at least ${minimum}.`);
        }
        if (maximum !== undefined && number > maximum) {
            throw this.error(`${name} must not exceed ${maximum}.`);
        }

        return number;
    }

    error(message) {
        const error = new Error(message);
        error.code = "INVALID_WORKFLOW_QUERY";
        error.statusCode = 400;
        return error;
    }
}
