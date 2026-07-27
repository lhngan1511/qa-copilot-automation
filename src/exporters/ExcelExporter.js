import fs from "fs";
import path from "path";
import XLSX from "xlsx";

class ExcelExporter {
    export(testCases = [], outputPath) {
        const normalizedTestCases = Array.isArray(testCases) ? testCases : [];
        const columns = [
            "STT",
            "Test Case ID",
            "Module",
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
            "Priority",
            "Severity",
            "Automation"
        ];
        const moduleSummary = this.collectSummary(normalizedTestCases, "module");
        const featureSummary = this.collectSummary(normalizedTestCases, "feature");
        const rows = normalizedTestCases.map((testCase, index) => ({
            STT: index + 1,
            "Test Case ID": testCase?.id ?? "",
            Module: testCase?.module ?? "",
            "Chức năng": testCase?.feature ?? "",
            "Mục tiêu kiểm thử": testCase?.testObjective ?? "",
            "Tình huống kiểm tra": testCase?.testScenario ?? "",
            "Tiền điều kiện": this.arrayToText(testCase?.preconditions),
            "Chuẩn bị dữ liệu": this.valueToText(testCase?.setupData),
            "Dữ liệu kiểm thử": this.objectToText(testCase?.testData),
            "Các bước kiểm thử": this.stepsToText(testCase?.steps),
            "Kết quả mong đợi": this.resolveExpectedResult(testCase),
            "Kết quả thực tế": this.valueToText(testCase?.actualResult),
            "Trạng thái": testCase?.status || "Not Tested",
            Priority: testCase?.priority ?? "",
            Severity: testCase?.severity ?? "",
            Automation: this.resolveAutomation(testCase)
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

        worksheet["!merges"] = [XLSX.utils.decode_range("A1:P1")];
        worksheet["!autofilter"] = {
            ref: `A7:P${normalizedTestCases.length > 0 ? normalizedTestCases.length + 7 : 7}`
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

    stepsToText(steps) {
        if (!Array.isArray(steps)) {
            return "";
        }

        return steps
            .map((step, index) => {
                if (typeof step === "string") {
                    const action = step.trim();
                    return action ? `${index + 1}. ${action}` : "";
                }

                if (!step || typeof step !== "object") {
                    return "";
                }

                const action = this.valueToText(step.action);

                if (!action) {
                    return "";
                }

                const order = this.hasValues(step.order) ? step.order : index + 1;
                const expected = this.valueToText(step.expected);

                return expected
                    ? `${order}. ${action}\nKết quả: ${expected}`
                    : `${order}. ${action}`;
            })
            .filter(Boolean)
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
