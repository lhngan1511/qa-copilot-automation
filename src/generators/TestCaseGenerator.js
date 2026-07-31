import TestCase from "../models/TestCase.js";
import RuleTestDataBuilder from "../builders/RuleTestDataBuilder.js";
import TestDesignContentNormalizer from "../normalizers/TestDesignContentNormalizer.js";
import TestStepNormalizer from "../normalizers/TestStepNormalizer.js";
import { normalizeTestData, resolveExecutionReadiness } from "../utils/TestDataReadiness.js";

class TestCaseGenerator {
    constructor({
        ruleTestDataBuilder = new RuleTestDataBuilder(),
        contentNormalizer = new TestDesignContentNormalizer(),
        stepNormalizer = new TestStepNormalizer()
    } = {}) {
        this.counter = 1;
        this.ruleTestDataBuilder = ruleTestDataBuilder;
        this.contentNormalizer = contentNormalizer;
        this.stepNormalizer = stepNormalizer;
    }

    generate(scenarios = []) {
        if (!Array.isArray(scenarios)) {
            return [];
        }

        this.counter = 1;

        return scenarios.flatMap(scenario =>
            this.expandScenario(scenario).map(atomicScenario => {
                const scenario = atomicScenario;
                const testCase = new TestCase();

                const generatedId = `TC${String(this.counter++).padStart(3, "0")}`;

                testCase.id =
                    scenario.testCaseId === undefined ||
                    scenario.testCaseId === null ||
                    scenario.testCaseId === ""
                        ? generatedId
                        : scenario.testCaseId;

                testCase.scenarioId = scenario.id ?? "";

                testCase.moduleId = scenario.moduleId ?? "";

                testCase.functionId = scenario.functionId ?? "";

                testCase.function = scenario.function ?? scenario.feature ?? "";

                testCase.module = scenario.module || scenario.moduleName || "Chưa xác định";

                testCase.feature =
                    scenario.feature || scenario.function || scenario.title || "Chưa xác định";

                testCase.title = scenario.title ?? scenario.testScenario ?? "";

                testCase.testScenario =
                    scenario.testScenario || scenario.scenario || testCase.title;

                testCase.scenario = scenario.scenario || testCase.testScenario;

                testCase.type = scenario.type ?? "";

                testCase.testObjective = scenario.testObjective ?? this.buildObjective(scenario);

                testCase.objective = scenario.objective ?? testCase.testObjective;

                testCase.requirementReference = scenario.requirementReference ?? "";

                testCase.requirementReferences = Array.isArray(scenario.requirementReferences)
                    ? this.cloneValue(scenario.requirementReferences)
                    : testCase.requirementReference
                      ? [testCase.requirementReference]
                      : [];

                testCase.coveredRules = Array.isArray(scenario.coveredRules)
                    ? this.cloneValue(scenario.coveredRules)
                    : [];

                testCase.businessRuleIds = [
                    ...new Set([
                        ...(Array.isArray(scenario.businessRuleIds)
                            ? scenario.businessRuleIds
                            : []),
                        ...this.contentNormalizer.extractBusinessRuleIds(
                            scenario.title,
                            scenario.requirementReference,
                            scenario.requirementReferences,
                            scenario.coveredRules,
                            scenario.sourceItem,
                            scenario.sourceItems
                        )
                    ])
                ];

                testCase.sourceItem =
                    scenario.sourceItem === undefined ? null : this.cloneValue(scenario.sourceItem);

                testCase.ruleClassification = scenario.ruleClassification ?? "";

                testCase.needsClarification = scenario.needsClarification ?? false;

                testCase.requiresRuntimeSupport = scenario.requiresRuntimeSupport ?? false;

                testCase.needsEnrichment = scenario.needsEnrichment ?? false;

                testCase.executable = scenario.executable ?? false;

                testCase.postconditions = Array.isArray(scenario.postconditions)
                    ? this.cloneValue(scenario.postconditions)
                    : [];

                testCase.automationNotes = scenario.automationNotes ?? "";

                testCase.automationCandidate = scenario.automationCandidate ?? false;

                testCase.preconditions = Array.isArray(scenario.preconditions)
                    ? this.cloneValue(scenario.preconditions)
                    : [];

                testCase.testData =
                    scenario.testData === undefined ? testCase.testData : scenario.testData;

                testCase.testData = normalizeTestData(testCase.testData, scenario);

                testCase.executionReadiness = resolveExecutionReadiness(testCase.testData);

                testCase.steps =
                    scenario.steps === undefined
                        ? []
                        : this.buildSteps(
                              scenario.steps,
                              testCase.function,
                              testCase.testData.value
                          );

                testCase.expectedResult =
                    typeof scenario.expectedResult === "string" && scenario.expectedResult.trim()
                        ? scenario.expectedResult
                        : Array.isArray(scenario.expectedResults)
                          ? (scenario.expectedResults.find(
                                result => typeof result === "string" && result.trim()
                            ) ?? "")
                          : "";

                testCase.expectedResults =
                    scenario.expectedResults !== undefined
                        ? scenario.expectedResults
                        : scenario.expectedResult !== undefined && scenario.expectedResult !== null
                          ? [scenario.expectedResult]
                          : [];

                if (!this.hasMeaningfulSteps(testCase.steps)) {
                    testCase.steps = this.buildFallbackSteps(testCase);
                }

                testCase.reviewStatus = "PENDING";

                testCase.assertions = scenario.assertions === undefined ? [] : scenario.assertions;

                if (
                    scenario.automationHints &&
                    typeof scenario.automationHints === "object" &&
                    !Array.isArray(scenario.automationHints)
                ) {
                    testCase.automationHints = this.cloneValue(scenario.automationHints);
                } else if (testCase.automationHints === undefined) {
                    testCase.automationHints = {};
                }

                testCase.actualResult = "";

                testCase.status = "Not Tested";

                testCase.priority = scenario.priority ?? "MEDIUM";

                testCase.severity = scenario.severity ?? "MEDIUM";

                testCase.automation = {
                    candidate: scenario.automationCandidate ?? false,

                    framework: "Playwright",

                    pageObject: "",

                    locatorStrategy: "",

                    locator: "",

                    tags: [scenario.type]
                };

                testCase.intelligence = scenario.intelligence ?? null;

                testCase.traceability = {
                    requirementId: scenario.requirementReference ?? "",

                    scenarioId: scenario.id ?? ""
                };

                testCase.source = scenario.source ?? "Requirement Intelligence Engine";

                testCase.reason = scenario.reason ?? "";

                testCase.riskCategory = scenario.riskCategory ?? "";

                testCase.steps = this.stepNormalizer.normalize(testCase.steps, {
                    ...testCase,
                    operation: scenario.operation ?? scenario.automation?.operation,
                    inputDefinitions: scenario.inputDefinitions,
                    testData: scenario.testData,
                    sourceItem: scenario.sourceItem,
                    preconditions: testCase.preconditions
                });

                return testCase;
            })
        );
    }

    expandScenario(scenario) {
        const sourceItems = Array.isArray(scenario?.sourceItems)
            ? scenario.sourceItems
                  .map(item => this.normalizeSourceItem(item))
                  .filter(item => item.content)
            : [];

        if (sourceItems.length === 0 || scenario?.type === "POSITIVE") {
            return [this.cloneValue(scenario)];
        }

        const atomicItems =
            scenario?.type === "BOUNDARY"
                ? sourceItems.flatMap(item => this.expandBoundaryItem(item))
                : sourceItems;

        return atomicItems.map(item => this.buildAtomicScenario(scenario, item));
    }

    normalizeSourceItem(item) {
        if (typeof item === "string") {
            return { content: item.trim(), source: "" };
        }

        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return { content: "", source: "" };
        }

        return {
            ...this.cloneValue(item),
            content: String(
                item.content ?? item.rule ?? item.title ?? item.description ?? ""
            ).trim(),
            source: String(item.source ?? "").trim()
        };
    }

    buildAtomicScenario(scenario, item) {
        const atomic = this.cloneValue(scenario);
        const rule = item.content;
        const specialized = this.ruleTestDataBuilder.build({
            scenario,
            sourceItem: item,
            existingTestData: scenario.testData
        });
        const fieldName = specialized.fieldName;
        const required = specialized.classification === "REQUIRED";

        atomic.title = this.buildAtomicTitle(scenario, rule, fieldName, required);
        atomic.testScenario = atomic.title;
        atomic.objective = this.buildAtomicObjective(rule, fieldName, required);
        atomic.testObjective = atomic.objective;
        atomic.coveredRules = [rule];
        atomic.businessRuleIds = [
            ...new Set([
                ...(Array.isArray(scenario.businessRuleIds) ? scenario.businessRuleIds : []),
                ...this.contentNormalizer.extractBusinessRuleIds(item, rule)
            ])
        ];
        atomic.requirementReferences = this.atomicReferences(scenario, item, rule);
        atomic.requirementReference = atomic.requirementReferences[0] ?? "";
        atomic.sourceItem = {
            ...this.cloneValue(item),
            category: item.source || specialized.classification,
            code: item.code ?? item.requirementReference ?? item.id ?? "",
            reference: atomic.requirementReferences[0] ?? "",
            text: rule,
            classification: specialized.classification
        };
        atomic.ruleClassification = specialized.classification;
        atomic.needsClarification = specialized.needsClarification;
        atomic.requiresRuntimeSupport = specialized.requiresRuntimeSupport;
        atomic.needsEnrichment = specialized.needsEnrichment;
        atomic.executable = specialized.executable;
        atomic.expectedResult = specialized.expectedResult;
        atomic.expectedResults = [atomic.expectedResult];
        atomic.testData = specialized.testData;
        atomic.preconditions = specialized.preconditions;
        atomic.steps = this.buildAtomicSteps(scenario, specialized, atomic.expectedResult);
        atomic.assertions = [
            {
                type: required ? "FIELD_VALIDATION" : specialized.classification,
                target: fieldName || scenario.feature || scenario.function || "",
                expected: atomic.expectedResult
            }
        ];

        return atomic;
    }

    expandBoundaryItem(item) {
        const rule = item.content;
        const numbers = [...rule.matchAll(/\d+(?:[.,]\d+)?/g)].map(match =>
            Number(match[0].replace(",", "."))
        );
        const normalized = rule.toLocaleLowerCase("vi");

        if (
            /(?:ngày bắt đầu|startdate).*(?:<=|nhỏ hơn hoặc bằng|không sau).*(?:ngày kết thúc|enddate)/i.test(
                rule
            )
        ) {
            return [
                { ...item, boundaryCase: "LESS_THAN", boundaryValue: "startDate < endDate" },
                { ...item, boundaryCase: "EQUAL", boundaryValue: "startDate = endDate" },
                { ...item, boundaryCase: "GREATER_THAN", boundaryValue: "startDate > endDate" }
            ];
        }

        if (numbers.length === 0) return [item];

        const variants = [];
        const hasMin = /tối thiểu|min|ít nhất/.test(normalized);
        const hasMax = /tối đa|max|không quá|nhiều nhất/.test(normalized);
        const min = numbers[0];
        const max = numbers.length > 1 ? numbers[numbers.length - 1] : numbers[0];

        if (hasMin || numbers.length > 1) {
            variants.push(
                { ...item, boundaryCase: "MIN_MINUS_ONE", boundaryValue: min - 1 },
                { ...item, boundaryCase: "MIN", boundaryValue: min }
            );
        }
        if (hasMax || numbers.length > 1) {
            variants.push(
                { ...item, boundaryCase: "MAX", boundaryValue: max },
                { ...item, boundaryCase: "MAX_PLUS_ONE", boundaryValue: max + 1 }
            );
        }

        return variants.length > 0 ? variants : [item];
    }

    atomicReferences(scenario, item, rule) {
        const explicit = [item.requirementReference, item.code, item.id].filter(
            value => typeof value === "string" && value.trim()
        );

        return explicit.length > 0 ? [...new Set(explicit)] : [rule];
    }

    buildAtomicTitle(scenario, rule, fieldName, required) {
        return this.contentNormalizer.normalizeTitle({
            ...scenario,
            title: rule,
            rule,
            ruleClassification: required
                ? "REQUIRED"
                : (scenario.ruleClassification ?? scenario.sourceItem?.classification),
            sourceItem: {
                ...(scenario.sourceItem ?? {}),
                content: rule,
                inputName: fieldName || scenario.sourceItem?.inputName,
                classification: required ? "REQUIRED" : scenario.sourceItem?.classification
            }
        });
    }

    buildAtomicObjective(rule, fieldName, required) {
        if (required && fieldName) {
            return `Xác minh trường ${fieldName} là bắt buộc`;
        }
        return `Xác minh quy tắc: ${rule}`;
    }

    buildAtomicSteps(scenario, specialized, expectedResult) {
        const feature = scenario.feature || scenario.function || "chức năng";
        const steps = [
            {
                order: 1,
                action: "Mở màn hình hoặc chức năng",
                target: feature,
                value: "",
                expected: `${feature} được hiển thị`
            }
        ];

        if (specialized.classification === "REQUIRED" && specialized.fieldName) {
            steps.push({
                order: 2,
                action: "Nhập dữ liệu hợp lệ cho các trường còn lại",
                target: feature,
                value: "",
                expected: "Các trường còn lại có dữ liệu hợp lệ"
            });
            steps.push({
                order: 3,
                action: specialized.trigger.action,
                target: specialized.fieldName,
                value: "",
                expected: `${specialized.fieldName} không có giá trị`
            });
        } else {
            steps.push({
                order: 2,
                action: specialized.trigger.action,
                target: feature,
                value: this.cloneValue(specialized.trigger.value),
                expected: "Điều kiện kiểm thử được thiết lập"
            });
        }

        steps.push({
            order: steps.length + 1,
            action: `Thực hiện ${feature}`,
            target: feature,
            value: "",
            expected: "Hệ thống kiểm tra điều kiện nghiệp vụ"
        });
        steps.push({
            order: steps.length + 1,
            action: "Kiểm tra kết quả nghiệp vụ",
            target: feature,
            value: "",
            expected: expectedResult
        });

        return steps;
    }

    hasMeaningfulSteps(steps) {
        return (
            Array.isArray(steps) &&
            steps.length > 0 &&
            steps.every(step => String(step?.action ?? step?.description ?? step ?? "").trim())
        );
    }

    buildFallbackSteps(testCase) {
        const feature = testCase.feature || testCase.function;
        const scenario = testCase.scenario || testCase.title;
        const data = testCase.testData?.value || testCase.testData?.requirement || scenario;
        return [
            {
                order: 1,
                action: `Mở chức năng ${feature}`,
                target: feature,
                value: "",
                expected: `${feature} sẵn sàng để kiểm thử`
            },
            {
                order: 2,
                action: `Thiết lập dữ liệu cho tình huống: ${scenario}`,
                target: feature,
                value: data,
                expected: "Dữ liệu kiểm thử được nhập theo yêu cầu"
            },
            {
                order: 3,
                action: `Thực hiện ${feature}`,
                target: feature,
                value: "",
                expected: "Yêu cầu được gửi để hệ thống xử lý"
            },
            {
                order: 4,
                action: "Kiểm tra kết quả nghiệp vụ",
                target: feature,
                value: "",
                expected: testCase.expectedResult
            }
        ];
    }

    buildObjective(scenario) {
        switch (scenario.type) {
            case "NEGATIVE":
                return "Kiểm tra xử lý dữ liệu không hợp lệ";

            case "BOUNDARY":
                return "Kiểm tra giới hạn dữ liệu";

            case "PERMISSION":
                return "Kiểm tra quyền truy cập chức năng";

            case "SECURITY":
                return "Kiểm tra yêu cầu bảo mật";

            case "DATA_INTEGRITY":
                return "Kiểm tra tính toàn vẹn dữ liệu";

            default:
                return "Kiểm tra chức năng hoạt động đúng theo yêu cầu";
        }
    }

    buildSteps(steps, functionName, testerValue = "") {
        if (!Array.isArray(steps)) {
            return this.cloneValue(steps);
        }

        return steps.map(step => {
            if (!step || typeof step !== "object" || Array.isArray(step)) {
                return step;
            }

            const clonedStep = this.cloneValue(step);
            const action = String(clonedStep.action ?? "").trim();

            if (Object.prototype.hasOwnProperty.call(clonedStep, "value")) {
                clonedStep.value = testerValue;
            }

            if (/^Thực hiện thao tác$/i.test(action) && functionName) {
                clonedStep.action = `Thực hiện ${functionName}`;
            }

            return clonedStep;
        });
    }

    cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item));
        }

        if (value && typeof value === "object") {
            const clone = {};

            Object.entries(value).forEach(([key, item]) => {
                clone[key] = this.cloneValue(item);
            });

            return clone;
        }

        return value;
    }
}

export default TestCaseGenerator;
