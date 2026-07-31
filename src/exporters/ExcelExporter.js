import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import TestStepNormalizer from "../normalizers/TestStepNormalizer.js";

class ExcelExporter {
    constructor({ stepNormalizer = new TestStepNormalizer() } = {}) {
        this.stepNormalizer = stepNormalizer;
    }

    export(testCases = [], outputPath) {
        const normalizedTestCases = Array.isArray(testCases) ? testCases : [];
        const columns = [
            "STT",
            "Test Case ID",
            "Scenario ID",
            "Module ID",
            "Module",
            "Function ID",
            "Function",
            "Chức năng",
            "Mục tiêu kiểm thử",
            "Tình huống kiểm tra",
            "Tiền điều kiện",
            "Chuẩn bị dữ liệu",
            "Dữ liệu kiểm thử",
            "Các bước kiểm thử",
            "Kết quả mong đợi",
            "Kết quả thực tế",
            "Trạng thái",
            "Review Status",
            "Type",
            "Priority",
            "Severity",
            "Automation",
            "Automation Notes",
            "Requirement References",
            "Covered Rules",
            "Business Rule IDs",
            "Source"
        ];
        const moduleSummary = this.collectSummary(normalizedTestCases, "module");
        const featureSummary = this.collectSummary(normalizedTestCases, "feature");
        const rows = normalizedTestCases.map((testCase, index) => ({
            STT: index + 1,
            "Test Case ID": testCase?.testcaseId ?? testCase?.id ?? "",
            "Scenario ID": testCase?.scenarioId ?? "",
            "Module ID": testCase?.moduleId ?? "",
            Module: testCase?.module ?? "",
            "Function ID": testCase?.functionId ?? "",
            Function: testCase?.function ?? testCase?.feature ?? "",
            "Chức năng": testCase?.feature ?? "",
            "Mục tiêu kiểm thử": testCase?.objective ?? testCase?.testObjective ?? "",
            "Tình huống kiểm tra":
                testCase?.scenario ?? testCase?.testScenario ?? testCase?.title ?? "",
            "Tiền điều kiện": this.arrayToText(testCase?.preconditions),
            "Chuẩn bị dữ liệu": this.valueToText(testCase?.setupData),
            "Dữ liệu kiểm thử": this.testDataToText(testCase?.testData),
            "Các bước kiểm thử": this.stepsToText(testCase?.steps, testCase),
            "Kết quả mong đợi": this.resolveExpectedResult(testCase),
            "Kết quả thực tế": this.valueToText(testCase?.actualResult),
            "Trạng thái": testCase?.status || "Not Tested",
            "Review Status": testCase?.reviewStatus ?? "APPROVED",
            Type: testCase?.type ?? "",
            Priority: testCase?.priority ?? "",
            Severity: testCase?.severity ?? "",
            Automation: this.resolveAutomation(testCase),
            "Automation Notes": testCase?.automationNotes ?? "",
            "Requirement References": this.arrayToText(testCase?.requirementReferences),
            "Covered Rules": this.arrayToText(testCase?.coveredRules),
            "Business Rule IDs": this.arrayToText(testCase?.businessRuleIds),
            Source: testCase?.source ?? ""
        }));
        const metadataRows = [
            [`BỘ TEST CASE - ${moduleSummary}`],
            [`Module: ${moduleSummary}`],
            [`Chức năng: ${featureSummary}`],
            [`Tổng số Test Case: ${normalizedTestCases.length}`],
            [`Ngày tạo: ${this.getVietnamLocalDateTime()}`],
            []
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(metadataRows);

        XLSX.utils.sheet_add_json(worksheet, rows, {
            header: columns,
            origin: "A7",
            skipHeader: false
        });

        worksheet["!merges"] = [XLSX.utils.decode_range("A1:AA1")];
        worksheet["!autofilter"] = {
            ref: `A7:AA${normalizedTestCases.length > 0 ? normalizedTestCases.length + 7 : 7}`
        };
        worksheet["!cols"] = [
            { wch: 5 },
            { wch: 15 },
            { wch: 18 },
            { wch: 22 },
            { wch: 35 },
            { wch: 40 },
            { wch: 35 },
            { wch: 35 },
            { wch: 45 },
            { wch: 60 },
            { wch: 45 },
            { wch: 25 },
            { wch: 15 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 }
        ];
        worksheet["!rows"] = [
            { hpt: 28 },
            { hpt: 20 },
            { hpt: 20 },
            { hpt: 20 },
            { hpt: 20 },
            { hpt: 8 },
            { hpt: 24 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");

        const folder = path.dirname(outputPath);

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        XLSX.writeFile(workbook, outputPath);

        return outputPath;
    }

    collectSummary(testCases, field) {
        const seen = new Set();
        const values = [];

        testCases.forEach(testCase => {
            const value = this.normalizeText(testCase?.[field]);

            if (value && !seen.has(value)) {
                seen.add(value);
                values.push(value);
            }
        });

        return values.length > 0 ? values.join(", ") : "Chưa xác định";
    }

    testDataToText(testData) {
        if (
            testData?.fields &&
            typeof testData.fields === "object" &&
            !Array.isArray(testData.fields)
        ) {
            const lines = Object.entries(testData.fields).map(([name, field]) => {
                const value = field?.requiresTesterInput
                    ? field.instruction || "Tester cung cấp giá trị"
                    : this.valueToText(field?.value);
                return `${name}: ${value} (${field?.purpose ?? "VALID"})`;
            });
            if (testData.recordState) lines.push(`Trạng thái bản ghi: ${testData.recordState}`);
            if (testData.dataState) lines.push(`Trạng thái dữ liệu: ${testData.dataState}`);
            return lines.join("\n");
        }

        if (
            testData &&
            typeof testData === "object" &&
            !Array.isArray(testData) &&
            (Object.hasOwn(testData, "requirement") || Object.hasOwn(testData, "value"))
        ) {
            return [
                `Yêu cầu dữ liệu: ${testData.requirement ?? ""}`,
                `Giá trị tester: ${testData.value ?? ""}`
            ].join("\n");
        }

        return this.objectToText(testData);
    }

    getVietnamLocalDateTime() {
        return new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "medium",
            timeZone: "Asia/Ho_Chi_Minh"
        }).format(new Date());
    }

    arrayToText(value) {
        if (value === undefined || value === null) {
            return "";
        }

        if (!Array.isArray(value)) {
            return this.valueToText(value);
        }

        return value
            .map(item => this.valueToText(item))
            .filter(item => item !== "")
            .join("\n");
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
                .filter(item => item !== "")
                .join("\n");
        }

        if (typeof value === "object") {
            const lines = [];

            Object.entries(value).forEach(([key, item]) => {
                const text = this.valueToText(item, indentation + 1);
                const prefix = "  ".repeat(indentation);

                if (item && typeof item === "object") {
                    lines.push(`${prefix}${key}:`);

                    if (text) {
                        lines.push(
                            ...text
                                .split("\n")
                                .map(line => `${"  ".repeat(indentation + 1)}${line.trimStart()}`)
                        );
                    }
                } else {
                    lines.push(`${prefix}${key}: ${text}`);
                }
            });

            return lines.join("\n");
        }

        return "";
    }

    objectToText(data) {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return this.valueToText(data);
        }

        const validData = Object.prototype.hasOwnProperty.call(data, "inputs")
            ? data.inputs
            : data.valid;
        const sections = [
            ["Dữ liệu hợp lệ:", validData],
            ["Dữ liệu không hợp lệ:", data.invalid],
            ["Kết quả dữ liệu mong đợi:", data.expected]
        ];

        return sections
            .filter(([, value]) => this.hasValues(value))
            .map(([heading, value]) => `${heading}\n${this.valueToText(value)}`)
            .join("\n\n");
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

    stepsToText(steps, context = {}) {
        return this.stepNormalizer
            .normalize(steps, { ...context, preserveManualSteps: true })
            .map(step =>
                this.hasValues(step.expected)
                    ? `${step.order}. ${step.action}\nKết quả: ${this.valueToText(step.expected)}`
                    : `${step.order}. ${step.action}`
            )
            .join("\n\n");
    }

    resolveExpectedResult(testCase) {
        if (
            Array.isArray(testCase?.expectedResults) &&
            testCase.expectedResults.some(value => this.hasValues(value))
        ) {
            return this.arrayToText(testCase.expectedResults);
        }

        return this.hasValues(testCase?.expectedResult)
            ? this.valueToText(testCase.expectedResult)
            : "";
    }

    resolveAutomation(testCase) {
        return testCase?.automationCandidate === true ||
            testCase?.automation?.candidate === true ||
            testCase?.automationHints?.executable === true
            ? "Yes"
            : "No";
    }

    normalizeText(value) {
        if (value === undefined || value === null) {
            return "";
        }

        return String(value).replace(/\s+/g, " ").trim();
    }
}

export default ExcelExporter;
