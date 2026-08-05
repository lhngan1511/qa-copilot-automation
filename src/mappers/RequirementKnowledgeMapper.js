import RequirementKnowledge from "../models/RequirementKnowledge.js";

export default class RequirementKnowledgeMapper {
    map({
        requirement = null,
        aiAnalysis = null,
        aiResult = null,
        clarificationQuestions = null,
        clarificationAnswers = null,
        approvedArtifact = null
    } = {}) {
        const artifact = this.isObject(approvedArtifact) ? approvedArtifact : {};
        const artifactKnowledge = this.isObject(artifact.knowledge) ? artifact.knowledge : {};
        const artifactAnalysis = this.isObject(artifact.aiAnalysis) ? artifact.aiAnalysis : {};
        const artifactRequirement = this.isObject(artifact.requirement) ? artifact.requirement : {};
        const parsedRequirement = this.isObject(requirement) ? requirement : {};
        const analysis = this.isObject(aiAnalysis)
            ? aiAnalysis
            : this.isObject(aiResult)
              ? aiResult
              : {};

        const module = this.firstMeaningful([
            artifactKnowledge.module,
            artifact.module,
            artifactRequirement.module,
            parsedRequirement.module
        ]);
        const purpose = this.firstText([
            artifactKnowledge.purpose,
            artifactAnalysis.purpose,
            analysis.purpose,
            artifactRequirement.purpose,
            parsedRequirement.purpose
        ]);
        const functions = this.normalizeFunctions(
            this.firstCollection([
                artifactKnowledge.functions,
                artifactAnalysis.functions,
                analysis.functions,
                artifact.detectedFunctions,
                artifactRequirement.features,
                parsedRequirement.features,
                parsedRequirement.functions
            ]),
            module
        );
        const questions = this.collect([
            clarificationQuestions,
            artifact.clarificationQuestions,
            artifact.questions,
            artifactKnowledge.clarificationQuestions,
            artifactKnowledge.questions,
            artifactAnalysis.clarificationQuestions,
            artifactAnalysis.questions,
            analysis.clarificationQuestions,
            analysis.questions,
            parsedRequirement.clarificationQuestions,
            parsedRequirement.questions
        ]);
        const answers = this.collect([
            clarificationAnswers,
            artifact.clarificationAnswers,
            artifactKnowledge.clarificationAnswers,
            this.getAnsweredQuestions(artifact.questions)
        ]);

        const knowledge = new RequirementKnowledge({
            module,
            purpose,
            functions,
            approved: artifact.approvalStatus === "approved" || artifact.approved === true
        });

        knowledge.businessRules = this.firstCollection([
            this.collect([
                artifactKnowledge.businessRules,
                this.collectFunctionField(artifactKnowledge.functions, "businessRules")
            ]),
            this.collectFunctionField(artifactAnalysis.functions, "businessRules"),
            this.collectFunctionField(analysis.functions, "businessRules"),
            artifact.businessRules,
            artifactRequirement.businessRules,
            parsedRequirement.businessRules
        ]);
        knowledge.validationRules = this.firstCollection([
            this.collect([
                artifactKnowledge.validationRules,
                this.collectFunctionField(artifactKnowledge.functions, "validationRules")
            ]),
            this.collectFunctionField(artifactAnalysis.functions, "validationRules"),
            this.collectFunctionField(analysis.functions, "validationRules"),
            this.collect([artifact.validationRules, artifact.validation]),
            this.collect([
                artifactRequirement.validationRules,
                this.collectFeatureField(artifactRequirement.features, "validationRules")
            ]),
            this.collect([
                parsedRequirement.validationRules,
                this.collectFeatureField(parsedRequirement.features, "validationRules")
            ])
        ]);
        knowledge.permissions = this.firstCollection([
            this.collect([
                artifactKnowledge.permissions,
                this.collectFunctionField(artifactKnowledge.functions, "permissions")
            ]),
            this.collectFunctionField(artifactAnalysis.functions, "permissions"),
            this.collectFunctionField(analysis.functions, "permissions"),
            artifact.permissions,
            artifactRequirement.permissions,
            parsedRequirement.permissions
        ]);
        knowledge.dependencies = this.firstCollection([
            this.collect([
                artifactKnowledge.dependencies,
                this.collectFunctionField(artifactKnowledge.functions, "dependencies")
            ]),
            this.collect([
                artifactAnalysis.dependencies,
                this.collectFunctionField(artifactAnalysis.functions, "dependencies")
            ]),
            this.collect([
                analysis.dependencies,
                this.collectFunctionField(analysis.functions, "dependencies")
            ]),
            artifact.dependencies,
            artifactRequirement.dependencies,
            parsedRequirement.dependencies
        ]);
        knowledge.assumptions = this.firstCollection([
            this.collect([
                artifactKnowledge.assumptions,
                this.collectFunctionField(artifactKnowledge.functions, "assumptions")
            ]),
            this.collect([
                artifactAnalysis.assumptions,
                this.collectFunctionField(artifactAnalysis.functions, "assumptions")
            ]),
            this.collect([
                analysis.assumptions,
                this.collectFunctionField(analysis.functions, "assumptions")
            ]),
            artifact.assumptions,
            artifactRequirement.assumptions,
            parsedRequirement.assumptions
        ]);
        knowledge.clarificationQuestions = questions;
        knowledge.clarificationAnswers = answers;
        knowledge.risks = this.firstCollection([
            this.collect([artifactKnowledge.risks, artifactKnowledge.riskAreas]),
            this.collect([artifactAnalysis.risks, artifactAnalysis.riskAreas]),
            this.collect([analysis.risks, analysis.riskAreas]),
            this.collect([artifact.risks, artifact.riskAreas]),
            this.collect([artifactRequirement.risks, artifactRequirement.riskAreas]),
            this.collect([parsedRequirement.risks, parsedRequirement.riskAreas])
        ]);

        this.mergeApprovedClarifications(knowledge, artifact);
        return knowledge;
    }

    mergeApprovedClarifications(knowledge, artifact) {
        if (artifact.approvalStatus !== "approved" || !Array.isArray(artifact.questions)) return;
        const sources = this.isObject(knowledge.knowledgeSources) ? knowledge.knowledgeSources : {};
        for (const question of artifact.questions) {
            if (!this.isObject(question) || question.status !== "answered") continue;
            const answer = String(question.answer ?? "").trim();
            if (!answer) continue;
            const sourceId = String(question.questionId ?? question.id ?? "").trim();
            const category = this.mapClarificationCategory(question.category ?? question.type);
            const field = category.field;
            if (field) {
                knowledge[field] = this.mergeStringFact(knowledge[field], answer);
                sources[field] = sources[field] ?? {};
                this.addSourceReference(sources[field], answer, sourceId);
            } else {
                knowledge.confirmedFacts = this.mergeStringFact(knowledge.confirmedFacts, answer);
                sources.confirmedFacts = sources.confirmedFacts ?? {};
                this.addSourceReference(sources.confirmedFacts, answer, sourceId);
            }
        }
        knowledge.knowledgeSources = sources;
    }

    mapClarificationCategory(value) {
        const category = String(value ?? "").trim().toLowerCase();
        if (category === "business rule" || category === "business_rule") return { field: "businessRules" };
        if (category === "validation") return { field: "validationRules" };
        if (category === "permission") return { field: "permissions" };
        if (category === "boundary") return { field: "boundaryCases" };
        return { field: "" };
    }

    mergeStringFact(values, fact) {
        const current = Array.isArray(values) ? values.filter(value => typeof value === "string") : [];
        const key = this.normalizeFactKey(fact);
        return current.some(value => this.normalizeFactKey(value) === key) ? current : [...current, fact];
    }

    addSourceReference(bucket, fact, sourceId) {
        const key = this.normalizeFactKey(fact);
        const references = Array.isArray(bucket[key]) ? bucket[key] : [];
        const source = { sourceType: "CLARIFICATION", sourceId };
        if (sourceId && !references.some(item => item?.sourceType === source.sourceType && item?.sourceId === source.sourceId)) references.push(source);
        bucket[key] = references;
    }

    normalizeFactKey(value) {
        return String(value ?? "").trim().toLowerCase().replace(/\\s+/g, " ");
    }

    normalizeFunctions(functions, module) {
        const moduleId = this.isObject(module) ? module.id : "";

        return functions.map(value => {
            if (!this.isObject(value)) return value;

            const businessRules = this.toTextArray(value.businessRules ?? value.rules);
            const validationRules = this.collect([
                value.validationRules,
                value.validations,
                (Array.isArray(value.inputs) ? value.inputs : []).map(input =>
                    this.isObject(input)
                        ? this.withInputName(
                              input.name ?? input.inputName ?? input.fieldName,
                              input.description ?? input.content
                          )
                        : input
                )
            ]);
            const permissions = this.collect([
                value.permissions,
                value.permissionRules,
                (Array.isArray(value.preconditions) ? value.preconditions : []).filter(
                    item => typeof item === "string" && /quyền/i.test(item)
                )
            ]);
            const references = this.collect([
                value.requirementReferences,
                value.references,
                businessRules
                    .map((_rule, index) => value.businessRules?.[index]?.code)
                    .filter(Boolean)
            ]);

            return {
                ...this.clone(value),
                moduleId: value.moduleId ?? moduleId,
                name: value.name ?? value.feature ?? value.title,
                businessRules,
                validationRules: this.toTextArray(validationRules),
                permissions: this.toTextArray(permissions),
                boundaries: this.toTextArray(value.boundaries ?? value.boundaryCases),
                requirementReferences: this.toTextArray(references)
            };
        });
    }

    toTextArray(values) {
        return this.collect([values])
            .map(value =>
                typeof value === "string"
                    ? value
                    : this.isObject(value)
                      ? (value.content ?? value.description ?? value.name)
                      : ""
            )
            .filter(value => typeof value === "string" && value.trim())
            .map(value => value.trim());
    }

    withInputName(name, rule) {
        const normalizedName = typeof name === "string" ? name.trim() : "";
        const normalizedRule = typeof rule === "string" ? rule.trim() : "";

        if (!normalizedRule || !normalizedName) {
            return normalizedRule;
        }

        return normalizedRule
            .toLocaleLowerCase("vi")
            .startsWith(normalizedName.toLocaleLowerCase("vi"))
            ? normalizedRule
            : `${normalizedName} ${normalizedRule}`;
    }

    collectFeatureField(features, field) {
        return (Array.isArray(features) ? features : []).flatMap(feature =>
            this.isObject(feature) && Array.isArray(feature[field]) ? feature[field] : []
        );
    }

    collectFunctionField(functions, field) {
        return (Array.isArray(functions) ? functions : []).flatMap(item =>
            this.isObject(item) && Array.isArray(item[field]) ? item[field] : []
        );
    }

    firstCollection(collections) {
        const source = collections.find(value => Array.isArray(value) && value.length > 0);
        return source ? this.collect([source]) : [];
    }

    getAnsweredQuestions(questions) {
        return (Array.isArray(questions) ? questions : []).filter(
            question =>
                this.isObject(question) &&
                typeof question.answer === "string" &&
                question.answer.trim() !== ""
        );
    }

    collect(collections) {
        const result = [];
        const seen = new Set();

        collections
            .flatMap(value => (Array.isArray(value) ? value : []))
            .forEach(value => {
                const normalized = this.normalizeValue(value);
                if (normalized === null) return;

                const key = this.comparisonKey(normalized);
                if (seen.has(key)) return;

                seen.add(key);
                result.push(this.clone(normalized));
            });

        return result;
    }

    normalizeValue(value) {
        if (typeof value === "string") {
            const normalized = value.trim();
            return normalized || null;
        }
        if (this.isObject(value)) {
            return Object.keys(value).length > 0 ? value : null;
        }
        return value === null || value === undefined ? null : value;
    }

    firstMeaningful(values) {
        const value = values.find(item => this.normalizeValue(item) !== null);
        return value === undefined ? undefined : this.clone(value);
    }

    firstText(values) {
        const value = values.find(item => typeof item === "string" && item.trim());
        return typeof value === "string" ? value.trim() : "";
    }

    comparisonKey(value) {
        return typeof value === "string"
            ? `string:${value.toLowerCase()}`
            : `value:${JSON.stringify(value)}`;
    }

    isObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }

    clone(value) {
        if (Array.isArray(value)) return value.map(item => this.clone(item));
        if (this.isObject(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.clone(item)])
            );
        }
        return value;
    }
}
