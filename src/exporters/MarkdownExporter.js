import fs from "fs";

class MarkdownExporter {

    export(testCases, outputPath) {

        let markdown = "# Test Cases\n\n";

        testCases.forEach(testCase => {

            markdown += `## ${testCase.id} - ${testCase.title}\n\n`;

            markdown += `**Chức năng**\n\n`;
            markdown += `${testCase.feature}\n\n`;

            markdown += `**Loại**\n\n`;
            markdown += `${testCase.type}\n\n`;

            markdown += `### Điều kiện\n\n`;

            if (testCase.preconditions.length > 0) {

                testCase.preconditions.forEach(item => {

                    markdown += `- ${item}\n`;

                });

            } else {

                markdown += "- Không có\n";

            }

            markdown += "\n";

            markdown += "### Các bước\n\n";

            testCase.steps.forEach((step, index) => {

                markdown += `${index + 1}. ${step}\n`;

            });

            markdown += "\n";

            markdown += "### Kết quả mong đợi\n\n";

            testCase.expectedResults.forEach(item => {

                markdown += `- ${item}\n`;

            });

            markdown += "\n---\n\n";

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