import TestCase from "../models/TestCase.js";

class TestCaseGenerator {
    constructor() {
        this.counter = 1;
    }

    generate(scenarios = []) {
        if (!Array.isArray(scenarios)) {
            return [];
        }

        this.counter = 1;

        return scenarios.map(scenario => {
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

            testCase.module = scenario.module === undefined ? "" : scenario.module;

            testCase.feature = scenario.feature === undefined ? "" : scenario.feature;

            testCase.title = scenario.title === undefined ? "" : scenario.title;

            testCase.testScenario = scenario.testScenario ?? scenario.title ?? "";

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

            testCase.postconditions = Array.isArray(scenario.postconditions)
                ? this.cloneValue(scenario.postconditions)
                : [];

            testCase.automationNotes = scenario.automationNotes ?? "";

            testCase.automationCandidate = scenario.automationCandidate ?? false;

            testCase.preconditions =
                scenario.preconditions === undefined ? [] : scenario.preconditions;

            testCase.testData =
                scenario.testData === undefined ? testCase.testData : scenario.testData;

            testCase.steps =
                scenario.steps === undefined
                    ? []
                    : this.buildSteps(scenario.steps, testCase.function);

            testCase.expectedResult =
                scenario.expectedResult !== undefined
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

            return testCase;
        });
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

    buildSteps(steps, functionName) {
        if (!Array.isArray(steps)) {
            return this.cloneValue(steps);
        }

        return steps.map(step => {
            if (!step || typeof step !== "object" || Array.isArray(step)) {
                return step;
            }

            const clonedStep = this.cloneValue(step);
            const action = String(clonedStep.action ?? "").trim();

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
