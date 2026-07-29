import RecommendedScenario from "../models/RecommendedScenario.js";

class ScenarioRecommendationEngine {
    constructor() {
        this.counter = 1;
    }

    /*
    =================================================
     Generate Recommended Scenarios
    =================================================
    */

    generate(knowledge, requirement) {
        if (!knowledge) {
            return [];
        }

        this.counter = 1;

        const scenarios = [];

        if (
            knowledge.module &&
            Array.isArray(knowledge.functions) &&
            knowledge.functions.length > 0
        ) {
            this.generateFromStructuredFunctions(knowledge, scenarios, requirement);
            this.generateOwnedSuggestions(knowledge, scenarios, requirement);
            return this.removeDuplicateScenarios(scenarios);
        }

        this.generateFromList(
            knowledge.positiveCases,
            "POSITIVE",
            "MEDIUM",
            scenarios,
            requirement
        );

        this.generateFromList(knowledge.negativeCases, "NEGATIVE", "HIGH", scenarios, requirement);

        this.generateFromList(
            knowledge.boundaryCases,
            "BOUNDARY",
            "MEDIUM",
            scenarios,
            requirement
        );

        this.generateFromList(knowledge.securityCases, "SECURITY", "HIGH", scenarios, requirement);

        this.generateFromList(
            knowledge.permissionCases,
            "PERMISSION",
            "HIGH",
            scenarios,
            requirement
        );

        this.generateFromList(
            knowledge.dataIntegrityCases,
            "DATA_INTEGRITY",
            "HIGH",
            scenarios,
            requirement
        );

        return this.removeDuplicateScenarios(scenarios);
    }

    generateFromStructuredFunctions(knowledge, scenarios, requirement) {
        const moduleName = this.getText(knowledge.module?.name);
        const moduleId = this.getText(knowledge.module?.id);

        knowledge.functions.forEach(functionKnowledge => {
            const functionName = this.getText(functionKnowledge?.name);
            const functionId = this.getText(functionKnowledge?.id);

            if (!functionName || !functionId) {
                return;
            }

            const reviewedFunction = this.findReviewedFunction(requirement, functionKnowledge);
            const context = {
                module: moduleName,
                moduleId,
                feature: functionName,
                functionId,
                functionName,
                preconditions: this.getArray(functionKnowledge.preconditions),
                inputDefinitions: this.getArray(reviewedFunction?.inputs),
                requirementReferences: this.getArray(functionKnowledge.requirementReferences),
                source: knowledge.source || "Approved Module Artifact"
            };
            const permissionRules = this.uniqueRules([
                ...this.getArray(functionKnowledge.permissions),
                ...this.filterRules(functionKnowledge.businessRules, value =>
                    this.hasPermissionEvidence(value)
                )
            ]);
            const businessRules = this.filterRules(
                functionKnowledge.businessRules,
                value => !this.hasPermissionEvidence(value)
            );
            const requiredValidations = this.filterRules(functionKnowledge.validationRules, value =>
                /không được để trống|bỏ trống|required/i.test(value)
            );
            const valueValidations = this.filterRules(
                functionKnowledge.validationRules,
                value => !/không được để trống|bỏ trống|required/i.test(value)
            );
            const candidates = [
                {
                    ...context,
                    title: functionName,
                    type: "POSITIVE",
                    priority: "MEDIUM",
                    reason: functionKnowledge.description || "Approved business function",
                    description: functionKnowledge.description || "",
                    expectedResults: this.resolvePositiveExpectedResults(
                        reviewedFunction,
                        functionKnowledge,
                        functionName
                    ),
                    coveredRules: context.requirementReferences
                },
                this.buildGroupedCandidate(
                    businessRules,
                    context,
                    "DATA_INTEGRITY",
                    "HIGH",
                    `Kiểm tra quy tắc nghiệp vụ của ${functionName}`,
                    "BUSINESS_RULE"
                ),
                this.buildGroupedCandidate(
                    requiredValidations,
                    context,
                    "NEGATIVE",
                    "HIGH",
                    `Kiểm tra các trường bắt buộc của ${functionName}`,
                    "REQUIRED_VALIDATION"
                ),
                this.buildGroupedCandidate(
                    valueValidations,
                    context,
                    "NEGATIVE",
                    "HIGH",
                    `Kiểm tra định dạng hoặc giá trị không hợp lệ của ${functionName}`,
                    "FORMAT_OR_VALUE_VALIDATION"
                ),
                this.buildGroupedCandidate(
                    permissionRules,
                    context,
                    "PERMISSION",
                    "HIGH",
                    `Kiểm tra quyền thực hiện ${functionName}`,
                    "PERMISSION"
                ),
                this.buildGroupedCandidate(
                    this.filterConcreteBoundaries(functionKnowledge.boundaries),
                    context,
                    "BOUNDARY",
                    "MEDIUM",
                    `Kiểm tra điều kiện biên của ${functionName}`,
                    "BOUNDARY"
                ),
                this.buildGroupedCandidate(
                    functionKnowledge.exceptions,
                    context,
                    "EXCEPTION",
                    "HIGH",
                    `Kiểm tra ngoại lệ của ${functionName}`,
                    "EXCEPTION"
                ),
                this.buildGroupedCandidate(
                    this.filterTestableRisks(functionKnowledge.risks),
                    context,
                    "RISK",
                    "HIGH",
                    `Kiểm tra rủi ro của ${functionName}`,
                    "RISK"
                )
            ].filter(Boolean);

            candidates.forEach(candidate => {
                this.generateFromList(
                    [candidate],
                    candidate.type,
                    candidate.priority,
                    scenarios,
                    requirement
                );
            });
        });
    }

    buildGroupedCandidate(values, context, type, priority, title, groupType = type) {
        const contents = Array.isArray(values)
            ? values
                  .filter(value => typeof value === "string" && value.trim())
                  .map(value => value.trim())
            : [];
        if (contents.length === 0) return null;
        return {
            ...context,
            title,
            type,
            priority,
            reason: `${type} from approved function`,
            description: contents.join("; "),
            expectedResults: contents,
            coveredRules: contents,
            sourceItems: contents.map(content => ({
                content,
                source: groupType
            })),
            groupType,
            riskReason: type === "RISK" ? contents.join("; ") : ""
        };
    }

    filterRules(values, predicate) {
        return (Array.isArray(values) ? values : [])
            .filter(value => typeof value === "string" && value.trim())
            .filter(value => predicate(value.trim()));
    }

    filterConcreteBoundaries(values) {
        return (Array.isArray(values) ? values : []).filter(value => {
            if (typeof value !== "string") return false;
            const hasNumericLimit =
                /\d/.test(value) &&
                /tối đa|tối thiểu|min|max|giới hạn|độ dài|ký tự|số lượng|không quá|ít nhất|nhiều nhất/i.test(
                    value
                );
            const hasExplicitRelationship =
                /(?:<=|>=|<|>)|(?:nhỏ hơn|lớn hơn|trước|sau).*(?:hoặc bằng|bằng)|(?:ngày bắt đầu|startDate).*(?:ngày kết thúc|endDate)/i.test(
                    value
                );
            return hasNumericLimit || hasExplicitRelationship;
        });
    }

    hasPermissionEvidence(value) {
        return /(?:quyền|permission|role|vai trò|nhóm người dùng|được phép|không được phép|allow|deny|unauthorized)/i.test(
            String(value ?? "")
        );
    }

    uniqueRules(values) {
        const seen = new Set();
        return values.filter(value => {
            if (typeof value !== "string" || !value.trim()) return false;
            const key = this.normalizeForComparison(value).replace(/^(?:br|vr|pr)\s*\d+\s*/i, "");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    findReviewedFunction(requirement, functionKnowledge) {
        return this.getArray(requirement?.features).find(feature => {
            if (!feature || typeof feature !== "object") return false;
            return (
                this.normalizeForComparison(feature.id) ===
                    this.normalizeForComparison(functionKnowledge.id) ||
                this.normalizeForComparison(feature.name ?? feature.feature ?? feature.title) ===
                    this.normalizeForComparison(functionKnowledge.name)
            );
        });
    }

    resolvePositiveExpectedResults(reviewedFunction, functionKnowledge, functionName) {
        const reviewedResults = this.getArray(reviewedFunction?.expectedResults).filter(
            value => typeof value === "string" && value.trim()
        );
        if (reviewedResults.length > 0) return reviewedResults;

        const description = this.getText(functionKnowledge.description);
        if (description) return [description];

        return [`Kết quả của ${functionName} được hiển thị theo requirement đã duyệt`];
    }

    filterTestableRisks(values) {
        return (Array.isArray(values) ? values : []).filter(value =>
            /lỗi|mất|trùng|xung đột|đồng thời|chậm|hiệu năng|quyền|không thể|thất bại/i.test(value)
        );
    }

    generateOwnedSuggestions(knowledge, scenarios, requirement) {
        if (!Array.isArray(knowledge.suggestedScenarios)) {
            return;
        }

        knowledge.suggestedScenarios.forEach(item => {
            if (!item || typeof item !== "object") {
                return;
            }

            const owner = knowledge.functions.find(
                functionKnowledge =>
                    (item.functionId && item.functionId === functionKnowledge.id) ||
                    this.normalizeForComparison(item.feature ?? item.function) ===
                        this.normalizeForComparison(functionKnowledge.name)
            );

            if (!owner) {
                return;
            }

            this.generateFromList(
                [
                    {
                        ...item,
                        module: knowledge.module.name,
                        moduleId: knowledge.module.id,
                        feature: owner.name,
                        functionId: owner.id,
                        functionName: owner.name
                    }
                ],
                "POSITIVE",
                "MEDIUM",
                scenarios,
                requirement
            );
        });
    }

    /*
    =================================================
     Generate Scenarios From Knowledge List
    =================================================
    */

    generateFromList(list, defaultType, defaultPriority, scenarios, requirement) {
        if (!Array.isArray(list) || list.length === 0) {
            return;
        }

        list.forEach(item => {
            const title = this.getScenarioTitle(item);

            if (!title) {
                return;
            }

            const feature = this.extractFeature(item, requirement);

            const type = this.getText(item?.type) || defaultType;

            const priority = this.getText(item?.priority) || defaultPriority;

            const scenario = new RecommendedScenario({
                id: `SC${String(this.counter++).padStart(3, "0")}`,

                title,

                /*
                    Module ưu tiên dữ liệu của item.

                    Nếu item chưa có module thì lấy
                    module của RequirementObject.
                    */

                module:
                    this.getText(item?.module) ||
                    this.getText(requirement?.module) ||
                    this.extractModuleFromFeature(this.getText(requirement?.feature)),

                /*
                    Feature được xác định theo từng
                    tình huống nghiệp vụ.

                    Không lấy cố định actions[0].
                    */

                feature,

                moduleId: this.getText(item?.moduleId),

                functionId: this.getText(item?.functionId),

                functionName:
                    this.getText(item?.functionName) || this.getText(item?.function) || feature,

                testScenario: this.getText(item?.testScenario) || title,

                type,

                priority,

                severity: this.getText(item?.severity) || priority,

                reason: this.getText(item?.reason) || `${type} risk detected`,

                description: this.getText(item?.description),

                source: this.getText(item?.source) || "Requirement Intelligence",

                requirementReference:
                    this.getText(item?.requirementReference) || this.getText(item?.code) || title,

                requirementReferences:
                    this.getArray(item?.requirementReferences).length > 0
                        ? this.getArray(item?.requirementReferences)
                        : [
                              this.getText(item?.requirementReference) ||
                                  this.getText(item?.code) ||
                                  title
                          ],

                coveredRules: this.getArray(item?.coveredRules),

                sourceItems: this.getArray(item?.sourceItems),

                riskReason: this.getText(item?.riskReason),

                riskCategory: this.getText(item?.riskCategory) || type,

                /*
                    Điều kiện và dữ liệu đầu vào
                    */

                preconditions: this.getArray(item?.preconditions),

                inputDefinitions: this.getArray(item?.inputDefinitions),

                testData: this.getTestData(item?.testData),

                /*
                    Luồng thao tác
                    */

                steps: this.getArray(item?.steps),

                /*
                    Kết quả nghiệp vụ tổng hợp
                    */

                expectedResult: this.getText(item?.expectedResult),

                /*
                    Danh sách kết quả chi tiết.

                    Giữ lại để tương thích với các
                    generator và exporter cũ.
                    */

                expectedResults: this.getArray(item?.expectedResults),

                /*
                    Assertion phục vụ automation.
                    */

                assertions: this.getArray(item?.assertions),

                automationCandidate: item?.automationCandidate !== false
            });

            scenarios.push(scenario);
        });
    }

    /*
    =================================================
     Feature Resolution
    =================================================
    */

    extractFeature(item, requirement) {
        /*
        Nếu Analyzer hoặc AI đã trả feature rõ ràng,
        ưu tiên sử dụng trực tiếp.
        */

        const itemFeature = this.getText(item?.feature) || this.getText(item?.featureName);

        if (itemFeature) {
            return itemFeature;
        }

        /*
        Ghép toàn bộ nội dung có thể dùng để
        xác định feature.
        */

        const sourceText = [
            this.getText(item),

            this.getText(item?.title),

            this.getText(item?.content),

            this.getText(item?.description),

            this.getText(item?.reason),

            this.getText(item?.requirementReference)
        ]
            .filter(Boolean)
            .join(" ");

        /*
        Ưu tiên đối chiếu với danh sách feature
        parser đã phân tích từ requirement.
        */

        const matchedFeature = this.matchRequirementFeature(sourceText, requirement);

        if (matchedFeature) {
            return matchedFeature;
        }

        /*
        Nếu chưa match được thì suy luận dựa
        trên từ khóa nghiệp vụ.
        */

        const inferredFeature = this.inferFeatureFromText(sourceText, requirement);

        if (inferredFeature) {
            return inferredFeature;
        }

        /*
        Chỉ dùng requirement.feature khi requirement
        thực sự có duy nhất một feature.
        */

        const requirementFeatures = this.getRequirementFeatures(requirement);

        if (requirementFeatures.length === 1) {
            return requirementFeatures[0];
        }

        return "Chức năng chưa xác định";
    }

    /*
    =================================================
     Match Feature With Requirement
    =================================================
    */

    matchRequirementFeature(text, requirement) {
        const normalizedText = this.normalizeForComparison(text);

        if (!normalizedText) {
            return "";
        }

        const features = this.getRequirementFeatures(requirement);

        /*
        Ưu tiên tên feature dài hơn.

        Ví dụ:
        "Tìm kiếm thiết bị" phải xét trước
        "Thiết bị".
        */

        const sortedFeatures = [...features].sort(
            (firstFeature, secondFeature) => secondFeature.length - firstFeature.length
        );

        return (
            sortedFeatures.find(feature => {
                const normalizedFeature = this.normalizeForComparison(feature);

                return normalizedFeature && normalizedText.includes(normalizedFeature);
            }) || ""
        );
    }

    /*
    =================================================
     Requirement Feature Collection
    =================================================
    */

    getRequirementFeatures(requirement) {
        const features = [];

        if (Array.isArray(requirement?.features)) {
            requirement.features.forEach(feature => {
                const featureName =
                    this.getText(feature?.name) ||
                    this.getText(feature?.feature) ||
                    this.getText(feature?.title) ||
                    this.getText(feature);

                this.addUnique(features, featureName);
            });
        }

        /*
        Tương thích một số RequirementObject cũ
        lưu chức năng trong actions.
        */

        if (Array.isArray(requirement?.actions)) {
            requirement.actions.forEach(action => {
                const actionName = this.getText(action);

                if (this.isBusinessFeature(actionName)) {
                    this.addUnique(features, actionName);
                }
            });
        }

        /*
        Fallback cho cấu trúc requirement cũ.
        */

        if (features.length === 0) {
            this.addUnique(features, this.getText(requirement?.feature));
        }

        return features;
    }

    /*
    =================================================
     Infer Feature From Text
    =================================================
    */

    inferFeatureFromText(text, requirement) {
        const normalizedText = this.normalizeForComparison(text);

        if (!normalizedText) {
            return "";
        }

        const moduleName =
            this.getText(requirement?.module) ||
            this.extractModuleFromFeature(this.getText(requirement?.feature)) ||
            "đối tượng";

        const normalizedModule = moduleName.toLowerCase();

        /*
        Tìm kiếm phải được kiểm tra trước các
        từ khóa khác để tránh suy luận sai.
        */

        if (
            this.containsAny(normalizedText, [
                "tìm kiếm",
                "tra cứu",
                "tìm theo",
                "lọc dữ liệu",
                "kết quả tìm",
                "không tìm thấy"
            ])
        ) {
            return `Tìm kiếm ${normalizedModule}`;
        }

        if (
            this.containsAny(normalizedText, [
                "xóa",
                "xoá",
                "không được xóa",
                "không được xoá",
                "không cho phép xóa",
                "không cho phép xoá",
                "xóa thành công",
                "xoá thành công",
                "đã được sử dụng"
            ])
        ) {
            return `Xóa ${normalizedModule}`;
        }

        if (
            this.containsAny(normalizedText, [
                "sửa",
                "cập nhật",
                "chỉnh sửa",
                "thay đổi thông tin",
                "lưu thay đổi"
            ])
        ) {
            return `Sửa ${normalizedModule}`;
        }

        if (
            this.containsAny(normalizedText, [
                "thêm",
                "tạo mới",
                "khởi tạo",
                "mã bị trùng",
                "mã đã tồn tại",
                "thêm thành công"
            ])
        ) {
            return `Thêm ${normalizedModule}`;
        }

        return "";
    }

    /*
    =================================================
     Business Feature Detection
    =================================================
    */

    isBusinessFeature(value) {
        const normalizedValue = this.normalizeForComparison(value);

        return this.containsAny(normalizedValue, [
            "thêm",
            "tạo mới",
            "sửa",
            "cập nhật",
            "chỉnh sửa",
            "xóa",
            "xoá",
            "tìm kiếm",
            "tra cứu"
        ]);
    }

    /*
    =================================================
     Remove Duplicate Scenarios
    =================================================
    */

    removeDuplicateScenarios(scenarios) {
        const uniqueScenarios = [];

        const keys = new Set();

        scenarios.forEach(scenario => {
            const key = [
                this.normalizeForComparison(scenario.moduleId),

                this.normalizeForComparison(scenario.functionId),

                this.normalizeForComparison(scenario.module),

                this.normalizeForComparison(scenario.feature),

                this.normalizeForComparison(scenario.title),

                this.normalizeForComparison(scenario.type)
            ].join("|");

            if (keys.has(key)) {
                return;
            }

            keys.add(key);

            uniqueScenarios.push(scenario);
        });

        /*
        Đánh lại ID sau khi loại trùng để ID
        liên tục: SC001, SC002, SC003...
        */

        uniqueScenarios.forEach((scenario, index) => {
            scenario.id = `SC${String(index + 1).padStart(3, "0")}`;
        });

        return uniqueScenarios;
    }

    /*
    =================================================
     Scenario Title
    =================================================
    */

    getScenarioTitle(item) {
        if (typeof item === "string") {
            return this.normalizeText(item);
        }

        if (!item || typeof item !== "object") {
            return "";
        }

        return this.normalizeText(
            String(
                item?.title ??
                    item?.testScenario ??
                    item?.scenario ??
                    item?.content ??
                    item?.description ??
                    item?.name ??
                    item?.rule ??
                    ""
            )
        );
    }

    /*
    =================================================
     Module Utilities
    =================================================
    */

    extractModuleFromFeature(featureName) {
        return this.normalizeText(featureName)
            .replace(/^(thêm|sửa|xóa|xoá|tìm kiếm|tìm|cập nhật|chỉnh sửa|quản lý)\s+/i, "")
            .trim();
    }

    /*
    =================================================
     Array / Object Utilities
    =================================================
    */

    getArray(value) {
        return Array.isArray(value) ? value : [];
    }

    getTestData(value) {
        if (value && typeof value === "object") {
            return value;
        }

        return null;
    }

    /*
    =================================================
     Collection Utilities
    =================================================
    */

    addUnique(target, value) {
        if (!Array.isArray(target)) {
            return;
        }

        const normalizedValue = this.normalizeText(value);

        if (!normalizedValue) {
            return;
        }

        const exists = target.some(existingValue => {
            return (
                this.normalizeForComparison(existingValue) ===
                this.normalizeForComparison(normalizedValue)
            );
        });

        if (!exists) {
            target.push(normalizedValue);
        }
    }

    containsAny(sourceText, keywords) {
        if (!sourceText || !Array.isArray(keywords)) {
            return false;
        }

        return keywords.some(keyword => {
            return sourceText.includes(keyword.toLowerCase());
        });
    }

    /*
    =================================================
     Text Utilities
    =================================================
    */

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
            value?.title ??
                value?.content ??
                value?.description ??
                value?.name ??
                value?.feature ??
                value?.featureName ??
                value?.testScenario ??
                value?.scenario ??
                value?.rule ??
                value?.value ??
                value?.code ??
                ""
        ).trim();
    }
}

export default ScenarioRecommendationEngine;
