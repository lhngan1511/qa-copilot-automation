export default class CoreTestCaseCoverageValidator {
    validate(knowledge, testCases = []) {
        const cases = Array.isArray(testCases) ? testCases : [];
        const rules = this.collectRules(knowledge);
        const uncoveredRules = rules.filter(rule => !this.isCovered(rule, cases));
        const boundaryWithoutEvidence = cases
            .filter(testCase => String(testCase?.type ?? "").toUpperCase() === "BOUNDARY")
            .filter(testCase => !this.hasConcreteBoundaryEvidence(testCase))
            .map(testCase => testCase.id ?? "");

        return {
            ruleCount: rules.length,
            coveredRuleCount: rules.length - uncoveredRules.length,
            uncoveredRuleCount: uncoveredRules.length,
            uncoveredRules,
            boundaryWithoutEvidence,
            valid: uncoveredRules.length === 0 && boundaryWithoutEvidence.length === 0
        };
    }

    collectRules(knowledge) {
        const result = [];
        const functions = Array.isArray(knowledge?.functions) ? knowledge.functions : [];

        functions.forEach(functionKnowledge => {
            [
                ["BUSINESS_RULE", functionKnowledge.businessRules],
                ["VALIDATION", functionKnowledge.validationRules],
                ["PERMISSION", functionKnowledge.permissions],
                ["BOUNDARY", functionKnowledge.boundaries]
            ].forEach(([type, values]) => {
                (Array.isArray(values) ? values : []).forEach(value => {
                    if (typeof value !== "string" || !value.trim()) return;
                    if (type === "BOUNDARY" && !this.isConcreteBoundary(value)) return;
                    result.push({
                        moduleId: functionKnowledge.moduleId ?? knowledge?.module?.id ?? "",
                        functionId: functionKnowledge.id ?? "",
                        function: functionKnowledge.name ?? "",
                        type,
                        reference: value.trim()
                    });
                });
            });
        });

        return result;
    }

    isCovered(rule, testCases) {
        const expectedFunction = this.normalize(rule.functionId || rule.function);
        const expectedReference = this.normalize(rule.reference);

        return testCases.some(testCase => {
            const actualFunction = this.normalize(
                testCase?.functionId || testCase?.function || testCase?.feature
            );
            if (!actualFunction || actualFunction !== expectedFunction) return false;

            return this.traceValues(testCase).some(value => {
                const normalized = this.normalize(value);
                return (
                    normalized === expectedReference ||
                    normalized.includes(expectedReference) ||
                    expectedReference.includes(normalized)
                );
            });
        });
    }

    traceValues(testCase) {
        return [
            ...(Array.isArray(testCase?.requirementReferences)
                ? testCase.requirementReferences
                : []),
            ...(Array.isArray(testCase?.coveredRules) ? testCase.coveredRules : []),
            testCase?.requirementReference,
            testCase?.sourceItem?.text,
            testCase?.sourceItem?.content
        ].filter(value => typeof value === "string" && value.trim());
    }

    hasConcreteBoundaryEvidence(testCase) {
        return this.traceValues(testCase).some(value => this.isConcreteBoundary(value));
    }

    isConcreteBoundary(value) {
        const text = String(value ?? "");
        const numeric =
            /\d/.test(text) &&
            /tối đa|tối thiểu|min|max|giới hạn|độ dài|ký tự|số lượng|không quá|ít nhất|nhiều nhất/i.test(
                text
            );
        const relationship =
            /(?:<=|>=|<|>)|(?:ngày bắt đầu|startDate).*(?:ngày kết thúc|endDate)/i.test(text);
        return numeric || relationship;
    }

    normalize(value) {
        return String(value ?? "")
            .normalize("NFC")
            .toLocaleLowerCase("vi")
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
}
