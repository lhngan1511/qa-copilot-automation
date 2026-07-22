class BusinessRuleAnalyzer {

    analyze(requirement, knowledge) {

        if (!requirement || !knowledge) {
            return;
        }

        const rules = requirement.businessRules || [];

        knowledge.validationRules.push(...rules);

        knowledge.riskAreas.push(...rules);

    }

}

export default BusinessRuleAnalyzer;