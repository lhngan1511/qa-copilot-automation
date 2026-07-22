import TestCase from "../models/TestCase.js";
import TestData from "../models/TestData.js";

class TestCaseGenerator {

    constructor() {

        this.counter = 1;

    }

    generate(scenarios) {

        if (!Array.isArray(scenarios)) {

            return [];

        }

        return scenarios.map(scenario => {

            const testCase = new TestCase();

            testCase.id =
                `TC${String(this.counter++).padStart(3, "0")}`;

            testCase.scenarioId =
                scenario.id;

            testCase.feature =
                scenario.feature;

            testCase.title =
                scenario.title;

            testCase.type =
                scenario.type;

            testCase.requirementReference =
                scenario.requirementReference;

            testCase.preconditions =
                scenario.preconditions || [];

            testCase.testData =
                new TestData();

            testCase.steps =
                scenario.steps || [];

            testCase.expectedResults =
                scenario.expectedResults || [];

            testCase.severity =
                scenario.severity;

            testCase.priority =
                scenario.priority;

            testCase.automationCandidate =
                scenario.automationCandidate;

            testCase.automation.candidate =
                scenario.automationCandidate;

            testCase.source =
                "AI";

            testCase.reason =
                scenario.reason;

            testCase.riskCategory =
                scenario.riskCategory;

            return testCase;

        });

    }

}

export default TestCaseGenerator;