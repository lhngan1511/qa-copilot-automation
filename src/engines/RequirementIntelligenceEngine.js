import RequirementKnowledge from "../models/RequirementKnowledge.js";

import BusinessRuleAnalyzer from "../analyzers/BusinessRuleAnalyzer.js";
import InputAnalyzer from "../analyzers/InputAnalyzer.js";
import BoundaryAnalyzer from "../analyzers/BoundaryAnalyzer.js";
import NegativeCaseAnalyzer from "../analyzers/NegativeCaseAnalyzer.js";
import PositiveCaseAnalyzer from "../analyzers/PositiveCaseAnalyzer.js";
import SecurityCaseAnalyzer from "../analyzers/SecurityCaseAnalyzer.js";
import PermissionCaseAnalyzer from "../analyzers/PermissionCaseAnalyzer.js";

class RequirementIntelligenceEngine {
    constructor() {
        this.analyzers = [];

        /*
        Thứ tự analyzer có ý nghĩa.

        BusinessRuleAnalyzer và InputAnalyzer
        cần chạy trước NegativeCaseAnalyzer,
        vì NegativeCaseAnalyzer sử dụng dữ liệu
        trong knowledge.validationRules và
        knowledge.dataIntegrityCases.
        */

        this.register(new BusinessRuleAnalyzer());

        this.register(new InputAnalyzer());

        this.register(new BoundaryAnalyzer());

        this.register(new NegativeCaseAnalyzer());

        this.register(new PositiveCaseAnalyzer());

        this.register(new SecurityCaseAnalyzer());

        this.register(new PermissionCaseAnalyzer());
    }

    /*
    =================================================
    Analyzer Registration
    =================================================
    */

    register(analyzer) {
        if (!analyzer || typeof analyzer.analyze !== "function") {
            return;
        }

        this.analyzers.push(analyzer);
    }

    /*
    =================================================
    Requirement Analysis
    =================================================
    */

    analyze(requirement) {
        const knowledge = new RequirementKnowledge();

        if (!requirement) {
            return knowledge;
        }

        this.assignMetadata(requirement, knowledge);

        this.analyzers.forEach(analyzer => {
            if (!analyzer || typeof analyzer.analyze !== "function") {
                return;
            }

            try {
                analyzer.analyze(requirement, knowledge);
            } catch (error) {
                const analyzerName = analyzer.constructor?.name ?? "UnknownAnalyzer";

                throw new Error(`${analyzerName} failed: ${error.message}`, {
                    cause: error
                });
            }
        });

        this.normalizeKnowledge(knowledge);

        knowledge.confidence = this.calculateConfidence(knowledge);

        return knowledge;
    }

    /*
    =================================================
    Metadata Mapping
    =================================================
    */

    assignMetadata(requirement, knowledge) {
        knowledge.module = this.normalizeText(requirement.module);

        const features = Array.isArray(requirement.features) ? requirement.features : [];

        knowledge.features = features
            .map(feature => this.normalizeText(feature?.name))
            .filter(Boolean);

        /*
        Trường feature được giữ để tương thích
        với generator và pipeline cũ.

        Nếu chỉ có một feature, lấy tên feature đó.
        Nếu có nhiều feature, dùng module làm phạm vi chung.
        */

        if (knowledge.features.length === 1) {
            knowledge.feature = knowledge.features[0];
        } else if (knowledge.features.length > 1) {
            knowledge.feature = knowledge.module;
        } else {
            knowledge.feature = this.normalizeText(requirement.feature) || knowledge.module;
        }
    }

    /*
    =================================================
    Knowledge Normalization
    =================================================
    */

    normalizeKnowledge(knowledge) {
        const collectionFields = [
            "validationRules",

            "riskAreas",

            "boundaryCases",

            "negativeCases",

            "positiveCases",

            "securityCases",

            "permissionCases",

            "dataIntegrityCases",

            "suggestedScenarios",

            "questions"
        ];

        collectionFields.forEach(fieldName => {
            knowledge[fieldName] = this.normalizeCollection(knowledge[fieldName]);
        });
    }

    normalizeCollection(values) {
        if (!Array.isArray(values)) {
            return [];
        }

        const result = [];
        const existingKeys = new Set();

        values.forEach(value => {
            const comparisonKey = this.buildCollectionComparisonKey(value);

            if (!comparisonKey) {
                return;
            }

            if (existingKeys.has(comparisonKey)) {
                return;
            }

            existingKeys.add(comparisonKey);
            result.push(value);
        });

        return result;
    }

    buildCollectionComparisonKey(value) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return this.getComparableValue(value);
        }

        if (!value || typeof value !== "object") {
            return "";
        }

        const moduleName = this.getComparableValue(value.module);

        const featureName = this.getComparableValue(value.feature ?? value.featureName);

        const type = this.getComparableValue(value.type);

        const content = this.getComparableValue(
            value.content ??
                value.description ??
                value.title ??
                value.name ??
                value.rule ??
                value.scenario ??
                value.value
        );

        /*
    Khi object có dữ liệu ngữ cảnh, phải so sánh
    cả module, feature, type và content.

    Nhờ vậy hai scenario cùng nội dung nhưng thuộc
    hai feature khác nhau sẽ không bị loại nhầm.
    */
        if (moduleName || featureName || type || content) {
            return [moduleName, featureName, type, content].join("|");
        }

        return JSON.stringify(value, Object.keys(value).sort()).toLowerCase();
    }
    /*
    =================================================
    Confidence Calculation
    =================================================
    */

    calculateConfidence(knowledge) {
        if (!knowledge) {
            return 0;
        }

        let score = 0;

        if (this.hasItems(knowledge.validationRules)) {
            score += 15;
        }

        if (this.hasItems(knowledge.riskAreas)) {
            score += 15;
        }

        if (this.hasItems(knowledge.boundaryCases)) {
            score += 15;
        }

        if (this.hasItems(knowledge.negativeCases)) {
            score += 15;
        }

        if (this.hasItems(knowledge.positiveCases)) {
            score += 15;
        }

        if (this.hasItems(knowledge.securityCases)) {
            score += 10;
        }

        if (this.hasItems(knowledge.permissionCases)) {
            score += 15;
        }

        if (this.hasItems(knowledge.dataIntegrityCases)) {
            score += 10;
        }

        return Math.min(score, 100);
    }

    /*
    =================================================
    Utilities
    =================================================
    */

    hasItems(value) {
        return Array.isArray(value) && value.length > 0;
    }

    getComparableValue(value) {
        if (value === undefined || value === null) {
            return "";
        }

        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return this.normalizeText(String(value))
                .replace(/[.!?;:,]+$/g, "")
                .toLowerCase();
        }

        if (typeof value === "object") {
            const content =
                value.content ??
                value.description ??
                value.title ??
                value.name ??
                value.rule ??
                value.scenario ??
                "";

            if (content) {
                return this.getComparableValue(content);
            }

            return JSON.stringify(value, Object.keys(value).sort()).toLowerCase();
        }

        return this.normalizeText(String(value)).toLowerCase();
    }

    normalizeText(value) {
        if (value === undefined || value === null) {
            return "";
        }

        return String(value).replace(/\s+/g, " ").trim();
    }
}

export default RequirementIntelligenceEngine;
