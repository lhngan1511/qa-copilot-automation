export default class ScenarioQualityPolicy {
    constructor({
        caps = {
            POSITIVE: 2,
            NEGATIVE: 5,
            BOUNDARY: 3,
            PERMISSION: 2,
            EXCEPTION: 3,
            SECURITY: 3,
            DATA_INTEGRITY: 3,
            RISK: 3
        }
    } = {}) {
        this.caps = { ...caps };
    }

    apply(scenarios, { functions = [], maxScenariosPerFunction = 0 } = {}) {
        const owners = new Map(functions.map(item => [item.id, item]));
        const accepted = [];
        const keys = new Set();
        const categoryCounts = new Map();
        const functionCounts = new Map();
        let duplicateRemovedCount = 0;
        let rejectedCount = 0;

        (Array.isArray(scenarios) ? scenarios : []).forEach(scenario => {
            const objective = this.normalize(scenario?.title);
            const type = this.normalizeType(scenario?.type);
            const owner = owners.get(scenario?.functionId);
            const references = [
                ...(Array.isArray(scenario?.requirementReferences)
                    ? scenario.requirementReferences
                    : []),
                ...(Array.isArray(scenario?.coveredRules) ? scenario.coveredRules : [])
            ];
            const expected = Array.isArray(scenario?.expectedResults)
                ? scenario.expectedResults.filter(Boolean)
                : [];

            if (!owner || !objective || references.length === 0 || expected.length === 0) {
                rejectedCount += 1;
                return;
            }

            if (
                type === "BOUNDARY" &&
                !/[0-9]|tối đa|tối thiểu|giới hạn|độ dài|lớn|nhỏ|vượt|phân trang/i.test(
                    `${scenario.title} ${expected.join(" ")}`
                )
            ) {
                rejectedCount += 1;
                return;
            }

            if (type === "RISK" && !scenario.riskReason && !scenario.description) {
                rejectedCount += 1;
                return;
            }

            const key = `${scenario.moduleId}|${scenario.functionId}|${type}|${objective}`;
            const nearKey = `${scenario.moduleId}|${scenario.functionId}|${type}|${this.tokens(objective)}`;
            if (keys.has(key) || keys.has(nearKey)) {
                duplicateRemovedCount += 1;
                return;
            }

            const categoryKey = `${scenario.functionId}|${type}`;
            const currentCategory = categoryCounts.get(categoryKey) ?? 0;
            const currentFunction = functionCounts.get(scenario.functionId) ?? 0;
            const critical = String(scenario.priority).toLowerCase() === "critical";
            if (
                !critical &&
                ((this.caps[type] ?? 3) <= currentCategory ||
                    (maxScenariosPerFunction > 0 && currentFunction >= maxScenariosPerFunction))
            ) {
                rejectedCount += 1;
                return;
            }

            keys.add(key);
            keys.add(nearKey);
            categoryCounts.set(categoryKey, currentCategory + 1);
            functionCounts.set(scenario.functionId, currentFunction + 1);
            accepted.push({ ...scenario });
        });

        accepted.forEach((item, index) => {
            item.id = item.id || `SC${String(index + 1).padStart(3, "0")}`;
        });

        return {
            scenarios: accepted,
            summary: {
                generatedCount: Array.isArray(scenarios) ? scenarios.length : 0,
                duplicateRemovedCount,
                rejectedCount,
                finalCount: accepted.length,
                countByFunction: Object.fromEntries(functionCounts),
                countByType: this.countBy(accepted, "type"),
                sources: [...new Set(accepted.map(item => item.source).filter(Boolean))]
            }
        };
    }

    countBy(values, field) {
        return values.reduce((result, item) => {
            const key = item[field] || "UNKNOWN";
            result[key] = (result[key] ?? 0) + 1;
            return result;
        }, {});
    }

    normalizeType(value) {
        return String(value || "UNKNOWN").trim().replace(/-/g, "_").toUpperCase();
    }

    normalize(value) {
        return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    }

    tokens(value) {
        return [...new Set(value.split(" ").filter(token => token.length > 2))].sort().join(" ");
    }
}
