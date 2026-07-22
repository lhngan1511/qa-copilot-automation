import fs from "fs";

class CsvExporter {

    export(testCases, outputPath) {

        const rows = [];

        rows.push([
            "ID",
            "Feature",
            "Title",
            "Type",
            "Severity",
            "Priority",
            "Automation",
            "Expected Result"
        ]);

        testCases.forEach(testCase => {

            rows.push([

                testCase.id,

                testCase.feature,

                testCase.title,

                testCase.type,

                testCase.severity,

                testCase.priority,

                testCase.automationCandidate,

                (testCase.expectedResults || []).join(" | ")

            ]);

        });

        const csv = rows
            .map(row =>
                row
                    .map(value => `"${String(value ?? "").replace(/"/g, '""')}"`)
                    .join(",")
            )
            .join("\n");

        fs.writeFileSync(
            outputPath,
            csv,
            "utf8"
        );

        console.log(
            `✓ CSV exported: ${outputPath}`
        );

    }

}

export default CsvExporter;