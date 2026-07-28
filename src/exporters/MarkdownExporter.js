import fs from "fs";

class MarkdownExporter {
    export(testCases, outputPath) {
        const normalizedTestCases = Array.isArray(testCases) ? testCases : [];
        const modules = this.collectSummary(normalizedTestCases, "module");
        const features = this.collectSummary(normalizedTestCases, "feature");
        let markdown = "# QA Copilot V2 - Test Specification\n\n";

        markdown += `Module: ${modules}\n\n`;
        markdown += `Feature: ${features}\n\n`;
        markdown += `Generated: ${this.getVietnamLocalDateTime()}\n\n`;
        markdown += `Total Test Cases: ${normalizedTestCases.length}\n\n`;

        normalizedTestCases.forEach(testCase => {
            markdown += "---\n\n";
            markdown += `## ${this.safeInline(testCase?.id)} - ${this.safeInline(testCase?.title)}\n\n`;
            markdown += "| Thuộc tính | Giá trị |\n";
            markdown += "|---|---|\n";
            markdown += `| TestCase ID | ${this.safeInline(testCase?.testcaseId ?? testCase?.id)} |\n`;
            markdown += `| Scenario ID | ${this.safeInline(testCase?.scenarioId)} |\n`;
            markdown += `| Module ID | ${this.safeInline(testCase?.moduleId)} |\n`;
            markdown += `| Module | ${this.safeInline(testCase?.module)} |\n`;
            markdown += `| Function ID | ${this.safeInline(testCase?.functionId)} |\n`;
            markdown += `| Function | ${this.safeInline(testCase?.function ?? testCase?.feature)} |\n`;
            markdown += `| Chức năng | ${this.safeInline(testCase?.feature)} |\n`;
            markdown += `| Loại | ${this.safeInline(testCase?.type)} |\n`;
            markdown += `| Objective | ${this.safeInline(testCase?.objective ?? testCase?.testObjective)} |\n`;
            markdown += `| Priority | ${this.safeInline(testCase?.priority)} |\n`;
            markdown += `| Severity | ${this.safeInline(testCase?.severity)} |\n`;
            markdown += `| Automation | ${this.resolveAutomation(testCase)} |\n`;
            markdown += `| Automation Notes | ${this.safeInline(testCase?.automationNotes)} |\n`;
            markdown += `| Requirement References | ${this.safeInline(testCase?.requirementReferences)} |\n`;
            markdown += `| Covered Rules | ${this.safeInline(testCase?.coveredRules)} |\n`;
            markdown += `| Source | ${this.safeInline(testCase?.source)} |\n\n`;

            markdown += "### Tiền điều kiện\n\n";
            markdown += this.renderList(testCase?.preconditions, "Không có");
            markdown += "\n";

            if (this.hasValues(testCase?.setupData)) {
                markdown += "### Chuẩn bị dữ liệu\n\n";
                markdown += this.renderValueBlock(testCase.setupData);
                markdown += "\n";
            }

            markdown += "### Dữ liệu kiểm thử\n\n";
            markdown += this.renderTestData(testCase?.testData);
            markdown += "\n";

            markdown += "### Các bước kiểm thử\n\n";
            markdown += this.renderSteps(testCase?.steps);
            markdown += "\n";

            markdown += "### Kết quả mong đợi\n\n";
            markdown += this.renderExpectedResults(testCase);
            markdown += "\n";
        });

        fs.writeFileSync(outputPath, markdown, "utf8");

        const exportedPath = outputPath;

        console.log(`✓ Markdown exported: ${outputPath}`);
        return exportedPath;
    }

    collectSummary(testCases, field) {
        const values = [];
        const seen = new Set();

        testCases.forEach(testCase => {
            const value = this.normalizeText(testCase?.[field]);

            if (value && !seen.has(value)) {
                seen.add(value);
                values.push(value);
            }
        });

        return values.length > 0 ? values.join(", ") : "Chưa xác định";
    }

    getVietnamLocalDateTime() {
        return new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "medium",
            timeZone: "Asia/Ho_Chi_Minh"
        }).format(new Date());
    }

    resolveAutomation(testCase) {
        if (typeof testCase?.automationCandidate === "boolean") {
            return testCase.automationCandidate ? "Yes" : "No";
        }

        if (typeof testCase?.automation?.candidate === "boolean") {
            return testCase.automation.candidate ? "Yes" : "No";
        }

        if (typeof testCase?.automationHints?.executable === "boolean") {
            return testCase.automationHints.executable ? "Yes" : "No";
        }

        return "No";
    }

    renderList(value, emptyText = "") {
        const items = Array.isArray(value) ? value : this.hasValues(value) ? [value] : [];

        if (items.length === 0) {
            return emptyText ? `- ${emptyText}\n` : "";
        }

        return items
            .map(item => this.valueToText(item))
            .filter(Boolean)
            .map(item => `- ${item.replace(/\n/g, "\n  ")}\n`)
            .join("");
    }

    renderValueBlock(value) {
        const text = this.valueToText(value);

        return text ? `\`\`\`text\n${text}\n\`\`\`\n` : "";
    }

    renderTestData(data) {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return this.hasValues(data) ? this.renderValueBlock(data) : "- Không có\n";
        }

        const validData = Object.prototype.hasOwnProperty.call(data, "inputs")
            ? data.inputs
            : data.valid;
        const sections = [
            ["Dữ liệu hợp lệ", validData],
            ["Dữ liệu không hợp lệ", data.invalid],
            ["Kết quả dữ liệu mong đợi", data.expected]
        ].filter(([, value]) => this.hasValues(value));

        if (sections.length === 0) {
            return "- Không có\n";
        }

        return sections
            .map(([heading, value]) => `#### ${heading}\n\n${this.renderValueBlock(value)}`)
            .join("\n");
    }

    renderSteps(steps) {
        const normalizedSteps = this.normalizeSteps(steps);
        const hasExpected = normalizedSteps.some(step => this.hasValues(step.expected));
        let markdown = hasExpected
            ? "| Bước | Hành động | Kết quả mong đợi |\n|---|---|---|\n"
            : "| Bước | Hành động |\n|---|---|\n";

        normalizedSteps.forEach((step, index) => {
            const order = this.hasValues(step.order) ? step.order : index + 1;
            const action = this.safeTableCell(step.action);

            if (hasExpected) {
                markdown += `| ${this.safeTableCell(order)} | ${action} | ${this.safeTableCell(step.expected)} |\n`;
            } else {
                markdown += `| ${this.safeTableCell(order)} | ${action} |\n`;
            }
        });

        return markdown;
    }

    normalizeSteps(steps) {
        if (!Array.isArray(steps)) {
            return [];
        }

        return steps
            .map((step, index) => {
                if (typeof step === "string") {
                    return {
                        order: index + 1,
                        action: step,
                        expected: ""
                    };
                }

                if (!step || typeof step !== "object") {
                    return null;
                }

                const action = this.valueToText(step.action);

                if (!action) {
                    return null;
                }

                return {
                    order: step.order,
                    action,
                    expected: this.valueToText(step.expectedResult ?? step.expected)
                };
            })
            .filter(Boolean);
    }

    renderExpectedResults(testCase) {
        const expectedResults = Array.isArray(testCase?.expectedResults)
            ? testCase.expectedResults.filter(value => this.hasValues(value))
            : [];

        if (expectedResults.length > 0) {
            return this.renderList(expectedResults);
        }

        if (this.hasValues(testCase?.expectedResult)) {
            return this.renderList([testCase.expectedResult]);
        }

        return "";
    }

    valueToText(value, indentation = 0) {
        if (value === undefined || value === null) {
            return "";
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }

        if (Array.isArray(value)) {
            return value
                .map(item => this.valueToText(item, indentation))
                .filter(Boolean)
                .join("\n");
        }

        if (typeof value === "object") {
            return Object.entries(value)
                .map(([key, item]) => {
                    const text = this.valueToText(item, indentation + 1);
                    const prefix = "  ".repeat(indentation);

                    if (item && typeof item === "object") {
                        return text
                            ? `${prefix}${key}:\n${text
                                  .split("\n")
                                  .map(line => `${"  ".repeat(indentation + 1)}${line.trimStart()}`)
                                  .join("\n")}`
                            : `${prefix}${key}:`;
                    }

                    return `${prefix}${key}: ${text}`;
                })
                .join("\n");
        }

        return "";
    }

    safeInline(value) {
        return this.valueToText(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
    }

    safeTableCell(value) {
        return this.valueToText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
    }

    hasValues(value) {
        if (value === undefined || value === null || value === "") {
            return false;
        }

        if (Array.isArray(value)) {
            return value.length > 0;
        }

        if (typeof value === "object") {
            return Object.keys(value).length > 0;
        }

        return true;
    }

    normalizeText(value) {
        if (value === undefined || value === null) {
            return "";
        }

        return String(value).replace(/\s+/g, " ").trim();
    }
}

export default MarkdownExporter;
