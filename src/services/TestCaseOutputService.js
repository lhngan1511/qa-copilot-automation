import fs from "node:fs";
import path from "node:path";

class TestCaseOutputService {
    constructor({ outputManager, fileNameGenerator }) {
        if (!outputManager) {
            throw new Error("outputManager is required.");
        }

        if (!fileNameGenerator) {
            throw new Error("fileNameGenerator is required.");
        }

        this.outputManager = outputManager;
        this.fileNameGenerator = fileNameGenerator;
    }

    export({
        requirement,
        testCases,
        outputRoot = "./outputs/production",
        outputFilePrefix = "",
        outputFileName = "",
        formats = ["json", "markdown", "excel", "csv"]
    }) {
        const normalizedRequirement =
            requirement && typeof requirement === "object" ? requirement : {};

        const normalizedTestCases = Array.isArray(testCases) ? testCases : [];

        const featureName = normalizedRequirement.feature || "testcases";

        const safeFeature = this.toSafeFileName(featureName);

        const timestamp = this.fileNameGenerator.getTimestamp();

        const safePrefix = outputFilePrefix ? `${this.toSafeFileName(outputFilePrefix)}_` : "";

        const baseName = outputFileName
            ? this.toSafeFileName(outputFileName)
            : `${safePrefix}${safeFeature}_testcases_${timestamp}`;
        const outputDirectories = {
            json: path.join(outputRoot, "json"),
            markdown: path.join(outputRoot, "markdown"),
            excel: path.join(outputRoot, "excel"),
            csv: path.join(outputRoot, "csv")
        };

        const enabledFormats = [...new Set(formats)].filter(format =>
            Object.hasOwn(outputDirectories, format)
        );

        enabledFormats.forEach(format => {
            fs.mkdirSync(outputDirectories[format], { recursive: true });
        });
        const outputPaths = {
            json: path.join(outputDirectories.json, `${baseName}.json`),
            markdown: path.join(outputDirectories.markdown, `${baseName}.md`),
            excel: path.join(outputDirectories.excel, `${baseName}.xlsx`),
            csv: path.join(outputDirectories.csv, `${baseName}.csv`)
        };

        return Object.fromEntries(
            enabledFormats.map(format => [
                format,
                this.outputManager.export(normalizedTestCases, format, outputPaths[format]) ??
                    outputPaths[format]
            ])
        );
    }

    toSafeFileName(value) {
        const normalizedValue =
            typeof value === "string" && value.trim() ? value.trim() : "testcases";

        return normalizedValue.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
    }
}

export default TestCaseOutputService;
