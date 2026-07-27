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
                this.addNegativeCase(knowledge, rule);
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
        const featureExceptionContents = new Set();

        /*
        Feature-level exceptions
        */

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                const contextualExceptions = Array.isArray(feature.exceptions)
                    ? feature.exceptions.map(exception =>
                          this.createContextualItem(exception, {
                              module: requirement.module,

                              feature: feature.name,

                              source: "FEATURE_EXCEPTION"
                          })
                      )
                    : [];

                contextualExceptions.forEach(exception => {
                    featureExceptionContents.add(
                        this.normalizeForComparison(this.getItemContent(exception))
                    );
                });

                this.mergeItems(edgeCases, contextualExceptions);
            });
        }

        /*
        Legacy requirement-level edge cases remain supported.
        Aggregated copies of feature exceptions are suppressed.
        */

        const requirementEdgeCases = Array.isArray(requirement.edgeCases)
            ? requirement.edgeCases
                  .filter(
                      item =>
                          !featureExceptionContents.has(
                              this.normalizeForComparison(this.getItemContent(item))
                          )
                  )
                  .map(item =>
                      this.createContextualItem(item, {
                          module: requirement.module,

                          feature: "",

                          source: "LEGACY_EDGE_CASE"
                      })
                  )
            : [];

        this.mergeItems(edgeCases, requirementEdgeCases);

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

            const comparisonKey = this.getNegativeCaseComparisonKey(item);

            const alreadyExists = target.some(
                existingItem => this.getNegativeCaseComparisonKey(existingItem) === comparisonKey
            );

            if (!alreadyExists) {
                target.push(item);
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

        const normalizedItem =
            item && typeof item === "object" ? this.createContextualItem(item) : content;

        const comparisonKey = this.getNegativeCaseComparisonKey(normalizedItem);

        const alreadyExists = knowledge.negativeCases.some(
            existingItem => this.getNegativeCaseComparisonKey(existingItem) === comparisonKey
        );

        if (!alreadyExists) {
            knowledge.negativeCases.push(normalizedItem);
        }
    }

    createContextualItem(item, context = {}) {
        if (!item || typeof item !== "object") {
            return item;
        }

        const supportedFields = [
            "module",
            "feature",
            "code",
            "inputName",
            "source",
            "validationType",
            "required",
            "controlType",
            "dataSource",
            "description",
            "severity",
            "priority",
            "riskCategory",
            "requirementReference"
        ];

        const normalizedItem = {};

        supportedFields.forEach(fieldName => {
            if (item[fieldName] !== undefined) {
                normalizedItem[fieldName] = item[fieldName];
            } else if (context[fieldName] !== undefined) {
                normalizedItem[fieldName] = context[fieldName];
            }
        });

        normalizedItem.module = normalizedItem.module ?? context.module ?? "";

        normalizedItem.feature = normalizedItem.feature ?? context.feature ?? "";

        normalizedItem.content = this.getItemContent(item);

        normalizedItem.source = normalizedItem.source ?? context.source ?? "NEGATIVE_CASE";

        return normalizedItem;
    }

    getNegativeCaseComparisonKey(item) {
        if (typeof item === "string") {
            return ["", "", this.normalizeForComparison(item), "LEGACY_NEGATIVE_CASE"].join("|");
        }

        return [
            this.normalizeForComparison(item?.module ?? ""),

            this.normalizeForComparison(item?.feature ?? ""),

            this.normalizeForComparison(this.getItemContent(item)),

            this.normalizeForComparison(item?.source ?? "NEGATIVE_CASE")
        ].join("|");
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
