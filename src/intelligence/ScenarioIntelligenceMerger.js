export default class ScenarioIntelligenceMerger {
    constructor(qualityPolicy) {
        this.qualityPolicy = qualityPolicy;
    }

    merge(ruleScenarios, aiScenarios, options = {}) {
        const merged = (Array.isArray(ruleScenarios) ? ruleScenarios : []).map(item => ({
            ...item,
            source: item.source || "rule"
        }));

        (Array.isArray(aiScenarios) ? aiScenarios : []).forEach(ai => {
            const match = merged.find(
                rule =>
                    rule.moduleId === ai.moduleId &&
                    rule.functionId === ai.functionId &&
                    this.normalize(rule.title) === this.normalize(ai.title) &&
                    this.normalizeType(rule.type) === this.normalizeType(ai.type)
            );
            if (match) {
                match.description ||= ai.description || "";
                match.riskReason ||= ai.riskReason || "";
                match.expectedResults = this.mergeArray(match.expectedResults, ai.expectedResults);
                match.requirementReferences = this.mergeArray(
                    match.requirementReferences,
                    ai.requirementReferences
                );
                match.coveredRules = this.mergeArray(match.coveredRules, ai.coveredRules);
                match.source = `rule+${ai.source || "ai"}`;
            } else {
                merged.push({ ...ai, id: "" });
            }
        });

        return this.qualityPolicy.apply(merged, options);
    }

    mergeArray(a, b) {
        return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];
    }
    normalize(value) {
        return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
    }
    normalizeType(value) {
        return String(value || "").replace(/-/g, "_").toUpperCase();
    }
}
