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

            const contextualRule = this.createRuleContext(rule, {
                module: rule?.module ?? requirement.module,

                feature: rule?.feature ?? ""
            });

            this.addUnique(knowledge.validationRules, contextualRule);

            this.addUnique(knowledge.riskAreas, {
                ...contextualRule,

                content: this.createRiskDescription(content)
            });
        });
    }

    /*
    =================================================
    Rule Collection
    =================================================
    */

    collectRules(requirement) {
        const rules = [];
        const featureRuleContents = new Set();

        /*
        Feature-level rules
        */

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                const contextualRules = Array.isArray(feature.businessRules)
                    ? feature.businessRules.map(rule =>
                          this.createRuleContext(rule, {
                              module: requirement.module,

                              feature: feature.name
                          })
                      )
                    : [];

                contextualRules.forEach(rule => {
                    featureRuleContents.add(this.normalizeText(this.getRuleContent(rule)));
                });

                this.mergeRules(rules, contextualRules);
            });
        }

        /*
        Requirement-level rules remain supported for older requirements.
        Aggregated copies of feature rules are not emitted a second time.
        */

        const requirementRules = Array.isArray(requirement.businessRules)
            ? requirement.businessRules
                  .filter(
                      rule =>
                          !featureRuleContents.has(this.normalizeText(this.getRuleContent(rule)))
                  )
                  .map(rule =>
                      this.createRuleContext(rule, {
                          module: requirement.module,

                          feature: ""
                      })
                  )
            : [];

        this.mergeRules(rules, requirementRules);

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
                    this.getRuleComparisonKey(currentRule) === this.getRuleComparisonKey(rule)
            );

            if (!existed) {
                target.push(rule);
            }
        });
    }

    createRuleContext(rule, context = {}) {
        const isRuleObject = rule && typeof rule === "object";

        return {
            module:
                isRuleObject && rule.module !== undefined ? rule.module : (context.module ?? ""),

            feature:
                isRuleObject && rule.feature !== undefined ? rule.feature : (context.feature ?? ""),

            code: isRuleObject ? (rule.code ?? "") : "",

            content: this.getRuleContent(rule),

            source: "BUSINESS_RULE"
        };
    }

    getRuleComparisonKey(rule) {
        const moduleName = this.normalizeText(rule && typeof rule === "object" ? rule.module : "");

        const featureName = this.normalizeText(
            rule && typeof rule === "object" ? rule.feature : ""
        );

        const content = this.normalizeText(this.getRuleContent(rule));

        return [moduleName, featureName, content].join("|");
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

        const comparisonKey = this.getRuleComparisonKey(value);

        if (!this.normalizeText(this.getRuleContent(value))) {
            return;
        }

        const existed = target.some(
            currentValue => this.getRuleComparisonKey(currentValue) === comparisonKey
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
