class InputAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        const inputs = this.collectInputs(requirement);

        inputs.forEach(entry => {
            this.analyzeRequired(entry.input, knowledge, entry);

            this.analyzeControlType(entry.input, knowledge, entry);

            this.analyzeDescription(entry.input, knowledge, entry);
        });
    }

    /*
    =================================================
    Input Collection
    =================================================
    */

    collectInputs(requirement) {
        const inputs = [];
        const featureInputNames = new Set();

        /*
        Feature-level inputs take precedence over common definitions.
        */

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                const featureInputs = Array.isArray(feature.inputs) ? feature.inputs : [];

                featureInputs.forEach(input => {
                    const inputName = this.normalizeText(input?.name);

                    if (inputName) {
                        featureInputNames.add(inputName);
                    }
                });

                this.mergeInputs(inputs, featureInputs, {
                    module: requirement.module,

                    feature: feature.name
                });
            });
        }

        /*
        Module-level and legacy inputs remain ownerless when no
        feature-scoped definition with the same name exists.
        */

        this.mergeInputs(inputs, requirement.commonInputs, {
            module: requirement.module,

            feature: "",

            excludedNames: featureInputNames
        });

        this.mergeInputs(inputs, requirement.inputDefinitions, {
            module: requirement.module,

            feature: "",

            excludedNames: featureInputNames
        });

        return inputs;
    }

    mergeInputs(target, source, context = {}) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(input => {
            if (!input) {
                return;
            }

            const inputName = this.normalizeText(input?.name);

            if (context.excludedNames instanceof Set && context.excludedNames.has(inputName)) {
                return;
            }

            const entry = {
                input,

                module: context.module ?? "",

                feature: context.feature ?? ""
            };

            const existed = target.some(currentEntry => this.isSameInput(currentEntry, entry));

            if (!existed) {
                target.push(entry);
            }
        });
    }

    isSameInput(firstEntry, secondEntry) {
        const firstName = this.normalizeText(firstEntry?.input?.name);

        const secondName = this.normalizeText(secondEntry?.input?.name);

        const firstModule = this.normalizeText(firstEntry?.module);

        const secondModule = this.normalizeText(secondEntry?.module);

        const firstFeature = this.normalizeText(firstEntry?.feature);

        const secondFeature = this.normalizeText(secondEntry?.feature);

        return Boolean(
            firstName &&
            secondName &&
            firstName === secondName &&
            firstModule === secondModule &&
            firstFeature === secondFeature
        );
    }

    /*
    =================================================
    Required Validation
    =================================================
    */

    analyzeRequired(input, knowledge, context = {}) {
        if (!input?.required) {
            return;
        }

        this.addUnique(
            knowledge.validationRules,
            this.createValidationCase(
                input,
                context,
                `${input.name} không được để trống`,
                "REQUIRED"
            )
        );

        this.addUnique(
            knowledge.riskAreas,
            this.createValidationCase(input, context, `Thiếu ${input.name}`, "REQUIRED_RISK")
        );
    }

    /*
    =================================================
    Control Type Analysis
    =================================================
    */

    analyzeControlType(input, knowledge, context = {}) {
        const controlType = String(input?.controlType ?? "")
            .trim()
            .toLowerCase();

        if (controlType !== "dropdown" && controlType !== "select") {
            return;
        }

        this.addUnique(
            knowledge.validationRules,
            this.createValidationCase(
                input,
                context,
                `${input.name} phải chọn giá trị hợp lệ`,
                "CONTROL_TYPE"
            )
        );

        this.addUnique(
            knowledge.riskAreas,
            this.createValidationCase(
                input,
                context,
                `${input.name} không thuộc danh mục`,
                "CONTROL_TYPE_RISK"
            )
        );
    }

    /*
    =================================================
    Description Analysis
    =================================================
    */

    analyzeDescription(input, knowledge, context = {}) {
        const description = String(input?.description ?? "")
            .trim()
            .toLowerCase();

        if (!description) {
            return;
        }

        if (description.includes("duy nhất") || description.includes("không trùng")) {
            this.addUnique(
                knowledge.validationRules,
                this.createValidationCase(
                    input,
                    context,
                    `${input.name} phải duy nhất`,
                    "UNIQUENESS"
                )
            );

            this.addUnique(
                knowledge.dataIntegrityCases,
                this.createValidationCase(
                    input,
                    context,
                    `${input.name} bị trùng`,
                    "DATA_INTEGRITY"
                )
            );
        }
    }

    createValidationCase(input, context, content, validationType) {
        return {
            module: context?.module ?? "",

            feature: context?.feature ?? "",

            inputName: input?.name ?? "",

            content,

            source: "INPUT_VALIDATION",

            required: input?.required,

            controlType: input?.controlType,

            dataSource: input?.dataSource,

            description: input?.description,

            validationType
        };
    }

    /*
    =================================================
    Utilities
    =================================================
    */

    getValidationComparisonKey(value) {
        if (!value || typeof value !== "object") {
            return ["", "", "", this.normalizeText(value)].join("|");
        }

        return [
            this.normalizeText(value.module),

            this.normalizeText(value.feature),

            this.normalizeText(value.inputName),

            this.normalizeText(value.content)
        ].join("|");
    }

    addUnique(target, value) {
        if (!Array.isArray(target) || value === undefined || value === null || value === "") {
            return;
        }

        const comparisonKey = this.getValidationComparisonKey(value);

        const existed = target.some(
            currentValue => this.getValidationComparisonKey(currentValue) === comparisonKey
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

export default InputAnalyzer;
