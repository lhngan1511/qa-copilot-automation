import TestScenario from "../models/TestScenario.js";

class IntelligenceScenarioGenerator {
    constructor() {
        this.counter = 1;
    }

    generate(recommendedScenarios, requirement, knowledge = null) {
        if (!Array.isArray(recommendedScenarios)) {
            return [];
        }

        this.counter = 1;

        return recommendedScenarios
            .map(item => this.buildScenario(item, requirement, knowledge))
            .filter(Boolean);
    }

    buildScenario(item, requirement, knowledge) {
        if (!item) {
            return null;
        }

        const scenario = new TestScenario();

        scenario.id = `SC${String(this.counter++).padStart(3, "0")}`;

        scenario.module =
            this.getText(requirement?.feature) || this.getText(requirement?.module) || "";

        scenario.feature = this.extractFeature(requirement, item);

        scenario.title = this.buildTitle(item);

        if (!scenario.title) {
            return null;
        }

        scenario.testScenario = scenario.title;

        scenario.type = this.normalizeType(item?.type);

        scenario.priority = this.getText(item?.priority).toUpperCase() || "MEDIUM";

        scenario.reason = this.getText(item?.reason) || this.getText(item?.description) || "";

        scenario.riskCategory = this.getText(item?.riskCategory) || scenario.type;

        scenario.requirementReference =
            this.getText(item?.requirementReference) ||
            this.getText(item?.code) ||
            this.getText(item?.title) ||
            this.getText(item?.content) ||
            "";

        scenario.inputDefinitions = Array.isArray(requirement?.inputDefinitions)
            ? requirement.inputDefinitions
            : [];

        scenario.preconditions = this.buildPreconditions(requirement, scenario.feature);

        scenario.steps = this.generateSteps(scenario);

        scenario.expectedResults = this.generateExpectedResults(scenario);

        scenario.testData = null;

        scenario.severity = this.calculateSeverity(scenario.type);

        scenario.automationCandidate = true;

        scenario.automation = {
            candidate: true,
            framework: "Playwright",
            pageObject: "",
            locatorStrategy: "",
            locator: "",
            tags: [scenario.type.toLowerCase()]
        };

        if (knowledge) {
            scenario.intelligence = {
                confidence: knowledge.confidence || 0,
                validationRules: Array.isArray(knowledge.validationRules)
                    ? knowledge.validationRules
                    : [],
                boundaryCases: Array.isArray(knowledge.boundaryCases)
                    ? knowledge.boundaryCases
                    : [],
                negativeCases: Array.isArray(knowledge.negativeCases)
                    ? knowledge.negativeCases
                    : [],
                positiveCases: Array.isArray(knowledge.positiveCases) ? knowledge.positiveCases : []
            };
        }

        return scenario;
    }

    extractFeature(requirement, item) {
        const itemFeature = this.getText(item?.feature);

        if (itemFeature) {
            return itemFeature;
        }

        const itemFeatureName = this.getText(item?.featureName);

        if (itemFeatureName) {
            return itemFeatureName;
        }

        const sourceText = this.getText(item);

        const matchedFeature = requirement?.features?.find(feature => {
            const featureName = this.getText(feature?.name);

            if (!featureName || !sourceText) {
                return false;
            }

            return sourceText.toLowerCase().includes(featureName.toLowerCase());
        });

        if (matchedFeature) {
            return this.getText(matchedFeature.name);
        }

        if (Array.isArray(requirement?.actions) && requirement.actions.length > 0) {
            return this.getText(requirement.actions[0]);
        }

        return "Chức năng chưa xác định";
    }

    buildTitle(item) {
        let title =
            this.getText(item?.title) ||
            this.getText(item?.content) ||
            this.getText(item?.description) ||
            this.getText(item?.name) ||
            this.getText(item?.scenario) ||
            this.getText(item);

        if (!title) {
            return "";
        }

        title = title.replace(/^Kiểm tra chức năng\s*/i, "");
        title = title.replace(/^Kiểm tra\s*/i, "");

        return title.trim();
    }

    buildPreconditions(requirement, featureName) {
        const preconditions = [];

        if (Array.isArray(requirement?.permissions)) {
            requirement.permissions.forEach(permission => {
                const text = this.getText(permission);

                if (text && !preconditions.includes(text)) {
                    preconditions.push(text);
                }
            });
        }

        const matchedFeature = requirement?.features?.find(feature => {
            return (
                this.getText(feature?.name).toLowerCase() ===
                this.getText(featureName).toLowerCase()
            );
        });

        if (Array.isArray(matchedFeature?.preconditions)) {
            matchedFeature.preconditions.forEach(precondition => {
                const text = this.getText(precondition);

                if (text && !preconditions.includes(text)) {
                    preconditions.push(text);
                }
            });
        }

        if (preconditions.length === 0) {
            preconditions.push("Người dùng đã đăng nhập hệ thống");
        }

        return preconditions;
    }

    generateSteps(scenario) {
        return [
            {
                order: 1,
                actionType: "NAVIGATION",
                action: `Mở chức năng ${scenario.feature}`,
                expected: "Màn hình chức năng hiển thị"
            },
            {
                order: 2,
                actionType: "INPUT",
                action: "Nhập dữ liệu kiểm tra",
                expected: "Hệ thống tiếp nhận dữ liệu"
            },
            {
                order: 3,
                actionType: "CLICK",
                action: "Thực hiện thao tác lưu",
                expected: this.getProcessExpected(scenario.type)
            },
            {
                order: 4,
                actionType: "ASSERT",
                action: "Kiểm tra kết quả",
                expected: this.generateExpectedResults(scenario).join("; ")
            }
        ];
    }

    generateExpectedResults(scenario) {
        switch (scenario.type) {
            case "NEGATIVE":
                return ["Hệ thống không cho phép lưu dữ liệu", "Hiển thị thông báo lỗi phù hợp"];

            case "PERMISSION":
                return ["Hệ thống từ chối truy cập", "Hiển thị thông báo không có quyền"];

            case "DATA_INTEGRITY":
                return ["Dữ liệu không được tạo trùng", "Hệ thống bảo toàn dữ liệu"];

            case "BOUNDARY":
                return [
                    "Hệ thống xử lý đúng dữ liệu tại giá trị biên",
                    "Không phát sinh lỗi ngoài dự kiến"
                ];

            case "SECURITY":
                return [
                    "Hệ thống ngăn chặn thao tác không an toàn",
                    "Dữ liệu và quyền truy cập được bảo vệ"
                ];

            default:
                return ["Hệ thống xử lý thành công yêu cầu", "Dữ liệu được lưu và hiển thị đúng"];
        }
    }

    getProcessExpected(type) {
        if (["NEGATIVE", "DATA_INTEGRITY", "PERMISSION", "BOUNDARY", "SECURITY"].includes(type)) {
            return "Hệ thống thực hiện kiểm tra điều kiện nghiệp vụ";
        }

        return "Hệ thống thực hiện xử lý nghiệp vụ";
    }

    calculateSeverity(type) {
        if (["NEGATIVE", "PERMISSION", "DATA_INTEGRITY", "SECURITY"].includes(type)) {
            return "HIGH";
        }

        if (type === "BOUNDARY") {
            return "MEDIUM";
        }

        return "MEDIUM";
    }

    normalizeType(type) {
        const normalizedType = this.getText(type).trim().toUpperCase().replace(/\s+/g, "_");

        const supportedTypes = [
            "POSITIVE",
            "NEGATIVE",
            "PERMISSION",
            "DATA_INTEGRITY",
            "BOUNDARY",
            "SECURITY"
        ];

        if (supportedTypes.includes(normalizedType)) {
            return normalizedType;
        }

        return "POSITIVE";
    }

    getText(value) {
        if (typeof value === "string") {
            return value.trim();
        }

        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }

        if (!value || typeof value !== "object") {
            return "";
        }

        return String(
            value.title ??
                value.content ??
                value.description ??
                value.name ??
                value.scenario ??
                value.rule ??
                value.value ??
                ""
        ).trim();
    }
}

export default IntelligenceScenarioGenerator;
