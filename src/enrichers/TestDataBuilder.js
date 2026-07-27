class TestDataBuilder {
    build(context = {}) {
        const testData = this.normalizeExistingTestData(context?.existing?.testData);
        const rule = this.detectRule(context);

        switch (rule) {
            case "REQUIRED":
                this.buildRequiredFieldData(testData, context);
                break;

            case "DUPLICATE":
                this.buildDuplicateData(testData, context);
                break;

            case "INVALID_OPTION":
                this.buildInvalidOptionData(testData, context);
                break;

            case "DELETE_BLOCKED":
                this.buildDeleteBlockedData(testData, context);
                break;

            case "PERMISSION_DENIED":
                this.buildPermissionDeniedData(testData, context);
                break;

            case "SECURITY":
                this.buildSecurityData(testData, context);
                break;

            case "EMPTY_SEARCH":
                this.buildEmptySearchData(testData);
                break;

            case "POSITIVE":
                this.buildPositiveData(testData, context);
                break;

            case "GENERIC_NEGATIVE":
                this.setIfMissing(
                    testData.expected,
                    "scenarioCondition",
                    context?.sourceItem?.content ?? context?.identity?.title ?? ""
                );
                break;

            default:
                break;
        }

        return testData;
    }

    normalizeExistingTestData(existingTestData) {
        const existing =
            existingTestData &&
            typeof existingTestData === "object" &&
            !Array.isArray(existingTestData)
                ? this.cloneValue(existingTestData)
                : {};
        const legacyValid = this.isPlainObject(existing.valid) ? existing.valid : {};
        const currentInputs = this.isPlainObject(existing.inputs) ? existing.inputs : {};

        return {
            inputs: {
                ...legacyValid,

                ...currentInputs
            },

            invalid: this.isPlainObject(existing.invalid) ? existing.invalid : {},

            expected: this.isPlainObject(existing.expected) ? existing.expected : {}
        };
    }

    detectRule(context) {
        const source = this.normalizeForComparison(context?.sourceItem?.source);
        const validationType = this.normalizeForComparison(context?.sourceItem?.validationType);
        const securityType = this.normalizeForComparison(context?.sourceItem?.securityType);
        const permissionType = this.normalizeForComparison(context?.sourceItem?.permissionType);
        const code = this.normalizeForComparison(context?.sourceItem?.code);
        const content = this.normalizeForComparison(
            context?.sourceItem?.content ?? context?.identity?.title
        );
        const operationType = this.normalizeForComparison(context?.operation?.type);
        const scenarioType = this.normalizeForComparison(context?.identity?.type);

        if (source === "permission_analysis" || permissionType) {
            return "PERMISSION_DENIED";
        }

        if (
            source === "security_analysis" &&
            (securityType.includes("malicious") ||
                securityType.includes("injection") ||
                content.includes("nguy hiểm"))
        ) {
            return "SECURITY";
        }

        if (
            validationType === "required" ||
            validationType.includes("missing") ||
            content.includes("không được để trống") ||
            content.includes("bỏ trống")
        ) {
            return "REQUIRED";
        }

        if (
            code === "br06" ||
            validationType.includes("unique") ||
            validationType.includes("duplicate") ||
            content.includes("trùng") ||
            content.includes("duy nhất")
        ) {
            return "DUPLICATE";
        }

        if (
            validationType.includes("invalid_option") ||
            validationType.includes("control_type") ||
            content.includes("không thuộc danh mục") ||
            (content.includes("không hợp lệ") &&
                this.findRelevantInput(context, input => this.isDropdown(input)))
        ) {
            return "INVALID_OPTION";
        }

        if (
            operationType === "delete" &&
            (code === "ex17" ||
                content.includes("đang được sử dụng") ||
                content.includes("dữ liệu liên quan") ||
                content.includes("in use"))
        ) {
            return "DELETE_BLOCKED";
        }

        if (
            operationType === "search" &&
            (content.includes("không nhập điều kiện") ||
                content.includes("không có điều kiện") ||
                content.includes("điều kiện trống") ||
                content.includes("empty condition"))
        ) {
            return "EMPTY_SEARCH";
        }

        if (scenarioType === "positive") {
            return "POSITIVE";
        }

        if (
            scenarioType === "negative" ||
            scenarioType === "security" ||
            scenarioType === "permission" ||
            scenarioType === "data_integrity"
        ) {
            return "GENERIC_NEGATIVE";
        }

        return "";
    }

    buildRequiredFieldData(testData, context) {
        const input = this.findRelevantInput(context);
        const inputName = context?.sourceItem?.inputName || input?.name || "";

        this.populateValidRequiredInputs(testData, context, inputName);

        if (this.isKnownInputName(context, inputName)) {
            this.setIfMissing(testData.invalid, inputName, "");
        }

        this.setIfMissing(testData.expected, "validationField", inputName);
        this.setIfMissing(testData.expected, "validationType", "REQUIRED");
    }

    buildDuplicateData(testData, context) {
        const input = this.findRelevantInput(context, candidate => {
            const name = this.normalizeForComparison(candidate?.name);
            const description = this.normalizeForComparison(candidate?.description);

            return (
                name.includes("mã") ||
                description.includes("trùng") ||
                description.includes("duy nhất")
            );
        });
        const inputName = context?.sourceItem?.inputName || input?.name || "";

        this.populateValidRequiredInputs(testData, context, inputName);

        if (this.isKnownInputName(context, inputName)) {
            this.setIfMissing(testData.invalid, inputName, "DEVICE_EXISTING_001");
        }

        const updateSelector = this.findInput(context, candidate => {
            const name = this.normalizeForComparison(candidate?.name);

            return name.includes("cần sửa") || name.includes("hiện tại");
        });

        if (updateSelector?.name) {
            this.setIfMissing(testData.inputs, updateSelector.name, "DEVICE_EXISTING_001");
        }

        this.setIfMissing(testData.expected, "validationField", inputName);
        this.setIfMissing(testData.expected, "validationType", "DUPLICATE");
        this.setIfMissing(testData.expected, "existingValue", true);
    }

    buildInvalidOptionData(testData, context) {
        const input = this.findRelevantInput(context, candidate => this.isDropdown(candidate));
        const inputName = context?.sourceItem?.inputName || input?.name || "";

        this.populateValidRequiredInputs(testData, context, inputName);

        if (this.isKnownInputName(context, inputName)) {
            this.setIfMissing(testData.invalid, inputName, "__INVALID_OPTION__");
        }

        this.setIfMissing(testData.expected, "validationField", inputName);
        this.setIfMissing(testData.expected, "validationType", "INVALID_OPTION");
    }

    buildDeleteBlockedData(testData, context) {
        const entityInput = this.findInput(context, input => {
            const name = this.normalizeForComparison(input?.name);

            return name.includes("cần xóa") || name.includes("cần xoá");
        });

        if (entityInput?.name) {
            this.setIfMissing(testData.inputs, entityInput.name, "DEVICE_IN_USE_001");
        }

        this.setIfMissing(testData.expected, "entityState", "IN_USE");
        this.setIfMissing(testData.expected, "operationAllowed", false);
    }

    buildPermissionDeniedData(testData, context) {
        this.setIfMissing(testData.inputs, "userContext", {
            authenticated: true,

            permissions: []
        });
        this.setIfMissing(testData.expected, "permissionAllowed", false);
        this.setIfMissing(
            testData.expected,
            "permissionType",
            context?.sourceItem?.permissionType ?? ""
        );
    }

    buildSecurityData(testData, context) {
        const input = this.findRelevantInput(context);
        const inputName = context?.sourceItem?.inputName || input?.name || "";

        if (this.isKnownInputName(context, inputName)) {
            this.setIfMissing(testData.invalid, inputName, "<script>alert(1)</script>");
        }

        this.setIfMissing(
            testData.expected,
            "securityType",
            context?.sourceItem?.securityType ?? ""
        );
        this.setIfMissing(testData.expected, "scriptExecuted", false);
    }

    buildEmptySearchData(testData) {
        this.setIfMissing(testData.expected, "searchConditionState", "EMPTY");
    }

    buildPositiveData(testData, context) {
        if (
            Object.keys(testData.inputs).length === 0 &&
            Object.keys(testData.invalid).length === 0 &&
            Object.keys(testData.expected).length === 0
        ) {
            this.populateValidRequiredInputs(testData, context);
        }
    }

    populateValidRequiredInputs(testData, context, excludedInputName = "") {
        const excluded = this.normalizeForComparison(excludedInputName);
        const inputs = Array.isArray(context?.inputs) ? context.inputs : [];

        inputs.forEach(input => {
            const inputName = this.normalizeText(input?.name);

            if (
                !inputName ||
                !input?.required ||
                this.normalizeForComparison(inputName) === excluded
            ) {
                return;
            }

            this.setIfMissing(testData.inputs, inputName, this.createValidValue(input, context));
        });
    }

    createValidValue(input, context) {
        const name = this.normalizeForComparison(input?.name);
        const controlType = this.normalizeForComparison(input?.controlType);
        const operationType = this.normalizeForComparison(context?.operation?.type);

        if (name.includes("cần sửa") || name.includes("cần xóa") || name.includes("cần xoá")) {
            return "DEVICE_EXISTING_001";
        }

        if (this.isDropdown(input)) {
            const dataSource = this.normalizeText(input?.dataSource);

            return dataSource ? `${dataSource} - giá trị hợp lệ` : "__VALID_OPTION__";
        }

        if (name.includes("mã") || name.includes("code")) {
            return operationType === "update" ? "CODE_UPDATED_001" : "DEVICE_NEW_001";
        }

        if (name.includes("tên") || name.includes("name")) {
            return "Thiết bị kiểm thử";
        }

        if (name.includes("ghi chú") || name.includes("note")) {
            return "Dữ liệu kiểm thử hợp lệ";
        }

        if (controlType.includes("date")) {
            return "2026-01-01";
        }

        if (controlType.includes("number")) {
            return 1;
        }

        return "VALID_VALUE";
    }

    findRelevantInput(context, predicate) {
        const sourceInputName = this.normalizeForComparison(context?.sourceItem?.inputName);

        if (sourceInputName) {
            const sourceInput = this.findInput(context, input => {
                return this.normalizeForComparison(input?.name) === sourceInputName;
            });

            if (sourceInput) {
                return sourceInput;
            }
        }

        const content = this.normalizeForComparison(
            context?.sourceItem?.content ?? context?.identity?.title
        );
        const contentInput = this.findInput(context, input => {
            const inputName = this.normalizeForComparison(input?.name);

            return inputName && content.includes(inputName);
        });

        if (contentInput) {
            return contentInput;
        }

        return this.findInput(context, predicate);
    }

    findInput(context, predicate) {
        const inputs = Array.isArray(context?.inputs) ? context.inputs : [];

        if (typeof predicate === "function") {
            return inputs.find(predicate) ?? null;
        }

        return inputs[0] ?? null;
    }

    isKnownInputName(context, inputName) {
        const normalizedName = this.normalizeForComparison(inputName);

        if (!normalizedName) {
            return false;
        }

        if (this.normalizeForComparison(context?.sourceItem?.inputName) === normalizedName) {
            return true;
        }

        return Boolean(
            this.findInput(context, input => {
                return this.normalizeForComparison(input?.name) === normalizedName;
            })
        );
    }

    isDropdown(input) {
        const controlType = this.normalizeForComparison(input?.controlType);

        return controlType === "dropdown" || controlType === "select";
    }

    setIfMissing(target, key, value) {
        if (!this.isPlainObject(target) || !key) {
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(target, key)) {
            target[key] = this.cloneValue(value);
        }
    }

    isPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return false;
        }

        const prototype = Object.getPrototypeOf(value);

        return prototype === Object.prototype || prototype === null;
    }

    cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item));
        }

        if (this.isPlainObject(value)) {
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

export default TestDataBuilder;
