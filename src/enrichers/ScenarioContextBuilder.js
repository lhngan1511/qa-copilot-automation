import TestDesignContentNormalizer from "../normalizers/TestDesignContentNormalizer.js";

class ScenarioContextBuilder {
    constructor({ contentNormalizer = new TestDesignContentNormalizer() } = {}) {
        this.contentNormalizer = contentNormalizer;
    }

    build({ scenario, requirement, knowledge } = {}) {
        const sourceScenario = scenario && typeof scenario === "object" ? scenario : {};
        const sourceRequirement = requirement && typeof requirement === "object" ? requirement : {};
        const sourceKnowledge = knowledge && typeof knowledge === "object" ? knowledge : {};

        const owningFeature = this.findFeature(sourceScenario, sourceRequirement);
        const sourceItem = this.findSourceItem(sourceScenario, sourceKnowledge);
        const feature = this.normalizeFeature(owningFeature, sourceRequirement);
        const inputs = this.cloneValue(feature.inputs);
        const preconditions = this.contentNormalizer.normalizePreconditions(
            [
                ...(Array.isArray(sourceRequirement.preconditions)
                    ? sourceRequirement.preconditions
                    : []),
                ...(Array.isArray(sourceRequirement.permissions)
                    ? sourceRequirement.permissions
                    : []),
                ...(Array.isArray(sourceScenario.preconditions)
                    ? sourceScenario.preconditions
                    : []),
                ...feature.preconditions
            ],
            { target: feature.name || sourceScenario.feature || "" }
        );

        return {
            identity: {
                id: sourceScenario.id ?? "",

                module: sourceScenario.module ?? "",

                feature: sourceScenario.feature ?? "",

                title: sourceScenario.title ?? "",

                type: sourceScenario.type ?? "",

                source: sourceScenario.source ?? "",

                requirementReference: sourceScenario.requirementReference ?? "",

                riskCategory: sourceScenario.riskCategory ?? ""
            },

            feature,

            sourceItem: this.normalizeSourceItem(sourceItem),

            operation: this.resolveOperation(feature, sourceItem, sourceScenario),

            inputs,

            preconditions,

            clarificationAnswers: Array.isArray(sourceKnowledge.clarificationAnswers)
                ? this.cloneValue(sourceKnowledge.clarificationAnswers)
                : [],

            existing: {
                testData:
                    sourceScenario.testData === undefined
                        ? {}
                        : this.cloneValue(sourceScenario.testData),

                steps: this.cloneValue(sourceScenario.steps ?? []),

                expectedResult: sourceScenario.expectedResult ?? "",

                expectedResults: this.cloneValue(sourceScenario.expectedResults ?? []),

                assertions: this.cloneValue(sourceScenario.assertions ?? [])
            }
        };
    }

    findFeature(scenario, requirement) {
        const scenarioFeature = this.normalizeForComparison(scenario?.feature);

        if (!scenarioFeature || !Array.isArray(requirement?.features)) {
            return null;
        }

        return (
            requirement.features.find(feature => {
                return this.normalizeForComparison(feature?.name) === scenarioFeature;
            }) ?? null
        );
    }

    findSourceItem(scenario, knowledge) {
        const entries = this.collectKnowledgeEntries(knowledge);
        const matches = entries
            .map((entry, index) => ({
                entry,

                index,

                score: this.matchesScenario(entry, scenario)
            }))
            .filter(match => match.score >= 0)
            .sort((first, second) => second.score - first.score || first.index - second.index);

        return matches[0]?.entry ?? null;
    }

    collectKnowledgeEntries(knowledge) {
        const collectionNames = [
            "validationRules",
            "riskAreas",
            "boundaryCases",
            "negativeCases",
            "positiveCases",
            "securityCases",
            "permissionCases",
            "dataIntegrityCases",
            "suggestedScenarios"
        ];

        return collectionNames.flatMap(collectionName => {
            const collection = knowledge?.[collectionName];

            return Array.isArray(collection) ? collection : [];
        });
    }

    matchesScenario(entry, scenario) {
        const entryIsObject = entry && typeof entry === "object";
        const entryModule = entryIsObject ? this.normalizeForComparison(entry.module) : "";
        const entryFeature = entryIsObject ? this.normalizeForComparison(entry.feature) : "";
        const entrySource = entryIsObject ? this.normalizeForComparison(entry.source) : "";
        const entryReference = entryIsObject
            ? this.normalizeForComparison(entry.requirementReference ?? entry.code)
            : "";
        const entryContent = this.normalizeForComparison(this.getItemContent(entry));

        const scenarioModule = this.normalizeForComparison(scenario?.module);
        const scenarioFeature = this.normalizeForComparison(scenario?.feature);
        const scenarioSource = this.normalizeForComparison(scenario?.source);
        const scenarioReference = this.normalizeForComparison(scenario?.requirementReference);
        const scenarioContent = this.normalizeForComparison(
            scenario?.title ?? scenario?.testScenario
        );

        if (entryModule && scenarioModule && entryModule !== scenarioModule) {
            return -1;
        }

        if (entryFeature && scenarioFeature && entryFeature !== scenarioFeature) {
            return -1;
        }

        if (entrySource && scenarioSource && entrySource !== scenarioSource) {
            return -1;
        }

        if (entryReference && scenarioReference && entryReference !== scenarioReference) {
            return -1;
        }

        const referenceMatches =
            Boolean(entryReference && scenarioReference) && entryReference === scenarioReference;
        const contentMatches =
            Boolean(entryContent && scenarioContent) && entryContent === scenarioContent;

        if (!referenceMatches && !contentMatches) {
            return -1;
        }

        let score = 0;

        if (entryModule && entryModule === scenarioModule) {
            score += 20;
        }

        if (entryFeature && entryFeature === scenarioFeature) {
            score += 100;
        }

        if (entrySource && entrySource === scenarioSource) {
            score += 80;
        }

        if (referenceMatches) {
            score += 120;
        }

        if (contentMatches) {
            score += 100;
        }

        if (!entryFeature) {
            score -= 10;
        }

        if (!entrySource) {
            score -= 5;
        }

        return score;
    }

    normalizeFeature(feature, requirement) {
        if (!feature || typeof feature !== "object") {
            return this.createEmptyFeature();
        }

        return {
            id: feature.id ?? "",

            name: feature.name ?? "",

            description: feature.description ?? "",

            preconditions: this.cloneValue(feature.preconditions ?? []),

            inputs: this.mergeFeatureInputs(feature.inputs, requirement),

            flow: this.cloneValue(feature.flow ?? []),

            businessRules: this.cloneValue(feature.businessRules ?? []),

            expectedResults: this.cloneValue(feature.expectedResults ?? []),

            exceptions: this.cloneValue(feature.exceptions ?? []),

            automation: this.cloneValue(feature.automation ?? {})
        };
    }

    createEmptyFeature() {
        return {
            id: "",

            name: "",

            description: "",

            preconditions: [],

            inputs: [],

            flow: [],

            businessRules: [],

            expectedResults: [],

            exceptions: [],

            automation: {}
        };
    }

    mergeFeatureInputs(featureInputs, requirement) {
        if (!Array.isArray(featureInputs)) {
            return [];
        }

        const commonInputs = [
            ...(Array.isArray(requirement?.commonInputs) ? requirement.commonInputs : []),

            ...(Array.isArray(requirement?.inputDefinitions) ? requirement.inputDefinitions : [])
        ];

        return featureInputs.map(featureInput => {
            const commonInput = commonInputs.find(candidate => {
                return (
                    this.normalizeForComparison(candidate?.name) ===
                    this.normalizeForComparison(featureInput?.name)
                );
            });

            const mergedInput = {
                ...(this.cloneValue(commonInput) ?? {}),

                ...(this.cloneValue(featureInput) ?? {})
            };

            const metadataFields = ["name", "required", "controlType", "dataSource", "description"];

            metadataFields.forEach(fieldName => {
                const featureValue = featureInput?.[fieldName];

                if (featureValue === undefined || featureValue === null || featureValue === "") {
                    mergedInput[fieldName] = this.cloneValue(commonInput?.[fieldName] ?? "");
                }
            });

            return mergedInput;
        });
    }

    normalizeSourceItem(item) {
        const source = item && typeof item === "object" ? item : {};
        const content = this.getItemContent(item);

        return {
            module: source.module ?? "",

            feature: source.feature ?? "",

            code: source.code ?? "",

            content,

            source: source.source ?? (typeof item === "string" ? "LEGACY" : ""),

            inputName: source.inputName ?? "",

            validationType: source.validationType ?? "",

            securityType: source.securityType ?? "",

            permissionType: source.permissionType ?? "",

            permissionName: source.permissionName ?? "",

            operation: source.operation ?? "",

            action: source.action ?? "",

            description: source.description ?? "",

            required: source.required ?? false,

            controlType: source.controlType ?? "",

            dataSource: source.dataSource ?? "",

            severity: source.severity ?? "",

            priority: source.priority ?? "",

            riskCategory: source.riskCategory ?? "",

            requirementReference: source.requirementReference ?? ""
        };
    }

    resolveOperation(feature, sourceItem, scenario) {
        const featureOperation = feature?.automation?.operation;
        const sourceOperation =
            sourceItem && typeof sourceItem === "object" ? sourceItem.operation : "";
        const scenarioOperation = scenario?.automation?.operation ?? scenario?.operation;
        const operationName = [featureOperation, sourceOperation, scenarioOperation].find(
            operation => this.normalizeText(operation) !== ""
        );

        return {
            name: operationName ?? "",

            type: this.normalizeOperationType(operationName),

            screen:
                feature?.automation?.screen ??
                scenario?.automation?.screen ??
                scenario?.screen ??
                ""
        };
    }

    normalizeOperationType(operation) {
        const normalizedOperation = this.normalizeForComparison(operation);
        const operationTypes = {
            create: "CREATE",
            add: "CREATE",
            update: "UPDATE",
            edit: "UPDATE",
            delete: "DELETE",
            remove: "DELETE",
            search: "SEARCH",
            find: "SEARCH",
            view: "VIEW",
            read: "VIEW"
        };

        return operationTypes[normalizedOperation] ?? "";
    }

    getItemContent(item) {
        if (typeof item === "string") {
            return this.normalizeText(item);
        }

        if (!item || typeof item !== "object") {
            return "";
        }

        return this.normalizeText(
            item.content ??
                item.title ??
                item.testScenario ??
                item.description ??
                item.name ??
                item.rule ??
                item.scenario ??
                ""
        );
    }

    cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item));
        }

        if (value && typeof value === "object") {
            const clone = {};

            Object.entries(value).forEach(([key, item]) => {
                clone[key] = this.cloneValue(item);
            });

            return clone;
        }

        return value;
    }

    normalizeText(value) {
        if (value === undefined || value === null) {
            return "";
        }

        return String(value).replace(/\s+/g, " ").trim();
    }

    normalizeForComparison(value) {
        return this.normalizeText(value)
            .replace(/[.!?;:,]+$/g, "")
            .toLowerCase();
    }
}

export default ScenarioContextBuilder;
