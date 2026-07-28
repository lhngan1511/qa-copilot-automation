import AIAnalysisResult from "../models/AIAnalysisResult.js";
import ClarificationQuestion from "../models/ClarificationQuestion.js";
import AIProviderFactory from "../providers/AIProviderFactory.js";
import AIConfig from "../config/AIConfig.js";
import RequirementAnalysisPromptBuilder from "../prompts/RequirementAnalysisPromptBuilder.js";

class AIAnalysisEngine {
    constructor(aiProvider = null, options = {}) {
        this.aiProvider = aiProvider || AIProviderFactory.create();
        this.promptBuilder =
            options.promptBuilder || new RequirementAnalysisPromptBuilder();
    }

    async analyze(requirement) {
        try {
            const prompt = this.buildPrompt(requirement);

            const aiResponse = await this.aiProvider.generate(prompt);

            const parsedResult = this.parseAIResponse(aiResponse);

            if (!this.isUsableAIResult(parsedResult, requirement)) {
                throw new Error("AI response does not contain usable scenarios");
            }

            const result = this.buildAnalysisResult(parsedResult, requirement);

            this.assignAnalysisMetadata(result, {
                analysisStatus: "SUCCESS",
                analysisSource: this.getProviderName(),
                analysisError: ""
            });

            console.log("AI Analysis Status: SUCCESS");

            return result;
        } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            const result = this.fallbackAnalysis(requirement);

            this.assignAnalysisMetadata(result, {
                analysisStatus: "FALLBACK",
                analysisSource: "rule-engine",
                analysisError: errorMessage
            });

            console.error("AI Analysis failed:", errorMessage);
            console.log("AI Analysis Status: FALLBACK");

            return result;
        }
    }

    buildAnalysisResult(parsedResult, requirement) {
        const result = new AIAnalysisResult();
        result.requirementComplete = parsedResult?.requirementComplete === true;
        result.featureUnderstanding =
            this.getText(parsedResult?.featureUnderstanding) ||
            this.getText(requirement?.module) ||
            this.getText(requirement?.feature);

        result.testFocus = this.normalizeTextArray(parsedResult?.testFocus);

        result.riskAreas = this.normalizeTextArray(parsedResult?.riskAreas);

        result.suggestedScenarios = this.normalizeSuggestedScenarios(
            parsedResult?.suggestedScenarios,
            requirement
        );

        result.questions = this.normalizeClarificationQuestions(parsedResult?.questions);

        result.notes = this.normalizeTextArray(parsedResult?.notes);

        result.confidence = this.normalizeConfidence(parsedResult?.confidence);

        /*
        Nếu AI trả JSON hợp lệ nhưng không có scenario,
        sử dụng fallback scenario thay vì trả mảng rỗng.
        */
        if (result.suggestedScenarios.length === 0) {
            result.suggestedScenarios = this.buildFallbackScenarios(requirement);
        }

        return result;
    }

    buildPrompt(requirement) {
        return this.promptBuilder.build(requirement);
    }

    buildRequirementContext(requirement) {
        return {
            module:
                this.getText(requirement?.module) ||
                this.extractModuleFromFeature(this.getText(requirement?.feature)),

            feature: this.getText(requirement?.feature),

            purpose: this.getText(requirement?.purpose) || this.getText(requirement?.pagePurpose),

            features: this.normalizeFeatures(requirement?.features),

            permissions: this.normalizeTextArray(requirement?.permissions),

            businessRules: this.normalizeContextArray(requirement?.businessRules),

            edgeCases: this.normalizeContextArray(requirement?.edgeCases),

            exceptions: this.normalizeContextArray(requirement?.exceptions),

            inputDefinitions: Array.isArray(requirement?.inputDefinitions)
                ? requirement.inputDefinitions
                : [],

            commonInputs: Array.isArray(requirement?.commonInputs) ? requirement.commonInputs : [],

            questions: this.normalizeTextArray(requirement?.questions),

            notes: this.normalizeTextArray(requirement?.notes)
        };
    }

    normalizeFeatures(features) {
        if (!Array.isArray(features)) {
            return [];
        }

        return features
            .map(feature => {
                if (typeof feature === "string") {
                    return {
                        name: feature
                    };
                }

                if (!feature || typeof feature !== "object") {
                    return null;
                }

                return {
                    name:
                        this.getText(feature?.name) ||
                        this.getText(feature?.feature) ||
                        this.getText(feature?.title),

                    purpose: this.getText(feature?.purpose) || this.getText(feature?.description),

                    preconditions: this.normalizeTextArray(feature?.preconditions),

                    businessRules: this.normalizeContextArray(feature?.businessRules),

                    edgeCases: this.normalizeContextArray(feature?.edgeCases),

                    inputDefinitions: Array.isArray(feature?.inputDefinitions)
                        ? feature.inputDefinitions
                        : []
                };
            })
            .filter(feature => feature?.name);
    }

    parseAIResponse(response) {
        try {
            if (typeof response !== "string") {
                if (response && typeof response === "object") {
                    return response;
                }

                return {};
            }

            let json = response.trim();

            json = json
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();

            /*
            Trường hợp AI vẫn trả thêm văn bản,
            lấy phần từ dấu { đầu tiên đến dấu } cuối cùng.
            */
            const firstBraceIndex = json.indexOf("{");
            const lastBraceIndex = json.lastIndexOf("}");

            if (
                firstBraceIndex !== -1 &&
                lastBraceIndex !== -1 &&
                lastBraceIndex > firstBraceIndex
            ) {
                json = json.slice(firstBraceIndex, lastBraceIndex + 1);
            }

            return JSON.parse(json);
        } catch (error) {
            throw new Error(`Invalid AI JSON response: ${this.getErrorMessage(error)}`, {
                cause: error
            });
        }
    }

    isUsableAIResult(parsedResult, requirement) {
        if (!parsedResult || typeof parsedResult !== "object" || Array.isArray(parsedResult)) {
            return false;
        }

        return (
            this.normalizeSuggestedScenarios(parsedResult.suggestedScenarios, requirement).length >
            0
        );
    }

    assignAnalysisMetadata(result, metadata) {
        if (!result || typeof result !== "object") {
            return;
        }

        result.analysisStatus = metadata.analysisStatus;
        result.analysisSource = metadata.analysisSource;
        result.analysisError = metadata.analysisError;
    }

    getProviderName() {
        const successfulProvider = this.normalizeText(
            this.aiProvider?.lastSuccessfulProviderName
        ).toLowerCase();

        if (successfulProvider) {
            return successfulProvider;
        }

        const configuredProvider = this.normalizeText(AIConfig.provider);

        if (configuredProvider) {
            return configuredProvider.toLowerCase();
        }

        return String(this.aiProvider?.constructor?.name || "unknown")
            .replace(/Provider$/i, "")
            .toLowerCase();
    }

    getErrorMessage(error) {
        const message = typeof error === "string" ? error : error?.message;

        const normalizedMessage = this.normalizeText(message) || "Unknown AI analysis error";

        return normalizedMessage.length > 200
            ? `${normalizedMessage.slice(0, 197)}...`
            : normalizedMessage;
    }

    normalizeSuggestedScenarios(suggestedScenarios, requirement) {
        if (!Array.isArray(suggestedScenarios)) {
            return [];
        }

        return suggestedScenarios
            .map(item => {
                /*
                Hỗ trợ tạm response kiểu string,
                nhưng chuyển ngay sang object chuẩn.
                */
                if (typeof item === "string") {
                    return {
                        feature: this.inferFeatureFromText(item, requirement),

                        title: this.normalizeText(item),

                        type: this.inferScenarioType(item),

                        priority: "MEDIUM",

                        reason: "",

                        riskCategory: "FUNCTIONAL",

                        requirementReference: item
                    };
                }

                if (!item || typeof item !== "object") {
                    return null;
                }

                const title =
                    this.getText(item?.title) ||
                    this.getText(item?.content) ||
                    this.getText(item?.description) ||
                    this.getText(item?.scenario) ||
                    this.getText(item?.name);

                if (!title) {
                    return null;
                }

                const feature =
                    this.getText(item?.feature) ||
                    this.getText(item?.featureName) ||
                    this.inferFeatureFromText(title, requirement);

                return {
                    ...item,

                    feature: feature || "Chức năng chưa xác định",

                    title: this.normalizeText(title),

                    type: this.normalizeScenarioType(item?.type, title),

                    priority: this.normalizePriority(item?.priority),

                    reason: this.getText(item?.reason) || this.getText(item?.description),

                    riskCategory:
                        this.getText(item?.riskCategory) ||
                        this.normalizeScenarioType(item?.type, title),

                    requirementReference:
                        this.getText(item?.requirementReference) ||
                        this.getText(item?.code) ||
                        title
                };
            })
            .filter(Boolean);
    }

    fallbackAnalysis(requirement) {
        const result = new AIAnalysisResult();
        result.requirementComplete = false;
        result.featureUnderstanding =
            this.getText(requirement?.module) || this.getText(requirement?.feature);

        result.testFocus = [
            ...this.normalizeContextArray(requirement?.businessRules),
            ...this.normalizeContextArray(requirement?.edgeCases),
            ...this.normalizeContextArray(requirement?.exceptions)
        ];

        result.riskAreas = [...result.testFocus];

        result.suggestedScenarios = this.buildFallbackScenarios(requirement);

        result.questions = this.normalizeClarificationQuestions(requirement?.questions);

        result.notes = this.normalizeTextArray(requirement?.notes);

        result.confidence = 0.5;

        return result;
    }

    buildFallbackScenarios(requirement) {
        const features = this.getRequirementFeatures(requirement);

        const scenarios = [];

        features.forEach(featureName => {
            scenarios.push({
                feature: featureName,

                title: `${featureName} thành công`,

                type: "POSITIVE",

                priority: "HIGH",

                reason: "Kiểm tra luồng nghiệp vụ chính hoạt động đúng",

                riskCategory: "FUNCTIONAL",

                requirementReference: featureName
            });
        });

        this.normalizeContextArray(requirement?.businessRules).forEach(rule => {
            const feature = this.inferFeatureFromText(rule, requirement);

            scenarios.push({
                feature,

                title: rule,

                type: "DATA_INTEGRITY",

                priority: "HIGH",

                reason: "Kiểm tra quy tắc nghiệp vụ và tính toàn vẹn dữ liệu",

                riskCategory: "DATA_INTEGRITY",

                requirementReference: rule
            });
        });

        this.normalizeContextArray(requirement?.edgeCases).forEach(edgeCase => {
            const feature = this.inferFeatureFromText(edgeCase, requirement);

            scenarios.push({
                feature,

                title: edgeCase,

                type: "NEGATIVE",

                priority: "HIGH",

                reason: "Kiểm tra trường hợp ngoại lệ hoặc dữ liệu không hợp lệ",

                riskCategory: "NEGATIVE",

                requirementReference: edgeCase
            });
        });

        return scenarios;
    }

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

        if (features.length === 0) {
            this.addUnique(features, this.getText(requirement?.feature));
        }

        return features;
    }

    inferFeatureFromText(text, requirement) {
        const normalizedText = this.normalizeForComparison(text);

        const requirementFeatures = this.getRequirementFeatures(requirement);

        /*
        Ưu tiên match đúng tên feature đã phân tích.
        */
        const matchedFeature = requirementFeatures.find(feature => {
            return normalizedText.includes(this.normalizeForComparison(feature));
        });

        if (matchedFeature) {
            return matchedFeature;
        }

        const moduleName =
            this.getText(requirement?.module) ||
            this.extractModuleFromFeature(this.getText(requirement?.feature)) ||
            "đối tượng";

        if (this.containsAny(normalizedText, ["tìm kiếm", "tra cứu", "lọc", "kết quả tìm"])) {
            return `Tìm kiếm ${moduleName.toLowerCase()}`;
        }

        if (
            this.containsAny(normalizedText, ["xóa", "xoá", "không được xóa", "không cho phép xóa"])
        ) {
            return `Xóa ${moduleName.toLowerCase()}`;
        }

        if (
            this.containsAny(normalizedText, ["sửa", "cập nhật", "chỉnh sửa", "thay đổi thông tin"])
        ) {
            return `Sửa ${moduleName.toLowerCase()}`;
        }

        if (this.containsAny(normalizedText, ["thêm", "tạo mới", "trùng", "đã tồn tại"])) {
            return `Thêm ${moduleName.toLowerCase()}`;
        }

        if (requirementFeatures.length === 1) {
            return requirementFeatures[0];
        }

        return "Chức năng chưa xác định";
    }

    inferScenarioType(text) {
        const normalizedText = this.normalizeForComparison(text);

        if (this.containsAny(normalizedText, ["không có quyền", "không được phép", "phân quyền"])) {
            return "PERMISSION";
        }

        if (this.containsAny(normalizedText, ["biên", "tối đa", "tối thiểu", "độ dài"])) {
            return "BOUNDARY";
        }

        if (this.containsAny(normalizedText, ["trùng", "duy nhất", "toàn vẹn"])) {
            return "DATA_INTEGRITY";
        }

        if (this.containsAny(normalizedText, ["không", "thiếu", "trống", "không hợp lệ", "lỗi"])) {
            return "NEGATIVE";
        }

        return "POSITIVE";
    }

    normalizeScenarioType(type, title = "") {
        const normalizedType = this.getText(type).toUpperCase().replace(/\s+/g, "_");

        const typeMapping = {
            VALIDATION: "NEGATIVE",
            BUSINESS_RULE: "DATA_INTEGRITY",
            BUSINESSRULE: "DATA_INTEGRITY",
            AUTHORIZATION: "PERMISSION",
            ACCESS_CONTROL: "PERMISSION",
            EDGE_CASE: "BOUNDARY"
        };

        const mappedType = typeMapping[normalizedType] || normalizedType;

        const supportedTypes = [
            "POSITIVE",
            "NEGATIVE",
            "PERMISSION",
            "DATA_INTEGRITY",
            "BOUNDARY",
            "SECURITY"
        ];

        if (supportedTypes.includes(mappedType)) {
            return mappedType;
        }

        return this.inferScenarioType(title);
    }

    normalizePriority(priority) {
        const normalizedPriority = this.getText(priority).toUpperCase();

        if (["HIGH", "MEDIUM", "LOW"].includes(normalizedPriority)) {
            return normalizedPriority;
        }

        return "MEDIUM";
    }

    normalizeConfidence(confidence) {
        const numericConfidence = Number(confidence);

        if (Number.isNaN(numericConfidence)) {
            return 0.8;
        }

        return Math.min(1, Math.max(0, numericConfidence));
    }

    normalizeTextArray(values) {
        if (!Array.isArray(values)) {
            return [];
        }

        return values.map(value => this.getText(value)).filter(Boolean);
    }

    normalizeClarificationQuestions(questions) {
        if (!Array.isArray(questions)) {
            return [];
        }

        const normalizedQuestions = [];
        const usedIds = new Set();

        for (const item of questions) {
            if (normalizedQuestions.length >= 5) {
                break;
            }

            const fallbackId = this.getNextClarificationId(
                normalizedQuestions.length + 1,
                usedIds
            );
            let question = ClarificationQuestion.from(item, fallbackId);

            if (!question) {
                continue;
            }

            const normalizedId = question.id.toUpperCase();

            if (usedIds.has(normalizedId)) {
                question = ClarificationQuestion.from(
                    {
                        ...question.toJSON(),
                        id: fallbackId
                    },
                    fallbackId
                );
            }

            if (!question?.isValid()) {
                continue;
            }

            usedIds.add(question.id.toUpperCase());
            normalizedQuestions.push(question.toJSON());
        }

        return normalizedQuestions;
    }

    getNextClarificationId(sequence, usedIds) {
        let nextSequence = sequence;
        let candidate = `CL${String(nextSequence).padStart(3, "0")}`;

        while (usedIds.has(candidate.toUpperCase())) {
            nextSequence += 1;
            candidate = `CL${String(nextSequence).padStart(3, "0")}`;
        }

        return candidate;
    }

    normalizeContextArray(values) {
        if (!Array.isArray(values)) {
            return [];
        }

        return values
            .map(value => {
                if (typeof value === "string") {
                    return this.normalizeText(value);
                }

                if (!value || typeof value !== "object") {
                    return "";
                }

                const code = this.getText(value?.code);

                const content =
                    this.getText(value?.content) ||
                    this.getText(value?.title) ||
                    this.getText(value?.description) ||
                    this.getText(value?.rule) ||
                    this.getText(value?.name);

                if (code && content) {
                    return `${code}: ${content}`;
                }

                return content || code;
            })
            .filter(Boolean);
    }

    extractModuleFromFeature(featureName) {
        return this.normalizeText(featureName).replace(
            /^(thêm|sửa|xóa|xoá|tìm kiếm|tìm|cập nhật|quản lý)\s+/i,
            ""
        );
    }

    containsAny(sourceText, keywords) {
        return keywords.some(keyword => sourceText.includes(keyword.toLowerCase()));
    }

    addUnique(target, value) {
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
                value.feature ??
                value.scenario ??
                value.rule ??
                value.value ??
                value.code ??
                ""
        ).trim();
    }
}

export default AIAnalysisEngine;
