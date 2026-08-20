import { intentDedupeKey } from "../intelligence/TestCaseIntent.js";

export default class SemanticTestCaseOverlapResolver {
    constructor() {
        this.lastSummary = this.emptySummary();
    }

    resolve(testCases = [], context = {}) {
        if (!Array.isArray(testCases)) {
            this.lastSummary = this.emptySummary();
            return [];
        }

        const candidates = testCases.map((testCase, index) => ({
            testCase: this.clone(testCase),
            index,
            signature: this.buildSignature(testCase, context)
        }));
        const groups = new Map();

        candidates.forEach(candidate => {
            const key = candidate.signature || `__unique__${candidate.index}`;
            const group = groups.get(key) ?? [];
            group.push(candidate);
            groups.set(key, group);
        });

        const resolved = [];
        const mergedGroups = [];
        groups.forEach(group => {
            const representative = this.selectRepresentative(group);
            const merged = this.mergeGroup(representative, group);
            resolved.push({ value: merged, index: representative.index });
            if (group.length > 1) {
                mergedGroups.push({
                    representativeId: merged.id ?? "",
                    mergedTestCaseIds: merged.mergedTestCaseIds,
                    signature: representative.signature
                });
            }
        });

        resolved.sort((left, right) => left.index - right.index);
        const values = resolved.map(item => item.value);
        this.lastSummary = {
            beforeCount: testCases.length,
            afterCount: values.length,
            mergedCount: testCases.length - values.length,
            groupCount: mergedGroups.length,
            groups: mergedGroups,
            coveredRulesBefore: this.uniqueTraceCount(testCases, "coveredRules"),
            coveredRulesAfter: this.uniqueTraceCount(values, "coveredRules"),
            requirementReferencesBefore: this.uniqueTraceCount(testCases, "requirementReferences"),
            requirementReferencesAfter: this.uniqueTraceCount(values, "requirementReferences")
        };
        return values;
    }

    buildSignature(testCase, context = {}) {
        if (!testCase || typeof testCase !== "object" || Array.isArray(testCase)) return "";

        const intentKey = intentDedupeKey(testCase);
        if (intentKey) {
            return this.stableSerialize({ kind: "intent", key: intentKey });
        }

        const classification = this.normalize(testCase.ruleClassification);
        if (!classification || classification === "positive") return "";

        const structured = this.removeVolatileFields(this.clone(testCase.testData ?? {}));
        const sourceText = this.sourceText(testCase);
        const discriminator = this.semanticDiscriminator(
            classification,
            sourceText,
            structured,
            testCase
        );

        if (!this.isSafeToCompare(classification, discriminator, structured, testCase)) return "";

        const operation = this.resolveOperation(testCase, context);
        if (!operation) return "";

        return this.stableSerialize({
            moduleId: this.normalize(testCase.moduleId || testCase.module),
            functionId: this.normalize(testCase.functionId || testCase.feature),
            operation,
            classification: this.classificationFamily(classification),
            discriminator,
            structured,
            expected: this.normalize(testCase.expectedResult),
            needsClarification: testCase.needsClarification === true,
            requiresRuntimeSupport: testCase.requiresRuntimeSupport === true
        });
    }

    classificationFamily(classification) {
        return classification === "permission denied" ? "permission_denied" : classification;
    }

    semanticDiscriminator(classification, sourceText, structured, testCase) {
        if (classification === "permission denied") {
            return /tuân thủ quyền xem dữ liệu|phạm vi dữ liệu|data scope/u.test(sourceText)
                ? "data_scope"
                : "feature_access";
        }
        if (classification === "search multi") {
            return /kết hợp|and|or/u.test(sourceText) ? "combination_logic" : "multiple_fields";
        }
        if (classification === "generic rule") return sourceText;
        if (classification === "boundary concrete") {
            return this.normalize(testCase.sourceItem?.boundaryCase ?? sourceText);
        }
        if (classification === "required") {
            return this.normalize(
                structured?.expectedState?.targetField ??
                    Object.keys(structured?.invalid ?? {})[0] ??
                    ""
            );
        }
        if (classification === "record not found") {
            return structured?.context?.recordExistedAtLoad === true
                ? "concurrent_deletion"
                : "missing_before_action";
        }
        return this.normalize(
            testCase.targetField ?? testCase.inputName ?? testCase.permissionType ?? ""
        );
    }

    isSafeToCompare(classification, discriminator, structured, testCase) {
        if (classification === "generic rule") {
            return Boolean(
                discriminator &&
                Object.keys(structured).length > 0 &&
                this.normalize(testCase.expectedResult)
            );
        }
        if (testCase.needsClarification === true) {
            return ["search multi", "empty search"].includes(classification);
        }
        return Boolean(
            discriminator ||
            Object.keys(structured).length > 0 ||
            this.normalize(testCase.expectedResult)
        );
    }

    removeVolatileFields(value) {
        if (Array.isArray(value)) return value.map(item => this.removeVolatileFields(item));
        if (!value || typeof value !== "object") return value;

        const result = {};
        Object.keys(value)
            .sort()
            .forEach(key => {
                if (!["sourceRule", "inputs", "requirement", "value"].includes(key)) {
                    result[key] = this.removeVolatileFields(value[key]);
                }
            });
        return result;
    }

    resolveOperation(testCase, context) {
        const approvedFunctions = Array.isArray(context?.approvedFunctions)
            ? context.approvedFunctions
            : [];
        const approved = approvedFunctions.find(
            item =>
                this.normalize(item?.id) === this.normalize(testCase.functionId) ||
                this.normalize(item?.name) === this.normalize(testCase.function || testCase.feature)
        );
        return this.normalize(
            approved?.operation ??
                approved?.name ??
                testCase.operation ??
                testCase.functionId ??
                testCase.function ??
                testCase.feature
        );
    }

    selectRepresentative(group) {
        return [...group].sort((left, right) => {
            const difference =
                this.representativeScore(right.testCase) - this.representativeScore(left.testCase);
            return difference || left.index - right.index;
        })[0];
    }

    representativeScore(testCase) {
        let score = 0;
        if (testCase.catalogKey) score += 200;
        if (testCase.executable === true) score += 100;
        if (testCase.needsClarification !== true) score += 40;
        if (testCase.requiresRuntimeSupport !== true) score += 30;
        if (this.hasConcreteTestData(testCase.testData)) score += 20;
        if (this.normalize(testCase.expectedResult)) score += 15;
        if (!this.hasGenericInvalidCondition(testCase.testData)) score += 10;
        if (!this.hasContradictoryPreconditions(testCase.preconditions)) score += 8;
        score += Math.min(this.traceabilityCount(testCase), 7);
        if (this.normalize(testCase.ruleClassification) !== "generic rule") score += 5;
        score += this.sourceSpecificityScore(testCase);
        return score;
    }

    sourceSpecificityScore(testCase) {
        const classification = this.normalize(testCase.ruleClassification);
        const source = this.sourceText(testCase);
        if (
            classification === "permission denied" &&
            /không có quyền|không được phép|unauthorized/u.test(source)
        )
            return 4 + (this.normalize(testCase.sourceItem?.category) === "exception" ? 1 : 0);
        if (
            classification === "record not found" &&
            /không tồn tại|không còn tồn tại/u.test(source)
        )
            return 4;
        if (
            ["confirmation", "confirmation cancelled"].includes(classification) &&
            /hủy|cancel/u.test(source)
        )
            return 4;
        return 0;
    }

    mergeGroup(representative, group) {
        const result = this.clone(representative.testCase);
        const ordered = [...group].sort((left, right) => left.index - right.index);
        result.sourceItems = this.union(
            ordered.flatMap(item => this.collectSourceItems(item.testCase))
        );
        result.coveredRules = this.union(
            ordered.flatMap(item => this.array(item.testCase.coveredRules))
        );
        result.requirementReferences = this.union(
            ordered.flatMap(item => this.collectRequirementReferences(item.testCase))
        );
        result.sourceCategories = this.union(
            ordered.flatMap(item => this.collectSourceCategories(item.testCase))
        );
        result.relatedScenarioIds = this.union(
            ordered.flatMap(item => this.collectScenarioIds(item.testCase, result.scenarioId))
        );
        result.mergedTestCaseIds = this.union([
            ...this.array(result.mergedTestCaseIds),
            ...ordered.map(item => item.testCase.id).filter(id => id && id !== result.id)
        ]);
        return result;
    }

    collectSourceItems(testCase) {
        return [
            ...this.array(testCase.sourceItems),
            ...(testCase.sourceItem == null ? [] : [testCase.sourceItem])
        ];
    }

    collectRequirementReferences(testCase) {
        return this.array(testCase.requirementReferences);
    }

    collectSourceCategories(testCase) {
        return [
            ...this.array(testCase.sourceCategories),
            ...this.collectSourceItems(testCase)
                .map(item => (typeof item === "object" ? (item?.category ?? item?.source) : ""))
                .filter(Boolean)
        ];
    }

    collectScenarioIds(testCase, representativeScenarioId) {
        return [
            ...this.array(testCase.relatedScenarioIds),
            ...(testCase.scenarioId && testCase.scenarioId !== representativeScenarioId
                ? [testCase.scenarioId]
                : [])
        ];
    }

    sourceText(testCase) {
        const sourceItem = testCase.sourceItem;
        return this.normalize(
            sourceItem?.text ??
                sourceItem?.content ??
                sourceItem?.reference ??
                testCase.requirementReference ??
                ""
        );
    }

    hasConcreteTestData(testData) {
        if (!testData || typeof testData !== "object") return false;
        return ["valid", "invalid", "context", "action"].some(key => {
            const value = testData[key];
            return value && typeof value === "object" && Object.keys(value).length > 0;
        });
    }

    hasGenericInvalidCondition(testData) {
        return Boolean(
            testData?.invalid &&
            typeof testData.invalid === "object" &&
            this.normalize(testData.invalid.condition)
        );
    }

    hasContradictoryPreconditions(preconditions) {
        const values = this.array(preconditions).map(value => this.normalize(value));
        return values.some(value => {
            const positive = value
                .replace(/\bkhông\b/u, "")
                .replace(/\s+/g, " ")
                .trim();
            return positive !== value && values.includes(positive);
        });
    }

    traceabilityCount(testCase) {
        return (
            this.collectSourceItems(testCase).length +
            this.array(testCase.coveredRules).length +
            this.collectRequirementReferences(testCase).length
        );
    }

    union(values) {
        const seen = new Set();
        const result = [];
        values.forEach(value => {
            if (value === undefined || value === null || value === "") return;
            const identity = this.stableSerialize(value);
            if (seen.has(identity)) return;
            seen.add(identity);
            result.push(this.clone(value));
        });
        return result;
    }

    uniqueTraceCount(testCases, field) {
        return new Set(
            testCases
                .flatMap(testCase => this.array(testCase?.[field]))
                .map(value => this.stableSerialize(value))
        ).size;
    }

    stableSerialize(value) {
        if (Array.isArray(value))
            return `[${value.map(item => this.stableSerialize(item)).join(",")}]`;
        if (value && typeof value === "object") {
            return `{${Object.keys(value)
                .sort()
                .map(key => `${JSON.stringify(key)}:${this.stableSerialize(value[key])}`)
                .join(",")}}`;
        }
        return JSON.stringify(value);
    }

    normalize(value) {
        return String(value ?? "")
            .normalize("NFC")
            .toLocaleLowerCase("vi")
            .replace(/[^\p{L}\p{N}\s_]/gu, " ")
            .replace(/_/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    array(value) {
        return Array.isArray(value) ? value : [];
    }

    clone(value) {
        if (Array.isArray(value)) return value.map(item => this.clone(item));
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.clone(item)])
            );
        }
        return value;
    }

    emptySummary() {
        return {
            beforeCount: 0,
            afterCount: 0,
            mergedCount: 0,
            groupCount: 0,
            groups: [],
            coveredRulesBefore: 0,
            coveredRulesAfter: 0,
            requirementReferencesBefore: 0,
            requirementReferencesAfter: 0
        };
    }
}
