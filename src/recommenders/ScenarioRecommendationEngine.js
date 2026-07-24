import RecommendedScenario from "../models/RecommendedScenario.js";

class ScenarioRecommendationEngine {
    constructor() {
        this.counter = 1;
    }

    generate(knowledge, requirement) {
        if (!knowledge) {
            return [];
        }

        const scenarios = [];

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

        return scenarios;
    }

    generateFromList(list, type, priority, scenarios, requirement) {
        if (!list || list.length === 0) {
            return;
        }

        list.forEach(item => {
            const scenario = new RecommendedScenario({
                id: `SC${String(this.counter++).padStart(3, "0")}`,

                title: item,

                /*
                            Module từ requirement

                            Ví dụ:
                            Thiết bị
                        */

                module: requirement?.feature || requirement?.module || "",

                /*
                            Feature thực tế

                            Ví dụ:
                            Thêm thiết bị
                        */

                feature: requirement?.actions?.[0] || "",

                type,

                priority,

                reason: `${type} risk detected`,

                source: "Requirement Intelligence",

                requirementReference: item,

                riskCategory: type
            });

            scenarios.push(scenario);
        });
    }
}

export default ScenarioRecommendationEngine;
