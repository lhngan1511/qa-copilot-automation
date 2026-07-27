import fs from "fs";
import path from "path";

class JsonExporter {
    export(testCases, featureName) {
        const outputDir = "./outputs/json";

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const safeName = (featureName || "testcases")
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, "_");

        const filePath = path.join(outputDir, `${safeName}_testcases.json`);

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
            if (
                key === "expectedResult" ||
                key === "expectedResults" ||
                key === "automation" ||
                key === "automationCandidate" ||
                key === "automationHints" ||
                key === "steps"
            ) {
                return;
            }

            canonical[key] = this.cloneValue(value);
        });

        canonical.steps = this.normalizeSteps(source.steps);
        canonical.expectedResults = this.resolveExpectedResults(source);
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
