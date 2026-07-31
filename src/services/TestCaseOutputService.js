import fs from "node:fs";
import path from "node:path";
import ApprovedTestCaseFileName from "../utils/ApprovedTestCaseFileName.js";

class TestCaseOutputService {
    constructor({
        outputManager,
        fileNameGenerator,
        approvedFileName = new ApprovedTestCaseFileName()
    }) {
        if (!outputManager) {
            throw new Error("outputManager is required.");
        }

        if (!fileNameGenerator) {
            throw new Error("fileNameGenerator is required.");
        }

        this.outputManager = outputManager;
        this.fileNameGenerator = fileNameGenerator;
        this.approvedFileName = approvedFileName;
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
        const usesApprovedNaming = outputFileName === "approved-testcases";
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
            if (usesApprovedNaming) {
                this.removePreviousExport(outputDirectories[format], format);
            }
        });
        const formatBaseName = format =>
            usesApprovedNaming ? this.approvedFileName.baseName(normalizedTestCases, format) : baseName;
        const outputPaths = {
            json: path.join(outputDirectories.json, `${formatBaseName("json")}.json`),
            markdown: path.join(outputDirectories.markdown, `${formatBaseName("markdown")}.md`),
            excel: path.join(outputDirectories.excel, `${formatBaseName("excel")}.xlsx`),
            csv: path.join(outputDirectories.csv, `${formatBaseName("csv")}.csv`)
        };

        return Object.fromEntries(
            enabledFormats.map(format => [
                format,
                this.outputManager.export(normalizedTestCases, format, outputPaths[format]) ??
                    outputPaths[format]
            ])
        );
    }

    removePreviousExport(directory, format) {
        const extensions = {
            json: ".json",
            markdown: ".md",
            excel: ".xlsx"
        };
        const extension = extensions[format];
        if (!extension) return;

        fs.readdirSync(directory, { withFileTypes: true })
            .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
            .forEach(entry => fs.rmSync(path.join(directory, entry.name)));
    }

    toSafeFileName(value) {
        const normalizedValue =
            typeof value === "string" && value.trim() ? value.trim() : "testcases";

        return normalizedValue.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
    }
}

export default TestCaseOutputService;
