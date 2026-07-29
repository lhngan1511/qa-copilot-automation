import ScenarioContextBuilder from "../enrichers/ScenarioContextBuilder.js";
import TestDataBuilder from "../enrichers/TestDataBuilder.js";
import StepBuilder from "../enrichers/StepBuilder.js";
import { normalizeTestData } from "../utils/TestDataReadiness.js";

class ScenarioEnrichmentEngine {
    constructor({
        contextBuilder = new ScenarioContextBuilder(),
        testDataBuilder = new TestDataBuilder(),
        stepBuilder = new StepBuilder()
    } = {}) {
        this.contextBuilder = contextBuilder;
        this.testDataBuilder = testDataBuilder;
        this.stepBuilder = stepBuilder;
    }

    enrich({ scenarios, requirement, knowledge } = {}) {
        if (!Array.isArray(scenarios)) {
            return [];
        }

        return scenarios.map(scenario => {
            try {
                return this.enrichOne({ scenario, requirement, knowledge });
            } catch (error) {
                return {
                    ...(this.isPlainObject(scenario) ? this.cloneValue(scenario) : {}),
                    enrichmentError: {
                        message: error instanceof Error ? error.message : String(error)
                    }
                };
            }
        });
    }

    enrichOne({ scenario, requirement, knowledge } = {}) {
        if (!this.isPlainObject(scenario)) {
            throw new TypeError("A scenario object is required for enrichment");
        }

        const sourceScenario = this.cloneValue(scenario);
        const context = this.contextBuilder.build({
            scenario: sourceScenario,
            requirement,
            knowledge
        });
        const planningData =
            typeof this.testDataBuilder.buildPlanningData === "function"
                ? this.testDataBuilder.buildPlanningData(context)
                : this.testDataBuilder.build(context);
        const testData = normalizeTestData(planningData, {
            ...sourceScenario,
            sourceItem: context.sourceItem,
            inputDefinitions: context.inputs,
            testData: planningData
        });
        const steps = this.stepBuilder.build({ context, testData: planningData });
        const expectedResult = this.resolveExpectedResult(sourceScenario, context, steps);
        const expectedResults = this.normalizeExpectedResults(
            sourceScenario,
            context,
            steps,
            expectedResult
        );
        const assertions = this.buildAssertions(sourceScenario, context, testData, expectedResult);
        const automationHints = this.buildAutomationHints(
            sourceScenario,
            requirement,
            context,
            assertions
        );

        return {
            ...sourceScenario,
            inputDefinitions:
                Array.isArray(sourceScenario.inputDefinitions) &&
                sourceScenario.inputDefinitions.length > 0
                    ? this.cloneValue(sourceScenario.inputDefinitions)
                    : this.cloneValue(context.inputs),
            testData: this.cloneValue(testData),
            steps: this.cloneValue(steps),
            expectedResult,
            expectedResults,
            assertions,
            automationHints
        };
    }

    resolveExpectedResult(scenario, context, steps) {
        const scenarioResults = this.toStringArray(scenario?.expectedResults);
        const contextResults = this.toStringArray(context?.existing?.expectedResults);
        const finalStepExpected = this.getFinalStepExpectation(steps);
        const candidates = [
            scenario?.expectedResult,
            scenarioResults[0],
            finalStepExpected,
            context?.existing?.expectedResult,
            contextResults[0],
            context?.sourceItem?.content,
            context?.identity?.title
        ];

        return (
            candidates.find(value => this.isMeaningfulText(value)) ??
            "Hệ thống xử lý tình huống kiểm thử theo yêu cầu nghiệp vụ"
        );
    }

    normalizeExpectedResults(scenario, context, steps, expectedResult) {
        const existing = [
            ...this.toStringArray(scenario?.expectedResults),
            ...this.toStringArray(context?.existing?.expectedResults)
        ].filter(value => this.isMeaningfulText(value));
        const generated = this.collectFinalStepExpectations(steps);

        return this.removeDuplicateStrings([...existing, expectedResult, ...generated]);
    }

    collectFinalStepExpectations(steps) {
        if (!Array.isArray(steps)) {
            return [];
        }

        return steps
            .map(step => (this.isPlainObject(step) ? step.expected : ""))
            .filter(
                expected =>
                    this.isMeaningfulText(expected) && !this.isIntermediateExpectation(expected)
            );
    }

    isIntermediateExpectation(expected) {
        const normalized = this.normalizeText(expected);
        const intermediatePatterns = [
            /field .* receives (the )?(entered )?value/,
            /screen .* (is )?(displayed|opened)/,
            /record .* (is )?selected/,
            /system .* receives .* request/,
            /request .* (is )?sent .* process/,
            /trường .* nhận giá trị .* nhập/,
            /màn hình .* được hiển thị/,
            /bản ghi .* được chọn/,
            /yêu cầu .* được gửi .* xử lý/,
            /dữ liệu kiểm thử .* áp dụng cho trường/,
            /điều kiện trước .* được đáp ứng/,
            /không có điều kiện tìm kiếm nào .* nhập/,
            /người dùng có đúng trạng thái và quyền kiểm thử/,
            /yêu cầu xóa được xác nhận/
        ];

        return intermediatePatterns.some(pattern => pattern.test(normalized));
    }

    buildAssertions(scenario, context, testData, expectedResult) {
        const assertions = this.normalizeAssertions(
            scenario?.assertions ?? context?.existing?.assertions,
            context
        );
        const generated = this.createOutcomeAssertion(context, testData, expectedResult);

        if (generated && !this.hasEquivalentAssertion(assertions, generated)) {
            assertions.push(generated);
        }

        return assertions;
    }

    normalizeAssertions(assertions, context) {
        const source = Array.isArray(assertions)
            ? assertions
            : assertions === undefined || assertions === null
              ? []
              : [assertions];

        return source
            .map(assertion => {
                if (typeof assertion === "string") {
                    if (!this.isMeaningfulText(assertion)) return null;
                    return {
                        type: "TEXT",
                        target: this.getFeatureName(context),
                        expected: assertion.trim()
                    };
                }

                if (!this.isPlainObject(assertion)) {
                    return null;
                }

                const expected =
                    assertion.expected ??
                    assertion.expectedResult ??
                    assertion.content ??
                    assertion.description;
                if (!this.isMeaningfulText(expected)) {
                    return null;
                }

                return {
                    ...this.cloneValue(assertion),
                    type: this.normalizeAssertionType(assertion.type),
                    target: assertion.target ?? "",
                    expected: String(expected).trim()
                };
            })
            .filter(Boolean);
    }

    createOutcomeAssertion(context, testData, expectedResult) {
        const expected = testData?.expected ?? {};
        const validationType = this.normalizeText(
            expected.validationType ?? context?.sourceItem?.validationType
        );
        const operation = this.resolveOperation(context);
        const feature = this.getFeatureName(context);
        const validationField = expected.validationField ?? context?.sourceItem?.inputName ?? "";

        if (expected.permissionAllowed === false) {
            return {
                type: "ACCESS_DENIED",
                target: feature,
                expected: expectedResult
            };
        }

        if (
            expected.scriptExecuted === false ||
            this.isMeaningfulText(expected.securityType) ||
            this.normalizeText(context?.sourceItem?.source) === "security_analysis"
        ) {
            return {
                type: "SCRIPT_NOT_EXECUTED",
                target: context?.sourceItem?.inputName ?? validationField,
                expected: expectedResult
            };
        }

        if (expected.operationAllowed === false) {
            return {
                type: "OPERATION_BLOCKED",
                target: this.resolveSelectedEntity(testData) || feature,
                expected: expectedResult
            };
        }

        if (
            validationType.includes("required") ||
            validationType.includes("duplicate") ||
            validationType.includes("unique") ||
            validationType.includes("invalid")
        ) {
            return {
                type: "VALIDATION",
                target: validationField,
                expected: expectedResult
            };
        }

        if (
            ["LOGIN", "AUTHENTICATE"].includes(operation) &&
            expected.authenticationAllowed !== false
        ) {
            return {
                type: "AUTHENTICATED",
                target: feature,
                expected: expectedResult
            };
        }

        if (
            ["CREATE", "UPDATE", "DELETE", "SEARCH", "VIEW"].includes(operation) &&
            this.normalizeText(context?.identity?.type) !== "negative"
        ) {
            return {
                type: "SUCCESS",
                target: feature,
                expected: expectedResult
            };
        }

        return null;
    }

    normalizeAssertionType(type) {
        const normalized = String(type ?? "TEXT")
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_");
        const supported = new Set([
            "VISIBLE",
            "NOT_VISIBLE",
            "TEXT",
            "URL",
            "VALUE",
            "ENABLED",
            "DISABLED",
            "EXISTS",
            "NOT_EXISTS",
            "AUTHENTICATED",
            "ACCESS_DENIED",
            "SCRIPT_NOT_EXECUTED",
            "OPERATION_BLOCKED",
            "SUCCESS",
            "VALIDATION"
        ]);

        return supported.has(normalized) ? normalized : "TEXT";
    }

    hasEquivalentAssertion(assertions, candidate) {
        const candidateType = this.normalizeAssertionType(candidate.type);
        const candidateTarget = this.normalizeText(candidate.target);
        const candidateExpected = this.normalizeText(candidate.expected);

        return assertions.some(assertion => {
            return (
                this.normalizeAssertionType(assertion.type) === candidateType &&
                this.normalizeText(assertion.target) === candidateTarget &&
                this.normalizeText(assertion.expected) === candidateExpected
            );
        });
    }

    buildAutomationHints(scenario, requirement, context, assertions) {
        const metadata = this.resolveAutomationMetadata(scenario, requirement, context);
        const operation =
            this.resolveOperation(context) || this.normalizeOperation(metadata.operation);
        const screen =
            [
                metadata.screen,
                context?.operation?.screen,
                context?.feature?.name,
                context?.identity?.feature
            ].find(value => this.isMeaningfulText(value)) ?? "";
        const route = metadata.route ?? "";
        const navigation = Array.isArray(metadata.navigation)
            ? this.cloneValue(metadata.navigation)
            : [];
        const controls = this.isPlainObject(metadata.controls)
            ? this.cloneValue(metadata.controls)
            : {};
        const authenticationRequired =
            typeof metadata.authenticationRequired === "boolean"
                ? metadata.authenticationRequired
                : null;
        const normalized = {
            ...this.cloneValue(metadata),
            operation,
            screen,
            route,
            authenticationRequired,
            navigation,
            controls
        };
        const missingMetadata = this.collectMissingMetadata(normalized, context, assertions);

        return {
            ...normalized,
            executable: this.evaluateExecutable(missingMetadata),
            missingMetadata
        };
    }

    resolveAutomationMetadata(scenario, requirement, context) {
        const requirementFields = this.extractAutomationFields(requirement);
        const scenarioFields = this.extractAutomationFields(scenario);
        const requirementAutomation = this.isPlainObject(requirement?.automation)
            ? requirement.automation
            : {};
        const featureAutomation = this.isPlainObject(context?.feature?.automation)
            ? context.feature.automation
            : {};
        const scenarioAutomation = this.isPlainObject(scenario?.automation)
            ? scenario.automation
            : {};
        const existingHints = this.isPlainObject(scenario?.automationHints)
            ? scenario.automationHints
            : {};

        return this.mergeObjects(
            requirementFields,
            requirementAutomation,
            featureAutomation,
            scenarioFields,
            scenarioAutomation,
            existingHints
        );
    }

    extractAutomationFields(source) {
        if (!this.isPlainObject(source)) return {};

        const fields = {};
        [
            "operation",
            "screen",
            "route",
            "authenticationRequired",
            "navigation",
            "controls"
        ].forEach(key => {
            if (source[key] !== undefined) {
                fields[key] = this.cloneValue(source[key]);
            }
        });

        return fields;
    }

    collectMissingMetadata(metadata, context, assertions) {
        const missing = [];
        const operation = this.normalizeOperation(metadata.operation);
        const hasNavigation =
            this.isMeaningfulText(metadata.route) ||
            (Array.isArray(metadata.navigation) && metadata.navigation.length > 0);
        const controls = metadata.controls;

        if (!hasNavigation) {
            missing.push("routeOrNavigation");
        }

        if (["LOGIN", "AUTHENTICATE"].includes(operation)) {
            if (!this.hasControl(controls, ["username", "account", "email"])) {
                missing.push("controls.username");
            }
            if (!this.hasControl(controls, ["password"])) {
                missing.push("controls.password");
            }
            if (!this.hasControl(controls, ["submit", "login", "authenticate"])) {
                missing.push("controls.submit");
            }
        } else if (["CREATE", "UPDATE", "DELETE", "SEARCH", "VIEW"].includes(operation)) {
            const operationControls = {
                CREATE: ["save", "create", "add", "submit"],
                UPDATE: ["update", "edit", "save", "submit"],
                DELETE: ["delete", "remove", "submit"],
                SEARCH: ["search", "find", "submit"],
                VIEW: ["view", "open", "details"]
            };

            if (!this.hasControl(controls, operationControls[operation])) {
                missing.push(`controls.${this.getOperationControlName(operation)}`);
            }

            if (["CREATE", "UPDATE", "SEARCH"].includes(operation)) {
                const missingInputs = this.getMissingRequiredInputControls(controls, context);
                missing.push(...missingInputs);
            }
        } else {
            missing.push("controls.operation");
        }

        if (!this.hasObservableAssertionControl(controls, assertions)) {
            missing.push("assertionLocator");
        }

        return [...new Set(missing)];
    }

    evaluateExecutable(missingMetadata) {
        return Array.isArray(missingMetadata) && missingMetadata.length === 0;
    }

    hasControl(controls, aliases) {
        if (!this.isPlainObject(controls)) return false;

        return Object.entries(controls).some(([name, definition]) => {
            const normalizedName = this.normalizeText(name).replace(/[^a-z0-9]/g, "");
            const matchesName = aliases.some(alias =>
                normalizedName.includes(this.normalizeText(alias).replace(/[^a-z0-9]/g, ""))
            );

            return matchesName && this.hasExplicitLocator(definition);
        });
    }

    hasExplicitLocator(definition) {
        if (this.isMeaningfulText(definition)) {
            return true;
        }
        if (!this.isPlainObject(definition)) {
            return false;
        }

        return ["locator", "selector", "testId", "id", "name"].some(key =>
            this.isMeaningfulText(definition[key])
        );
    }

    getMissingRequiredInputControls(controls, context) {
        const requiredInputs = Array.isArray(context?.inputs)
            ? context.inputs.filter(input => input?.required)
            : [];

        return requiredInputs
            .filter(input => {
                const inputName =
                    input?.name ?? input?.inputName ?? input?.fieldName ?? input?.label;
                return !this.hasNamedInputControl(controls, inputName);
            })
            .map(input => {
                const inputName =
                    input?.name ?? input?.inputName ?? input?.fieldName ?? input?.label;
                return `controls.${inputName}`;
            });
    }

    hasNamedInputControl(controls, inputName) {
        const normalizedInput = this.normalizeText(inputName).replace(
            /[^a-z0-9\u00c0-\u024f]/g,
            ""
        );
        if (!normalizedInput || !this.isPlainObject(controls)) return false;

        return Object.entries(controls).some(([name, definition]) => {
            const normalizedName = this.normalizeText(name).replace(/[^a-z0-9\u00c0-\u024f]/g, "");
            return (
                (normalizedName.includes(normalizedInput) ||
                    normalizedInput.includes(normalizedName)) &&
                this.hasExplicitLocator(definition)
            );
        });
    }

    hasObservableAssertionControl(controls, assertions) {
        const aliases = ["result", "success", "validation", "error", "message", "alert", "outcome"];
        if (this.hasControl(controls, aliases)) {
            return true;
        }

        return assertions.some(assertion => {
            return ["URL"].includes(assertion.type) && this.isMeaningfulText(assertion.target);
        });
    }

    getOperationControlName(operation) {
        const names = {
            CREATE: "saveButton",
            UPDATE: "updateButton",
            DELETE: "deleteButton",
            SEARCH: "searchButton",
            VIEW: "viewControl"
        };

        return names[operation] ?? "operation";
    }

    resolveSelectedEntity(testData) {
        const inputs = this.isPlainObject(testData?.inputs) ? testData.inputs : {};
        const entry = Object.entries(inputs).find(([name]) => {
            return /(record|entity|bản ghi|cần xóa|cần xoá)/i.test(name);
        });

        return entry?.[0] ?? "";
    }

    getFinalStepExpectation(steps) {
        if (!Array.isArray(steps)) return "";

        for (let index = steps.length - 1; index >= 0; index -= 1) {
            const expected = this.isPlainObject(steps[index]) ? steps[index].expected : "";
            if (this.isMeaningfulText(expected)) {
                return String(expected).trim();
            }
        }

        return "";
    }

    getFeatureName(context) {
        return (
            [context?.feature?.name, context?.identity?.feature, context?.operation?.screen].find(
                value => this.isMeaningfulText(value)
            ) ?? ""
        );
    }

    normalizeOperation(value) {
        return String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_");
    }

    resolveOperation(context) {
        return this.normalizeOperation(
            this.isMeaningfulText(context?.operation?.type)
                ? context.operation.type
                : context?.operation?.name
        );
    }

    toStringArray(value) {
        const source = Array.isArray(value)
            ? value
            : value === undefined || value === null
              ? []
              : [value];

        return source
            .map(item => {
                if (typeof item === "string") return item.trim();
                if (!this.isPlainObject(item)) return "";
                return this.normalizeText(
                    item.expected ?? item.content ?? item.expectedResult ?? item.description
                );
            })
            .filter(value => this.isMeaningfulText(value));
    }

    removeDuplicateStrings(values) {
        const seen = new Set();

        return values.filter(value => {
            if (!this.isMeaningfulText(value)) return false;
            const normalized = this.normalizeText(value);
            if (seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        });
    }

    mergeObjects(...objects) {
        return objects.reduce((merged, source) => {
            if (!this.isPlainObject(source)) return merged;

            Object.entries(source).forEach(([key, value]) => {
                if (this.isPlainObject(value) && this.isPlainObject(merged[key])) {
                    merged[key] = this.mergeObjects(merged[key], value);
                } else if (value !== undefined) {
                    merged[key] = this.cloneValue(value);
                }
            });

            return merged;
        }, {});
    }

    cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item));
        }
        if (this.isPlainObject(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.cloneValue(item)])
            );
        }
        return value;
    }

    isPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return false;
        }

        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    normalizeText(value) {
        return String(value ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    isMeaningfulText(value) {
        if (typeof value !== "string" || value.trim() === "") {
            return false;
        }

        const normalized = this.normalizeText(value);
        const generic = new Set([
            "kiểm tra kết quả thực tế",
            "verify actual result",
            "expected result",
            "kết quả mong đợi"
        ]);

        return !generic.has(normalized);
    }
}

export default ScenarioEnrichmentEngine;
