import RequirementObject from "../models/RequirementObject.js";
import FeatureObject from "../models/FeatureObject.js";
import CommonInput from "../models/CommonInput.js";
import Relationship from "../models/Relationship.js";

/*
=====================================================

 MarkdownParser

 Purpose:

 - Đọc Requirement Markdown theo Specification V1
 - Hỗ trợ một Module có nhiều Feature
 - Đọc dữ liệu đầu vào của từng Feature
 - Đọc Main Flow và Expected Results
 - Đọc các quy tắc nghiệp vụ cơ bản
 - Đọc Automation Metadata:
      + Screen
      + Operation

=====================================================
*/

export default class MarkdownParser {
    /*
    =================================================
    Public Method
    =================================================
    */

    parse(markdown) {
        if (typeof markdown !== "string" || !markdown.trim()) {
            throw new Error("Markdown content must be a non-empty string.");
        }

        const lines = this.normalizeMarkdown(markdown).split("\n");

        const requirement = new RequirementObject();

        /*
        =============================================
        Module Information
        =============================================
        */

        requirement.module = this.extractModule(lines);

        /*
        Giữ lại để tương thích với code cũ.

        Pipeline mới phải sử dụng requirement.features.
        Không nên sử dụng requirement.feature lâu dài.
        */

        requirement.feature = requirement.module;

        requirement.purpose = this.extractGlobalTextSection(lines, [
            "Mục đích trang",
            "Mục đích",
            "Purpose"
        ]);

        requirement.description = this.extractGlobalTextSection(lines, ["Mô tả", "Description"]);

        requirement.permissions = this.extractGlobalListSection(lines, [
            "Quyền truy cập",
            "Phân quyền",
            "Permissions",
            "Access Rights"
        ]);

        requirement.commonInputs = this.extractCommonInputs(lines);

        requirement.inputDefinitions = requirement.commonInputs.map(input =>
            this.cloneCommonInput(input)
        );

        requirement.relationships = this.extractRelationships(lines);

        /*
        =============================================
        Features
        =============================================
        */

        requirement.features = this.extractFeatures(lines);

        /*
        =============================================
        Aggregate Requirement Data

        Giữ các thuộc tính này để tương thích với
        Intelligence Engine và Generator hiện tại.
        =============================================
        */

        requirement.actions = this.uniqueStrings(requirement.features.map(feature => feature.name));

        requirement.businessRules = this.uniqueRuleObjects(
            requirement.features.flatMap(feature => feature.businessRules ?? [])
        );

        requirement.expectedResults = this.uniqueStrings(
            requirement.features.flatMap(feature => feature.expectedResults ?? [])
        );

        requirement.edgeCases = this.uniqueRuleObjects(
            requirement.features.flatMap(feature => feature.exceptions ?? [])
        );

        requirement.conditions = this.uniqueStrings(
            requirement.features.flatMap(feature => feature.preconditions ?? [])
        );

        requirement.questions = requirement.questions ?? [];

        requirement.notes = requirement.notes ?? [];

        requirement.version = requirement.version || "1.0";

        return requirement;
    }

    /*
    =================================================
    Normalize Markdown
    =================================================
    */

    normalizeMarkdown(markdown) {
        return markdown
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\u00A0/g, " ")
            .trim();
    }

    /*
    =================================================
    Module
    =================================================
    */

    extractModule(lines) {
        for (const line of lines) {
            const heading = this.parseHeading(line);

            if (!heading || heading.level !== 1) {
                continue;
            }

            const title = this.cleanText(heading.title);

            const moduleMatch = title.match(/^(?:module|mô-?đun)\s*:\s*(.+)$/i);

            if (moduleMatch) {
                return this.cleanText(moduleMatch[1]);
            }

            /*
            Bỏ qua heading container.
            */

            if (this.normalizeTitle(title) === "features") {
                continue;
            }

            return title;
        }

        return "";
    }

    /*
    =================================================
    Global Sections
    =================================================
    */

    extractGlobalTextSection(lines, titles) {
        const section = this.findFirstSection(lines, titles);

        if (!section) {
            return "";
        }

        return section.lines
            .map(line => line.trim())
            .filter(Boolean)
            .filter(
                line =>
                    !this.isBulletLine(line) &&
                    !line.startsWith("|") &&
                    !this.isHorizontalRule(line)
            )
            .map(line => this.cleanText(line))
            .filter(Boolean)
            .join(" ")
            .trim();
    }

    extractGlobalListSection(lines, titles) {
        const section = this.findFirstSection(lines, titles);

        if (!section) {
            return [];
        }

        return this.extractBulletItems(section.lines);
    }

    findFirstSection(lines, titles) {
        const normalizedTitles = titles.map(title => this.normalizeTitle(title));

        for (let index = 0; index < lines.length; index += 1) {
            const heading = this.parseHeading(lines[index]);

            if (!heading) {
                continue;
            }

            const normalizedHeading = this.normalizeTitle(heading.title);

            if (!normalizedTitles.includes(normalizedHeading)) {
                continue;
            }

            /*
            Không lấy subsection nằm trong Feature
            làm dữ liệu toàn cục.
            */

            if (this.isInsideFeature(lines, index)) {
                continue;
            }

            const sectionLines = [];

            for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
                const nextHeading = this.parseHeading(lines[cursor]);

                if (nextHeading && nextHeading.level <= heading.level) {
                    break;
                }

                sectionLines.push(lines[cursor]);
            }

            return {
                title: heading.title,
                level: heading.level,
                lines: sectionLines
            };
        }

        return null;
    }

    isInsideFeature(lines, currentIndex) {
        for (let index = currentIndex - 1; index >= 0; index -= 1) {
            const heading = this.parseHeading(lines[index]);

            if (!heading) {
                continue;
            }

            if (this.isFeatureHeading(heading.title)) {
                return true;
            }

            if (heading.level <= 2) {
                return false;
            }
        }

        return false;
    }

    /*
    =================================================
    Common Inputs
    =================================================
    */

    extractCommonInputs(lines) {
        const section = this.findFirstSection(lines, [
            "Dữ liệu dùng chung",
            "Thông tin dùng chung",
            "Common Inputs",
            "Shared Data"
        ]);

        if (!section) {
            return [];
        }

        const rows = this.parseMarkdownTable(section.lines);

        return rows
            .map(row => {
                const input = new CommonInput();

                input.name = this.getTableValue(row, ["Trường", "Tên trường", "Field", "Name"]);

                input.controlType = this.getTableValue(row, [
                    "Control Type",
                    "Loại control",
                    "Control"
                ]);

                input.dataSource = this.getTableValue(row, [
                    "Nguồn dữ liệu",
                    "Data Source",
                    "Source"
                ]);

                input.required = this.toBoolean(this.getTableValue(row, ["Bắt buộc", "Required"]));

                input.description = this.getTableValue(row, [
                    "Mô tả",
                    "Quy tắc",
                    "Description",
                    "Rule"
                ]);

                return input;
            })
            .filter(input => Boolean(input.name));
    }

    cloneCommonInput(source) {
        const input = new CommonInput();

        input.name = source.name ?? "";

        input.controlType = source.controlType ?? "";

        input.dataSource = source.dataSource ?? "";

        input.required = Boolean(source.required);

        input.description = source.description ?? "";

        return input;
    }

    /*
    =================================================
    Relationships
    =================================================
    */

    extractRelationships(lines) {
        const section = this.findFirstSection(lines, [
            "Quan hệ dữ liệu",
            "Mối quan hệ",
            "Quan hệ",
            "Relationships"
        ]);

        if (!section) {
            return [];
        }

        const rows = this.parseMarkdownTable(section.lines);

        if (rows.length > 0) {
            return rows
                .map(row => {
                    const relationship = new Relationship();

                    relationship.relatedObject = this.getTableValue(row, [
                        "Đối tượng liên quan",
                        "Đối tượng",
                        "Related Object",
                        "Object"
                    ]);

                    relationship.type = this.getTableValue(row, ["Loại quan hệ", "Loại", "Type"]);

                    relationship.description = this.getTableValue(row, ["Mô tả", "Description"]);

                    return relationship;
                })
                .filter(relationship =>
                    Boolean(relationship.relatedObject || relationship.description)
                );
        }

        return this.extractBulletItems(section.lines).map(content => {
            const relationship = new Relationship();

            relationship.relatedObject = "";

            relationship.type = "";

            relationship.description = content;

            return relationship;
        });
    }

    /*
    =================================================
    Feature Extraction
    =================================================
    */

    extractFeatures(lines) {
        const featureHeadings = this.findFeatureHeadings(lines);

        const businessRuleCounter = {
            value: 1
        };

        const exceptionCounter = {
            value: 1
        };

        return featureHeadings.map((featureHeading, index) => {
            const nextFeature = featureHeadings[index + 1];

            const blockEnd = nextFeature ? nextFeature.index : lines.length;

            const blockLines = lines.slice(featureHeading.index + 1, blockEnd);

            return this.parseFeatureBlock(
                featureHeading,
                blockLines,
                index,
                businessRuleCounter,
                exceptionCounter
            );
        });
    }

    findFeatureHeadings(lines) {
        const result = [];

        for (let index = 0; index < lines.length; index += 1) {
            const heading = this.parseHeading(lines[index]);

            if (!heading) {
                continue;
            }

            if (!this.isFeatureHeading(heading.title)) {
                continue;
            }

            result.push({
                index,
                level: heading.level,
                title: heading.title
            });
        }

        return result;
    }

    isFeatureHeading(title) {
        const rawTitle = this.cleanText(title);

        if (/^(?:feature|chức năng)\s*:/i.test(rawTitle)) {
            return true;
        }

        const normalized = this.normalizeTitle(rawTitle);

        if (!normalized) {
            return false;
        }

        if (
            this.isGlobalSectionTitle(normalized) ||
            this.isFeatureSubsectionTitle(normalized) ||
            this.isFeatureContainerTitle(normalized)
        ) {
            return false;
        }

        /*
        Hỗ trợ Requirement cũ có đánh số.
        */

        if (/^\s*(?:chức năng\s*)?\d+\s*[.)\-:]?\s*.+/i.test(rawTitle)) {
            return true;
        }

        /*
        Hỗ trợ Requirement cũ không dùng "Feature:".
        */

        const featureVerbs = [
            "thêm",
            "tạo",
            "sửa",
            "cập nhật",
            "xóa",
            "xoá",
            "tìm kiếm",
            "tra cứu",
            "xem",
            "duyệt",
            "phê duyệt",
            "hủy",
            "huỷ",
            "nhập",
            "xuất",
            "đăng nhập",
            "đăng xuất"
        ];

        return featureVerbs.some(verb => normalized === verb || normalized.startsWith(`${verb} `));
    }

    parseFeatureBlock(featureHeading, blockLines, index, businessRuleCounter, exceptionCounter) {
        const feature = new FeatureObject();

        feature.id = this.extractFeatureId(featureHeading.title) || String(index + 1);

        feature.name = this.normalizeFeatureName(featureHeading.title);

        feature.description = this.extractBlockTextSection(blockLines, ["Mô tả", "Description"]);

        feature.preconditions = this.extractBlockListSection(blockLines, [
            "Điều kiện tiên quyết",
            "Tiền điều kiện",
            "Điều kiện",
            "Preconditions"
        ]);

        /*
        =============================================
        Feature Inputs
        =============================================
        */

        feature.inputs = this.extractFeatureInputs(blockLines);

        feature.flow = this.extractBlockListSection(blockLines, [
            "Luồng xử lý",
            "Luồng chính",
            "Các bước thực hiện",
            "Flow",
            "Main Flow"
        ]);

        const rawBusinessRules = this.extractBlockListSection(blockLines, [
            "Quy tắc cơ bản",
            "Quy tắc nghiệp vụ",
            "Business Rules",
            "Business Rule",
            "Basic Rules"
        ]);

        feature.businessRules = this.normalizeRuleList(rawBusinessRules, "BR", businessRuleCounter);

        feature.expectedResults = this.extractBlockListSection(blockLines, [
            "Kết quả mong đợi",
            "Kết quả",
            "Expected Results",
            "Expected Result"
        ]);

        /*
        Hỗ trợ Requirement cũ có phần Ngoại lệ.
        Requirement V1 không bắt buộc section này.
        */

        const rawExceptions = this.extractBlockListSection(blockLines, [
            "Trường hợp ngoại lệ",
            "Ngoại lệ",
            "Exceptions",
            "Exception"
        ]);

        feature.exceptions = this.normalizeRuleList(rawExceptions, "EX", exceptionCounter);

        /*
        =============================================
        Automation Metadata
        =============================================
        */

        feature.automation = this.extractAutomation(blockLines);

        feature.testScenarios = feature.testScenarios ?? [];

        feature.testCases = feature.testCases ?? [];

        return feature;
    }

    /*
    =================================================
    Feature Inputs
    =================================================
    */

    extractFeatureInputs(blockLines) {
        const section = this.findBlockSection(blockLines, [
            "Dữ liệu đầu vào",
            "Input",
            "Inputs",
            "Input Data"
        ]);

        if (!section) {
            return [];
        }

        const rows = this.parseMarkdownTable(section);

        if (rows.length > 0) {
            return rows
                .map(row => {
                    const name = this.getTableValue(row, ["Trường", "Tên trường", "Field", "Name"]);

                    const requiredText = this.getTableValue(row, ["Bắt buộc", "Required"]);

                    const description = this.getTableValue(row, [
                        "Mô tả",
                        "Quy tắc",
                        "Description",
                        "Rule"
                    ]);

                    const controlType = this.getTableValue(row, [
                        "Control Type",
                        "Loại control",
                        "Control"
                    ]);

                    return {
                        name,
                        required: this.toBoolean(requiredText),
                        description,
                        controlType
                    };
                })
                .filter(input => Boolean(input.name));
        }

        return this.extractBulletItems(section).map(name => ({
            name,

            required: false,

            description: "",

            controlType: ""
        }));
    }

    /*
    =================================================
    Automation Metadata
    =================================================
    */

    extractAutomation(blockLines) {
        const section = this.findBlockSection(blockLines, [
            "Automation",
            "Tự động hóa",
            "Automation Metadata"
        ]);

        const automation = {
            screen: "",

            operation: ""
        };

        if (!section) {
            return automation;
        }

        for (const line of section) {
            const cleanedLine = this.cleanText(line);

            const match = cleanedLine.match(/^([^:]+)\s*:\s*(.+)$/);

            if (!match) {
                continue;
            }

            const key = this.normalizeTitle(match[1]);

            const value = this.cleanText(match[2]);

            if (key === "screen" || key === "page" || key === "màn hình") {
                automation.screen = value;
            }

            if (key === "operation" || key === "action" || key === "thao tác") {
                automation.operation = value;
            }
        }

        return automation;
    }

    /*
    =================================================
    Feature Subsections
    =================================================
    */

    extractBlockTextSection(blockLines, titles) {
        const section = this.findBlockSection(blockLines, titles);

        if (!section) {
            return "";
        }

        return section
            .map(line => line.trim())
            .filter(Boolean)
            .filter(
                line =>
                    !this.isBulletLine(line) &&
                    !line.startsWith("|") &&
                    !this.isHorizontalRule(line)
            )
            .map(line => this.cleanText(line))
            .filter(Boolean)
            .join(" ")
            .trim();
    }

    extractBlockListSection(blockLines, titles) {
        const section = this.findBlockSection(blockLines, titles);

        if (!section) {
            return [];
        }

        const bulletItems = this.extractBulletItems(section);

        if (bulletItems.length > 0) {
            return bulletItems;
        }

        const tableRows = this.parseMarkdownTable(section);

        if (tableRows.length > 0) {
            return tableRows.map(row => this.convertTableRowToListItem(row)).filter(Boolean);
        }

        return section
            .map(line => line.trim())
            .filter(Boolean)
            .filter(line => !this.isHorizontalRule(line) && !this.parseHeading(line))
            .map(line => this.cleanText(line))
            .filter(Boolean);
    }

    findBlockSection(blockLines, titles) {
        const normalizedTitles = titles.map(title => this.normalizeTitle(title));

        for (let index = 0; index < blockLines.length; index += 1) {
            const heading = this.parseHeading(blockLines[index]);

            if (!heading) {
                continue;
            }

            const normalizedHeading = this.normalizeTitle(heading.title);

            if (!normalizedTitles.includes(normalizedHeading)) {
                continue;
            }

            const sectionLines = [];

            for (let cursor = index + 1; cursor < blockLines.length; cursor += 1) {
                const nextHeading = this.parseHeading(blockLines[cursor]);

                if (nextHeading) {
                    break;
                }

                sectionLines.push(blockLines[cursor]);
            }

            return sectionLines;
        }

        return null;
    }

    /*
    =================================================
    Rule Normalization
    =================================================
    */

    normalizeRuleList(values, prefix, counter) {
        const result = [];

        for (const value of values) {
            const normalized = this.normalizeRuleItem(value, prefix, counter);

            if (normalized.content) {
                result.push(normalized);
            }
        }

        return result;
    }

    normalizeRuleItem(value, prefix, counter) {
        if (value && typeof value === "object") {
            const code = this.cleanText(value.code ?? "");

            const content = this.cleanText(value.content ?? value.description ?? value.text ?? "");

            return {
                code: code || this.generateRuleCode(prefix, counter),

                content
            };
        }

        const text = this.cleanText(value);

        if (!text) {
            return {
                code: "",
                content: ""
            };
        }

        const codedMatch = text.match(/^([A-Za-z]{2,5}\s*\d+)\s*[:|\-–—]\s*(.+)$/);

        if (codedMatch) {
            return {
                code: codedMatch[1].replace(/\s+/g, "").toUpperCase(),

                content: this.cleanText(codedMatch[2])
            };
        }

        return {
            code: this.generateRuleCode(prefix, counter),

            content: text
        };
    }

    generateRuleCode(prefix, counter) {
        const code = prefix.toUpperCase() + String(counter.value).padStart(2, "0");

        counter.value += 1;

        return code;
    }

    convertTableRowToListItem(row) {
        const code = this.getTableValue(row, ["Mã", "Mã quy tắc", "Mã ngoại lệ", "Code", "ID"]);

        const content = this.getTableValue(row, [
            "Nội dung",
            "Quy tắc",
            "Ngoại lệ",
            "Mô tả",
            "Content",
            "Description"
        ]);

        if (code && content) {
            return `${code}: ${content}`;
        }

        if (content) {
            return content;
        }

        const values = Object.values(row)
            .map(value => this.cleanText(value))
            .filter(Boolean);

        if (values.length >= 2) {
            return `${values[0]}: ${values[1]}`;
        }

        return values[0] ?? "";
    }

    /*
    =================================================
    Markdown Table
    =================================================
    */

    parseMarkdownTable(lines) {
        const tableLines = lines.map(line => line.trim()).filter(line => line.startsWith("|"));

        if (tableLines.length < 2) {
            return [];
        }

        const headers = this.parseTableRow(tableLines[0]);

        const dataLines = tableLines.slice(1).filter(line => !this.isTableSeparator(line));

        return dataLines.map(line => {
            const cells = this.parseTableRow(line);

            const row = {};

            headers.forEach((header, index) => {
                row[header] = this.cleanText(cells[index] ?? "");
            });

            return row;
        });
    }

    parseTableRow(line) {
        return line
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map(cell => this.cleanText(cell));
    }

    isTableSeparator(line) {
        const cells = this.parseTableRow(line);

        return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
    }

    getTableValue(row, possibleHeaders) {
        for (const possibleHeader of possibleHeaders) {
            const normalizedHeader = this.normalizeTitle(possibleHeader);

            const key = Object.keys(row).find(
                currentKey => this.normalizeTitle(currentKey) === normalizedHeader
            );

            if (key) {
                return this.cleanText(row[key]);
            }
        }

        return "";
    }

    /*
    =================================================
    List Parsing
    =================================================
    */

    extractBulletItems(lines) {
        const result = [];

        for (const line of lines) {
            const match = String(line)
                .trim()
                .match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);

            if (!match) {
                continue;
            }

            const value = this.cleanText(match[1]);

            if (value) {
                result.push(value);
            }
        }

        return result;
    }

    isBulletLine(line) {
        return /^(?:[-*+]|\d+[.)])\s+/.test(String(line).trim());
    }

    isHorizontalRule(line) {
        return /^[-*_]{3,}$/.test(String(line).trim().replace(/\s+/g, ""));
    }

    /*
    =================================================
    Heading Classification
    =================================================
    */

    parseHeading(line) {
        const match = String(line).match(/^(#{1,6})\s+(.+?)\s*$/);

        if (!match) {
            return null;
        }

        return {
            level: match[1].length,
            title: this.cleanText(match[2])
        };
    }

    isGlobalSectionTitle(normalizedTitle) {
        return [
            "thông tin chung",
            "mục đích trang",
            "mục đích",
            "mô tả",
            "quyền truy cập",
            "phân quyền",
            "dữ liệu dùng chung",
            "thông tin dùng chung",
            "quan hệ dữ liệu",
            "mối quan hệ",
            "quan hệ",
            "purpose",
            "description",
            "permissions",
            "access rights",
            "common inputs",
            "shared data",
            "relationships"
        ].includes(normalizedTitle);
    }

    isFeatureSubsectionTitle(normalizedTitle) {
        return [
            "mô tả",
            "điều kiện tiên quyết",
            "tiền điều kiện",
            "điều kiện",
            "dữ liệu đầu vào",
            "input",
            "inputs",
            "input data",
            "luồng xử lý",
            "luồng chính",
            "các bước thực hiện",
            "quy tắc cơ bản",
            "quy tắc nghiệp vụ",
            "kết quả mong đợi",
            "kết quả",
            "trường hợp ngoại lệ",
            "ngoại lệ",
            "automation",
            "tự động hóa",
            "automation metadata",
            "description",
            "preconditions",
            "flow",
            "main flow",
            "basic rules",
            "business rules",
            "business rule",
            "expected results",
            "expected result",
            "exceptions",
            "exception"
        ].includes(normalizedTitle);
    }

    isFeatureContainerTitle(normalizedTitle) {
        return ["chức năng", "các chức năng", "danh sách chức năng", "features"].includes(
            normalizedTitle
        );
    }

    extractFeatureId(title) {
        const match = String(title).match(/^(?:chức năng\s*)?(\d+)\s*[.)\-:]?/i);

        return match ? match[1] : "";
    }

    normalizeFeatureName(title) {
        return this.cleanText(title)
            .replace(/^(?:chức năng|feature)\s*:\s*/i, "")
            .replace(/^(?:chức năng|feature)\s+/i, "")
            .replace(/^\d+\s*[.)\-:]?\s*/, "")
            .trim();
    }

    /*
    =================================================
    Unique Data
    =================================================
    */

    uniqueStrings(values) {
        const result = [];

        const seen = new Set();

        for (const rawValue of values) {
            const value = this.cleanText(rawValue);

            if (!value) {
                continue;
            }

            const key = value.toLowerCase();

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);

            result.push(value);
        }

        return result;
    }

    uniqueRuleObjects(values) {
        const result = [];

        const seen = new Set();

        for (const value of values) {
            const code = this.cleanText(value?.code ?? "");

            const content = this.cleanText(value?.content ?? value?.description ?? value ?? "");

            if (!content) {
                continue;
            }

            const key = content.toLowerCase();

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);

            result.push({
                code,
                content
            });
        }

        return result;
    }

    /*
    =================================================
    Utilities
    =================================================
    */

    normalizeTitle(value) {
        return this.cleanText(value)
            .replace(/^(?:chức năng|feature)\s*:\s*/i, "")
            .replace(/^\d+\s*[.)\-:]?\s*/, "")
            .replace(/:$/, "")
            .toLowerCase()
            .trim();
    }

    cleanText(value) {
        return String(value ?? "")
            .replace(/\*\*/g, "")
            .replace(/__/g, "")
            .replace(/`/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    toBoolean(value) {
        return ["có", "yes", "true", "1", "x", "bắt buộc"].includes(this.normalizeTitle(value));
    }
}
