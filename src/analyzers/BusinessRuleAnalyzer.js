class BusinessRuleAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        const rules = this.collectRules(requirement);

        rules.forEach(rule => {
            const content = this.getRuleContent(rule);

            if (!content) {
                return;
            }

            this.addUnique(knowledge.validationRules, content);

            this.addUnique(knowledge.riskAreas, this.createRiskDescription(content));
        });
    }

    /*
    =================================================
    Rule Collection
    =================================================
    */

    collectRules(requirement) {
        const rules = [];

        /*
        Requirement-level aggregated rules
        */

        this.mergeRules(rules, requirement.businessRules);

        /*
        Feature-level rules
        */

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                this.mergeRules(rules, feature.businessRules);
            });
        }

        return rules;
    }

    mergeRules(target, source) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(rule => {
            const ruleContent = this.getRuleContent(rule);

            if (!ruleContent) {
                return;
            }

            const existed = target.some(
                currentRule =>
                    this.normalizeText(this.getRuleContent(currentRule)) ===
                    this.normalizeText(ruleContent)
            );

            if (!existed) {
                target.push(rule);
            }
        });
    }

    /*
    =================================================
    Rule Normalization
    =================================================
    */

    getRuleContent(rule) {
        if (rule === undefined || rule === null) {
            return "";
        }

        if (typeof rule === "string") {
            return rule.trim();
        }

        if (typeof rule === "object") {
            return String(rule.content ?? rule.description ?? rule.rule ?? rule.name ?? "").trim();
        }

        return String(rule).trim();
    }

    /*
    =================================================
    Risk Conversion
    =================================================
    */

    createRiskDescription(content) {
        const normalizedContent = String(content ?? "").trim();

        if (!normalizedContent) {
            return "";
        }

        /*
        Business Rule hiện tại được dùng làm vùng rủi ro.
        Giữ nguyên nội dung để không tự suy diễn sai
        yêu cầu nghiệp vụ.
        */

        return normalizedContent;
    }

    /*
    =================================================
    Utilities
    =================================================
    */

    addUnique(target, value) {
        if (!Array.isArray(target) || value === undefined || value === null) {
            return;
        }

        const normalizedValue = this.normalizeText(value);

        if (!normalizedValue) {
            return;
        }

        const existed = target.some(
            currentValue => this.normalizeText(currentValue) === normalizedValue
        );

        if (!existed) {
            target.push(value);
        }
    }

    normalizeText(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase();
    }
}

export default BusinessRuleAnalyzer;
