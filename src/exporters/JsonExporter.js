import fs from "fs";
import path from "path";
import { normalizeTestData, resolveExecutionReadiness } from "../utils/TestDataReadiness.js";

class JsonExporter {
    export(testCases, outputPath) {
        const filePath = outputPath || "./outputs/json/testcases.json";
        const outputDir = path.dirname(filePath);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const canonicalTestCases = Array.isArray(testCases)
            ? testCases.map(testCase => this.toCanonicalTestCase(testCase))
            : [];

        fs.writeFileSync(
            filePath,

            JSON.stringify(canonicalTestCases, null, 2),

            "utf8"
        );

        console.log(`✓ JSON exported: ${filePath}`);

        return filePath;
    }

    toCanonicalTestCase(testCase) {
        const source = testCase && typeof testCase === "object" ? testCase : {};
        const canonical = {};

        Object.entries(source).forEach(([key, value]) => {
            if (key === "automation" || key === "automationHints" || key === "steps") {
                return;
            }

            canonical[key] = this.cloneValue(value);
        });

        canonical.testcaseId = source.testcaseId ?? source.testCaseId ?? source.id ?? "";
        canonical.testData = normalizeTestData(source.testData, source);
        canonical.executionReadiness = resolveExecutionReadiness(canonical.testData);
        canonical.steps = this.normalizeSteps(source.steps);
        canonical.expectedResult = this.resolveExpectedResult(source);
        canonical.expectedResults = this.resolveExpectedResults(source);
        canonical.automationCandidate = this.resolveAutomationCandidate(source);
        canonical.automationHints = this.isPlainObject(source.automationHints)
            ? this.cloneValue(source.automationHints)
            : {};

        return canonical;
    }

    normalizeSteps(steps) {
        if (!Array.isArray(steps)) {
            return [];
        }

        return steps
            .map((step, index) => {
                if (step && typeof step === "object" && !Array.isArray(step)) {
                    return this.cloneValue(step);
                }

                if (
                    typeof step === "string" ||
                    typeof step === "number" ||
                    typeof step === "boolean"
                ) {
                    return {
                        order: index + 1,
                        action: String(step),
                        expected: ""
                    };
                }

                return null;
            })
            .filter(Boolean);
    }

    resolveExpectedResults(testCase) {
        if (Array.isArray(testCase.expectedResults)) {
            return this.cloneValue(testCase.expectedResults);
        }

        if (
            testCase.expectedResult !== undefined &&
            testCase.expectedResult !== null &&
            testCase.expectedResult !== ""
        ) {
            return [this.cloneValue(testCase.expectedResult)];
        }

        return [];
    }

    resolveExpectedResult(testCase) {
        if (testCase.expectedResult !== undefined && testCase.expectedResult !== null) {
            return this.cloneValue(testCase.expectedResult);
        }

        return Array.isArray(testCase.expectedResults)
            ? this.cloneValue(testCase.expectedResults[0] ?? "")
            : "";
    }

    resolveAutomationCandidate(testCase) {
        if (typeof testCase.automationCandidate === "boolean") {
            return testCase.automationCandidate;
        }

        if (typeof testCase.automation?.candidate === "boolean") {
            return testCase.automation.candidate;
        }

        return testCase.automationHints?.executable === true;
    }

    cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item));
        }

        if (this.isPlainObject(value)) {
            const clone = {};

            Object.entries(value).forEach(([key, item]) => {
                clone[key] = this.cloneValue(item);
            });

            return clone;
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
}

export default JsonExporter;
