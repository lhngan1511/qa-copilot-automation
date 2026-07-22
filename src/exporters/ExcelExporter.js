import XLSX from "xlsx";

class ExcelExporter {

    export(testCases, outputPath) {

        const rows = testCases.map(testCase => ({

            ID: testCase.id,

            Feature: testCase.feature,

            Title: testCase.title,

            Type: testCase.type,

            Preconditions:
                testCase.preconditions.join("\n"),

            Steps:
                testCase.steps.join("\n"),

            ExpectedResults:
                testCase.expectedResults.join("\n"),

            Severity: testCase.severity,

            Priority: testCase.priority,

            Automation:
                testCase.automationCandidate
                    ? "Yes"
                    : "No"

        }));

        const worksheet =
            XLSX.utils.json_to_sheet(rows);

        const workbook =
            XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "TestCases"
        );

        XLSX.writeFile(
            workbook,
            outputPath
        );

        console.log(
            `✓ Excel exported: ${outputPath}`
        );

    }

}

export default ExcelExporter;