class InputAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        const inputs = this.collectInputs(requirement);

        inputs.forEach(input => {
            this.analyzeRequired(input, knowledge);

            this.analyzeControlType(input, knowledge);

            this.analyzeDescription(input, knowledge);
        });
    }

    /*
    =================================================
    Input Collection
    =================================================
    */

    collectInputs(requirement) {
        const inputs = [];

        /*
        Module-level inputs
        */

        this.mergeInputs(inputs, requirement.commonInputs);

        /*
        Compatibility with old pipeline
        */

        this.mergeInputs(inputs, requirement.inputDefinitions);

        /*
        Feature-level inputs
        */

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                this.mergeInputs(inputs, feature.inputs);
            });
        }

        return inputs;
    }

    mergeInputs(target, source) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(input => {
            if (!input) {
                return;
            }

            const existed = target.some(currentInput => this.isSameInput(currentInput, input));

            if (!existed) {
                target.push(input);
            }
        });
    }

    isSameInput(firstInput, secondInput) {
        const firstName = String(firstInput?.name ?? "")
            .trim()
            .toLowerCase();

        const secondName = String(secondInput?.name ?? "")
            .trim()
            .toLowerCase();

        return Boolean(firstName && secondName && firstName === secondName);
    }

    /*
    =================================================
    Required Validation
    =================================================
    */

    analyzeRequired(input, knowledge) {
        if (!input?.required) {
            return;
        }

        this.addUnique(knowledge.validationRules, `${input.name} không được để trống`);

        this.addUnique(knowledge.riskAreas, `Thiếu ${input.name}`);
    }

    /*
    =================================================
    Control Type Analysis
    =================================================
    */

    analyzeControlType(input, knowledge) {
        const controlType = String(input?.controlType ?? "")
            .trim()
            .toLowerCase();

        if (controlType !== "dropdown" && controlType !== "select") {
            return;
        }

        this.addUnique(knowledge.validationRules, `${input.name} phải chọn giá trị hợp lệ`);

        this.addUnique(knowledge.riskAreas, `${input.name} không thuộc danh mục`);
    }

    /*
    =================================================
    Description Analysis
    =================================================
    */

    analyzeDescription(input, knowledge) {
        const description = String(input?.description ?? "")
            .trim()
            .toLowerCase();

        if (!description) {
            return;
        }

        if (description.includes("duy nhất") || description.includes("không trùng")) {
            this.addUnique(knowledge.validationRules, `${input.name} phải duy nhất`);

            this.addUnique(knowledge.dataIntegrityCases, `${input.name} bị trùng`);
        }
    }

    /*
    =================================================
    Utilities
    =================================================
    */

    addUnique(target, value) {
        if (!Array.isArray(target) || value === undefined || value === null || value === "") {
            return;
        }

        const normalizedValue = String(value).trim().toLowerCase();

        const existed = target.some(
            currentValue =>
                String(currentValue ?? "")
                    .trim()
                    .toLowerCase() === normalizedValue
        );

        if (!existed) {
            target.push(value);
        }
    }
}

export default InputAnalyzer;
