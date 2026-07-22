import fs from "fs";

class MarkdownExporter {

    export(testCases, outputPath) {

        let markdown = "";

        markdown += "# QA COPILOT - TEST CASES\n\n";

        markdown += `Tổng số Test Case: ${testCases.length}\n\n`;

        testCases.forEach(testCase => {

            markdown += "---\n\n";

            markdown += `## ${testCase.id} - ${testCase.title}\n\n`;

            markdown += `| Thuộc tính | Giá trị |\n`;
            markdown += `|------------|---------|\n`;
            markdown += `| Feature | ${testCase.feature} |\n`;
            markdown += `| Type | ${testCase.type} |\n`;
            markdown += `| Severity | ${testCase.severity} |\n`;
            markdown += `| Priority | ${testCase.priority} |\n`;
            markdown += `| Automation | ${testCase.automationCandidate} |\n`;

            markdown += "\n";

            markdown += "### Preconditions\n\n";

            if (
                testCase.preconditions &&
                testCase.preconditions.length > 0
            ) {

                testCase.preconditions.forEach(item => {

                    markdown += `- ${item}\n`;

                });

            }
            else {

                markdown += "- Không có\n";

            }

            markdown += "\n";

            markdown += "### Test Steps\n\n";

            markdown += "| Bước | Action | Expected |\n";
            markdown += "|------|--------|----------|\n";

            testCase.steps.forEach(step => {

                markdown += `| ${step.order} | ${step.action} | ${step.expected} |\n`;

            });

            markdown += "\n";

            markdown += "### Expected Results\n\n";

            testCase.expectedResults.forEach(result => {

                markdown += `- ${result}\n`;

            });

            markdown += "\n";

        });

        fs.writeFileSync(
            outputPath,
            markdown,
            "utf8"
        );

        console.log(
            `✓ Markdown exported: ${outputPath}`
        );

    }

}

export default MarkdownExporter;