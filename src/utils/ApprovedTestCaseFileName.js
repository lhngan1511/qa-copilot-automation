import slugify from "./Slug.js";

export default class ApprovedTestCaseFileName {
    baseName(testCases, format) {
        const scopeSlug = slugify(this.scope(testCases));
        const prefix = scopeSlug ? `${scopeSlug}-` : "";
        const suffix = format === "markdown" ? "testcases" : "approved-testcases";

        return `${prefix}${suffix}`;
    }

    scope(testCases) {
        const normalizedTestCases = Array.isArray(testCases) ? testCases : [];
        if (normalizedTestCases.length === 0) return "";

        const modules = normalizedTestCases.map(testCase => this.text(testCase?.module));
        if (modules.every(Boolean) && new Set(modules).size === 1) {
            return modules[0];
        }

        if (modules.every(module => !module)) {
            const functions = normalizedTestCases.map(testCase => this.text(testCase?.function));
            if (functions.every(Boolean) && new Set(functions).size === 1) {
                return functions[0];
            }
        }

        return "";
    }

    text(value) {
        return typeof value === "string" ? value.trim() : "";
    }
}
