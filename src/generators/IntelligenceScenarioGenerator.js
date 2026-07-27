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

        const scenarios = recommendedScenarios
            .map(item => this.buildScenario(item, requirement, knowledge))
            .filter(Boolean);

        return this.removeDuplicateScenarios(scenarios);
    }

    buildScenario(item, requirement, knowledge) {
        if (!item) {
            return null;
        }

        const scenario = new TestScenario();

        scenario.id = `SC${String(this.counter++).padStart(3, "0")}`;

        /*
        Module phải ưu tiên requirement.module.

        Không được ưu tiên requirement.feature vì feature
        thường là một chức năng con như "Thêm thiết bị".
        */

        scenario.module =
            this.getText(requirement?.module) ||
            this.extractModuleFromFeature(this.getText(requirement?.feature)) ||
            "";

        scenario.title = this.buildTitle(item);

        if (!scenario.title) {
            return null;
        }

        scenario.testScenario = scenario.title;

        scenario.feature = this.extractFeature(requirement, item, scenario.title);

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

        scenario.expectedResults = this.generateExpectedResults(scenario);

        scenario.steps = this.generateSteps(scenario);

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

    extractFeature(requirement, item, scenarioTitle = "") {
        const itemFeature = this.getText(item?.feature);

        if (itemFeature) {
            return itemFeature;
        }

        const itemFeatureName = this.getText(item?.featureName);

        if (itemFeatureName) {
            return itemFeatureName;
        }

        const sourceText = [
            scenarioTitle,
            this.getText(item),
            this.getText(item?.reason),
            this.getText(item?.description),
            this.getText(item?.requirementReference)
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        /*
        Ưu tiên match trực tiếp với danh sách feature
        đã được RequirementAnalysisEngine phân tích.
        */

        if (Array.isArray(requirement?.features)) {
            const matchedFeature = requirement.features.find(feature => {
                const featureName = this.getText(
                    feature?.name || feature?.feature || feature?.title
                );

                if (!featureName || !sourceText) {
                    return false;
                }

                return sourceText.includes(featureName.toLowerCase());
            });

            if (matchedFeature) {
                return this.getText(
                    matchedFeature?.name || matchedFeature?.feature || matchedFeature?.title
                );
            }
        }

        /*
        Suy luận feature dựa trên động từ nghiệp vụ
        có trong tiêu đề scenario.
        */

        const inferredFeature = this.inferFeatureFromText(sourceText, requirement);

        if (inferredFeature) {
            return inferredFeature;
        }

        /*
        Chỉ dùng requirement.feature khi requirement
        thực sự chỉ có một feature.
        */

        if (!Array.isArray(requirement?.features) || requirement.features.length <= 1) {
            const requirementFeature = this.getText(requirement?.feature);

            if (requirementFeature) {
                return requirementFeature;
            }
        }

        return "Chức năng chưa xác định";
    }

    inferFeatureFromText(sourceText, requirement) {
        if (!sourceText) {
            return "";
        }

        const moduleName =
            this.getText(requirement?.module) ||
            this.extractModuleFromFeature(this.getText(requirement?.feature)) ||
            "thiết bị";

        if (
            this.containsAny(sourceText, [
                "tìm kiếm",
                "tìm thiết bị",
                "tra cứu",
                "lọc dữ liệu",
                "kết quả tìm"
            ])
        ) {
            return `Tìm kiếm ${moduleName.toLowerCase()}`;
        }

        if (this.containsAny(sourceText, ["xóa", "xoá", "không được xóa", "không cho phép xóa"])) {
            return `Xóa ${moduleName.toLowerCase()}`;
        }

        if (
            this.containsAny(sourceText, [
                "cập nhật",
                "chỉnh sửa",
                "sửa thiết bị",
                "thay đổi thông tin"
            ])
        ) {
            return `Sửa ${moduleName.toLowerCase()}`;
        }

        if (
            this.containsAny(sourceText, [
                "thêm",
                "tạo mới",
                "mã thiết bị bị trùng",
                "mã thiết bị đã tồn tại",
                "dữ liệu hợp lệ"
            ])
        ) {
            return `Thêm ${moduleName.toLowerCase()}`;
        }

        return "";
    }

    extractModuleFromFeature(featureName) {
        const normalizedFeature = this.normalizeText(featureName);

        if (!normalizedFeature) {
            return "";
        }

        const moduleName = normalizedFeature.replace(
            /^(thêm|sửa|xóa|xoá|tìm kiếm|tìm|cập nhật|quản lý)\s+/i,
            ""
        );

        return moduleName.trim();
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

        return this.normalizeText(title);
    }

    buildPreconditions(requirement, featureName) {
        const preconditions = [];

        if (Array.isArray(requirement?.permissions)) {
            requirement.permissions.forEach(permission => {
                this.addUniqueText(preconditions, this.getText(permission));
            });
        }

        const matchedFeature = Array.isArray(requirement?.features)
            ? requirement.features.find(feature => {
                  const currentFeatureName = this.getText(
                      feature?.name || feature?.feature || feature?.title
                  );

                  return (
                      this.normalizeForComparison(currentFeatureName) ===
                      this.normalizeForComparison(featureName)
                  );
              })
            : null;

        if (Array.isArray(matchedFeature?.preconditions)) {
            matchedFeature.preconditions.forEach(precondition => {
                this.addUniqueText(preconditions, this.getText(precondition));
            });
        }

        if (preconditions.length === 0) {
            preconditions.push("Người dùng đã đăng nhập vào hệ thống");
        }

        return preconditions;
    }

    generateSteps(scenario) {
        const expectedResults = Array.isArray(scenario.expectedResults)
            ? scenario.expectedResults
            : [];

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

                action: `Chuẩn bị dữ liệu cho tình huống: ${scenario.title}`,

                expected: "Dữ liệu kiểm tra được chuẩn bị"
            },

            {
                order: 3,

                actionType: "ACTION",

                action: `Thực hiện ${scenario.feature}`,

                expected: this.getProcessExpected(scenario.type)
            },

            {
                order: 4,

                actionType: "ASSERT",

                action: "Kiểm tra kết quả thực tế",

                expected: expectedResults.join("; ")
            }
        ];
    }

    generateExpectedResults(scenario) {
        switch (scenario.type) {
            case "NEGATIVE":
                return [
                    "Hệ thống không chấp nhận dữ liệu hoặc thao tác không hợp lệ",
                    "Hiển thị thông báo phù hợp với điều kiện kiểm tra"
                ];

            case "PERMISSION":
                return [
                    "Hệ thống từ chối thao tác khi người dùng không có quyền",
                    "Hiển thị thông báo không có quyền phù hợp"
                ];

            case "DATA_INTEGRITY":
                return [
                    "Hệ thống bảo toàn tính toàn vẹn dữ liệu",
                    "Không tạo dữ liệu trùng hoặc dữ liệu không hợp lệ"
                ];

            case "BOUNDARY":
                return [
                    "Hệ thống xử lý đúng dữ liệu tại giá trị biên",
                    "Không phát sinh lỗi ngoài dự kiến"
                ];

            case "SECURITY":
                return [
                    "Hệ thống ngăn chặn dữ liệu hoặc thao tác không an toàn",
                    "Dữ liệu và quyền truy cập được bảo vệ"
                ];

            default:
                return [
                    "Hệ thống thực hiện thành công thao tác",
                    "Dữ liệu được cập nhật và hiển thị đúng"
                ];
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

    removeDuplicateScenarios(scenarios) {
        const uniqueScenarios = [];

        const scenarioKeys = new Set();

        scenarios.forEach(scenario => {
            const key = [
                this.normalizeForComparison(scenario.module),
                this.normalizeForComparison(scenario.feature),
                this.normalizeForComparison(scenario.title),
                this.normalizeForComparison(scenario.type)
            ].join("|");

            if (scenarioKeys.has(key)) {
                return;
            }

            scenarioKeys.add(key);

            uniqueScenarios.push(scenario);
        });

        /*
        Đánh lại ID sau khi loại bỏ scenario trùng.
        */

        uniqueScenarios.forEach((scenario, index) => {
            scenario.id = `SC${String(index + 1).padStart(3, "0")}`;
        });

        return uniqueScenarios;
    }

    addUniqueText(target, value) {
        if (!Array.isArray(target) || !value) {
            return;
        }

        const normalizedValue = this.normalizeForComparison(value);

        const alreadyExists = target.some(existingValue => {
            return this.normalizeForComparison(existingValue) === normalizedValue;
        });

        if (!alreadyExists) {
            target.push(this.normalizeText(value));
        }
    }

    containsAny(sourceText, keywords) {
        return keywords.some(keyword => sourceText.includes(keyword.toLowerCase()));
    }

    normalizeText(value) {
        if (typeof value !== "string") {
            return "";
        }

        return value.replace(/\s+/g, " ").trim();
    }

    normalizeForComparison(value) {
        return this.normalizeText(this.getText(value))
            .replace(/[.!?;:,]+$/g, "")
            .toLowerCase();
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
