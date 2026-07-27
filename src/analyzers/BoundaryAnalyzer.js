class BoundaryAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        const inputs = this.collectInputs(requirement);

        inputs.forEach(input => {
            this.analyzeLength(input, knowledge);

            this.analyzeValue(input, knowledge);
        });
    }

    /*
    =================================================
    Input Collection
    =================================================
    */

    collectInputs(requirement) {
        const inputs = [];

        this.mergeInputs(inputs, requirement.commonInputs);

        this.mergeInputs(inputs, requirement.inputDefinitions);

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
    Length Boundary Analysis
    =================================================
    */

    analyzeLength(input, knowledge) {
        const validation = this.getValidation(input);

        if (this.hasBoundaryValue(validation.minLength)) {
            this.addUnique(knowledge.boundaryCases, `${input.name} nhỏ hơn độ dài tối thiểu`);

            this.addUnique(
                knowledge.boundaryCases,
                `${input.name} có độ dài bằng giá trị tối thiểu`
            );
        }

        if (this.hasBoundaryValue(validation.maxLength)) {
            this.addUnique(knowledge.boundaryCases, `${input.name} có độ dài bằng giá trị tối đa`);

            this.addUnique(knowledge.boundaryCases, `${input.name} vượt quá độ dài tối đa`);
        }
    }

    /*
    =================================================
    Numeric Boundary Analysis
    =================================================
    */

    analyzeValue(input, knowledge) {
        const validation = this.getValidation(input);

        if (this.hasBoundaryValue(validation.minValue)) {
            this.addUnique(knowledge.boundaryCases, `${input.name} nhỏ hơn giá trị tối thiểu`);

            this.addUnique(knowledge.boundaryCases, `${input.name} bằng giá trị tối thiểu`);
        }

        if (this.hasBoundaryValue(validation.maxValue)) {
            this.addUnique(knowledge.boundaryCases, `${input.name} bằng giá trị tối đa`);

            this.addUnique(knowledge.boundaryCases, `${input.name} lớn hơn giá trị tối đa`);
        }
    }

    /*
    =================================================
    Validation Normalization
    =================================================
    */

    getValidation(input) {
        const validation = input?.validation;

        if (validation && typeof validation === "object") {
            return validation;
        }

        /*
        Hỗ trợ cấu trúc cũ trong trường hợp các thuộc tính
        boundary nằm trực tiếp trên input.
        */

        return {
            minLength: input?.minLength ?? null,

            maxLength: input?.maxLength ?? null,

            minValue: input?.minValue ?? null,

            maxValue: input?.maxValue ?? null
        };
    }

    hasBoundaryValue(value) {
        return value !== undefined && value !== null && value !== "";
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

export default BoundaryAnalyzer;
