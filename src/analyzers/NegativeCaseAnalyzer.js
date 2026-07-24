class NegativeCaseAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        this.analyzeBusinessRules(knowledge);
        this.analyzeDataIntegrity(knowledge);
        this.analyzeBoundary(knowledge);
        this.analyzeEdgeCases(requirement, knowledge);
    }

    analyzeBusinessRules(knowledge) {
        const validationRules = Array.isArray(knowledge.validationRules)
            ? knowledge.validationRules
            : [];

        validationRules.forEach(rule => {
            const content = this.getItemContent(rule);
            const lowerContent = content.toLowerCase();

            if (lowerContent.includes("không") || lowerContent.includes("không được")) {
                this.addNegativeCase(knowledge, rule);
            }
        });
    }

    analyzeDataIntegrity(knowledge) {
        const dataIntegrityCases = Array.isArray(knowledge.dataIntegrityCases)
            ? knowledge.dataIntegrityCases
            : [];

        dataIntegrityCases.forEach(item => {
            this.addNegativeCase(knowledge, item);
        });
    }

    analyzeBoundary(knowledge) {
        const boundaryCases = Array.isArray(knowledge.boundaryCases) ? knowledge.boundaryCases : [];

        boundaryCases.forEach(item => {
            this.addNegativeCase(knowledge, item);
        });
    }

    analyzeEdgeCases(requirement, knowledge) {
        const edgeCases = Array.isArray(requirement.edgeCases) ? requirement.edgeCases : [];

        edgeCases.forEach(item => {
            this.addNegativeCase(knowledge, item);
        });
    }

    getItemContent(item) {
        if (typeof item === "string") {
            return item.trim();
        }

        if (!item || typeof item !== "object") {
            return "";
        }

        return String(
            item.content ?? item.description ?? item.title ?? item.name ?? item.rule ?? ""
        ).trim();
    }

    addNegativeCase(knowledge, item) {
        if (!Array.isArray(knowledge.negativeCases)) {
            knowledge.negativeCases = [];
        }

        const content = this.getItemContent(item);

        if (!content) {
            return;
        }

        const alreadyExists = knowledge.negativeCases.some(existingItem => {
            return this.getItemContent(existingItem) === content;
        });

        if (!alreadyExists) {
            knowledge.negativeCases.push(item);
        }
    }
}

export default NegativeCaseAnalyzer;
