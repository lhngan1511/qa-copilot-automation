class NegativeCaseAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        /*
        Không đưa Boundary Case vào Negative Case.

        BoundaryAnalyzer chịu trách nhiệm riêng
        cho knowledge.boundaryCases.
        */

        this.analyzeBusinessRules(knowledge);

        this.analyzeDataIntegrity(knowledge);

        this.analyzeEdgeCases(requirement, knowledge);
    }

    /*
    =================================================
    Business Rule Analysis
    =================================================
    */

    analyzeBusinessRules(knowledge) {
        const validationRules = Array.isArray(knowledge.validationRules)
            ? knowledge.validationRules
            : [];

        validationRules.forEach(rule => {
            const content = this.getItemContent(rule);

            if (!content) {
                return;
            }

            if (this.isNegativeContent(content)) {
                this.addNegativeCase(knowledge, content);
            }
        });
    }

    /*
    =================================================
    Data Integrity Analysis
    =================================================
    */

    analyzeDataIntegrity(knowledge) {
        const dataIntegrityCases = Array.isArray(knowledge.dataIntegrityCases)
            ? knowledge.dataIntegrityCases
            : [];

        dataIntegrityCases.forEach(item => {
            this.addNegativeCase(knowledge, item);
        });
    }

    /*
    =================================================
    Edge Case Analysis
    =================================================
    */

    analyzeEdgeCases(requirement, knowledge) {
        const edgeCases = this.collectEdgeCases(requirement);

        edgeCases.forEach(item => {
            this.addNegativeCase(knowledge, item);
        });
    }

    collectEdgeCases(requirement) {
        const edgeCases = [];

        /*
        Requirement-level aggregated edge cases
        */

        this.mergeItems(edgeCases, requirement.edgeCases);

        /*
        Feature-level exceptions
        */

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                this.mergeItems(edgeCases, feature.exceptions);
            });
        }

        return edgeCases;
    }

    mergeItems(target, source) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(item => {
            const content = this.getItemContent(item);

            if (!content) {
                return;
            }

            const normalizedContent = this.normalizeForComparison(content);

            const alreadyExists = target.some(existingItem => {
                const existingContent = this.getItemContent(existingItem);

                return this.normalizeForComparison(existingContent) === normalizedContent;
            });

            if (!alreadyExists) {
                target.push(content);
            }
        });
    }

    /*
    =================================================
    Negative Content Detection
    =================================================
    */

    isNegativeContent(content) {
        const normalizedContent = this.normalizeForComparison(content);

        if (!normalizedContent) {
            return false;
        }

        const negativeKeywords = [
            "không",

            "bắt buộc",

            "thiếu",

            "sai",

            "lỗi",

            "từ chối",

            "không hợp lệ",

            "không tồn tại",

            "đã tồn tại",

            "bị trùng",

            "vượt quá",

            "nhỏ hơn",

            "lớn hơn"
        ];

        return negativeKeywords.some(keyword => normalizedContent.includes(keyword));
    }

    /*
    =================================================
    Negative Case Management
    =================================================
    */

    addNegativeCase(knowledge, item) {
        if (!Array.isArray(knowledge.negativeCases)) {
            knowledge.negativeCases = [];
        }

        const content = this.getItemContent(item);

        if (!content) {
            return;
        }

        const normalizedContent = this.normalizeForComparison(content);

        const alreadyExists = knowledge.negativeCases.some(existingItem => {
            const existingContent = this.getItemContent(existingItem);

            return this.normalizeForComparison(existingContent) === normalizedContent;
        });

        if (!alreadyExists) {
            /*
            Negative Case luôn lưu dạng chuỗi
            để các generator phía sau dễ xử lý.
            */

            knowledge.negativeCases.push(content);
        }
    }

    /*
    =================================================
    Content Normalization
    =================================================
    */

    getItemContent(item) {
        if (typeof item === "string") {
            return this.normalizeText(item);
        }

        if (!item || typeof item !== "object") {
            return "";
        }

        const content =
            item.content ??
            item.description ??
            item.title ??
            item.name ??
            item.rule ??
            item.scenario ??
            "";

        return this.normalizeText(String(content));
    }

    normalizeText(value) {
        if (typeof value !== "string") {
            return "";
        }

        return value.replace(/\s+/g, " ").trim();
    }

    normalizeForComparison(value) {
        return this.normalizeText(value)
            .replace(/[.!?;:,]+$/g, "")
            .toLowerCase();
    }
}

export default NegativeCaseAnalyzer;
