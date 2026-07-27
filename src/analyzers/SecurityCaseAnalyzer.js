class SecurityCaseAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        this.analyzeInputs(requirement, knowledge);

        this.analyzeActions(requirement, knowledge);
    }

    /*
    =================================================
    Input Security Analysis
    =================================================
    */

    analyzeInputs(requirement, knowledge) {
        const inputs = this.collectInputs(requirement);

        inputs.forEach(entry => {
            const input = entry.input;
            const inputName = this.normalizeText(input?.name);

            if (!inputName) {
                return;
            }

            const normalizedName = inputName.toLowerCase();

            const format = this.normalizeText(input?.format).toLowerCase();

            const controlType = this.normalizeText(input?.controlType).toLowerCase();

            const description = this.normalizeText(input?.description).toLowerCase();

            /*
            Password / Secret fields
            */

            if (
                normalizedName.includes("mật khẩu") ||
                normalizedName.includes("password") ||
                normalizedName.includes("secret") ||
                normalizedName.includes("token")
            ) {
                this.addUnique(
                    knowledge.securityCases,
                    this.createSecurityCase(
                        input,
                        entry,
                        `${inputName} cần kiểm tra bảo mật`,
                        "SENSITIVE_FIELD"
                    )
                );
            }

            /*
            Free-text input fields may contain dangerous payloads.
            */

            if (
                format === "html" ||
                format === "text" ||
                format === "string" ||
                controlType === "textbox" ||
                controlType === "textarea" ||
                description.includes("nội dung")
            ) {
                this.addUnique(
                    knowledge.securityCases,
                    this.createSecurityCase(
                        input,
                        entry,
                        `${inputName} cần kiểm tra dữ liệu nhập nguy hiểm`,
                        "MALICIOUS_INPUT"
                    )
                );
            }

            /*
            Login/account-related inputs
            */

            if (
                normalizedName.includes("tài khoản") ||
                normalizedName.includes("username") ||
                normalizedName.includes("email")
            ) {
                this.addUnique(
                    knowledge.securityCases,
                    this.createSecurityCase(
                        input,
                        entry,
                        `${inputName} cần kiểm tra dữ liệu đăng nhập bất thường`,
                        "ABNORMAL_LOGIN_INPUT"
                    )
                );
            }

            /*
            Verification / CAPTCHA-related fields
            */

            if (
                normalizedName.includes("mã xác nhận") ||
                normalizedName.includes("captcha") ||
                normalizedName.includes("otp")
            ) {
                this.addUnique(
                    knowledge.securityCases,
                    this.createSecurityCase(
                        input,
                        entry,
                        `${inputName} cần kiểm tra khả năng bỏ qua xác thực`,
                        "AUTHENTICATION_BYPASS"
                    )
                );
            }
        });
    }

    collectInputs(requirement) {
        const inputs = [];
        const featureInputNames = new Set();
        const moduleInputs = [
            ...(Array.isArray(requirement.commonInputs) ? requirement.commonInputs : []),

            ...(Array.isArray(requirement.inputDefinitions) ? requirement.inputDefinitions : [])
        ];

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                const featureInputs = Array.isArray(feature.inputs)
                    ? feature.inputs.map(input => {
                          const moduleInput = moduleInputs.find(
                              candidate =>
                                  this.normalizeForComparison(candidate?.name) ===
                                  this.normalizeForComparison(input?.name)
                          );

                          const mergedInput = {
                              ...(moduleInput ?? {}),

                              ...input
                          };

                          mergedInput.controlType =
                              this.normalizeText(input?.controlType) ||
                              moduleInput?.controlType ||
                              "";

                          mergedInput.dataSource =
                              this.normalizeText(input?.dataSource) ||
                              moduleInput?.dataSource ||
                              "";

                          mergedInput.format =
                              this.normalizeText(input?.format) || moduleInput?.format || "";

                          return mergedInput;
                      })
                    : [];

                featureInputs.forEach(input => {
                    const inputName = this.normalizeForComparison(input?.name);

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

            const inputName = this.normalizeForComparison(input.name);

            if (!inputName) {
                return;
            }

            if (context.excludedNames instanceof Set && context.excludedNames.has(inputName)) {
                return;
            }

            const entry = {
                input,

                module: context.module ?? "",

                feature: context.feature ?? ""
            };

            const existed = target.some(currentEntry => {
                return (
                    this.normalizeForComparison(currentEntry?.input?.name) === inputName &&
                    this.normalizeForComparison(currentEntry?.module) ===
                        this.normalizeForComparison(entry.module) &&
                    this.normalizeForComparison(currentEntry?.feature) ===
                        this.normalizeForComparison(entry.feature)
                );
            });

            if (!existed) {
                target.push(entry);
            }
        });
    }

    /*
    =================================================
    Action Security Analysis
    =================================================
    */

    analyzeActions(requirement, knowledge) {
        const actions = this.collectActions(requirement);

        actions.forEach(entry => {
            const normalizedAction = this.normalizeForComparison(entry.action);

            if (!normalizedAction) {
                return;
            }

            if (normalizedAction.includes("xóa") || normalizedAction.includes("delete")) {
                this.addUnique(
                    knowledge.securityCases,
                    this.createActionSecurityCase(
                        entry,
                        "Kiểm tra quyền xóa dữ liệu",
                        "DELETE_PERMISSION"
                    )
                );
            }

            if (
                normalizedAction.includes("sửa") ||
                normalizedAction.includes("cập nhật") ||
                normalizedAction.includes("update") ||
                normalizedAction.includes("edit")
            ) {
                this.addUnique(
                    knowledge.securityCases,
                    this.createActionSecurityCase(
                        entry,
                        "Kiểm tra quyền chỉnh sửa dữ liệu",
                        "EDIT_PERMISSION"
                    )
                );
            }

            if (normalizedAction.includes("đăng nhập") || normalizedAction.includes("login")) {
                this.addUnique(
                    knowledge.securityCases,
                    this.createActionSecurityCase(
                        entry,
                        "Kiểm tra chống dò mật khẩu và đăng nhập lặp lại",
                        "BRUTE_FORCE"
                    )
                );

                this.addUnique(
                    knowledge.securityCases,
                    this.createActionSecurityCase(
                        entry,
                        "Kiểm tra quản lý phiên đăng nhập",
                        "SESSION_MANAGEMENT"
                    )
                );
            }

            if (
                normalizedAction.includes("thêm") ||
                normalizedAction.includes("tạo") ||
                normalizedAction.includes("create") ||
                normalizedAction.includes("add")
            ) {
                this.addUnique(
                    knowledge.securityCases,
                    this.createActionSecurityCase(
                        entry,
                        "Kiểm tra dữ liệu đầu vào trước khi tạo mới",
                        "CREATE_INPUT_VALIDATION"
                    )
                );
            }
        });
    }

    collectActions(requirement) {
        const actions = [];
        const featureActions = new Set();

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                const scopedActions = [feature.name, feature.automation?.operation].filter(Boolean);

                scopedActions.forEach(action => {
                    featureActions.add(this.normalizeForComparison(action));
                });

                this.mergeActions(actions, scopedActions, {
                    module: requirement.module,

                    feature: feature.name
                });
            });
        }

        this.mergeActions(actions, requirement.actions, {
            module: requirement.module,

            feature: "",

            excludedActions: featureActions
        });

        if (actions.length === 0 && requirement.feature) {
            this.mergeActions(actions, [requirement.feature], {
                module: requirement.module,

                feature: ""
            });
        }

        return actions;
    }

    mergeActions(target, source, context = {}) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(action => {
            const normalizedAction = this.normalizeText(action);
            const comparisonAction = this.normalizeForComparison(action);

            if (!normalizedAction) {
                return;
            }

            if (
                context.excludedActions instanceof Set &&
                context.excludedActions.has(comparisonAction)
            ) {
                return;
            }

            const entry = {
                action: normalizedAction,

                module: context.module ?? "",

                feature: context.feature ?? ""
            };

            const existed = target.some(currentEntry => {
                return (
                    this.normalizeForComparison(currentEntry?.action) === comparisonAction &&
                    this.normalizeForComparison(currentEntry?.module) ===
                        this.normalizeForComparison(entry.module) &&
                    this.normalizeForComparison(currentEntry?.feature) ===
                        this.normalizeForComparison(entry.feature)
                );
            });

            if (!existed) {
                target.push(entry);
            }
        });
    }

    createSecurityCase(input, context, content, securityType) {
        return {
            module: context?.module ?? "",

            feature: context?.feature ?? "",

            inputName: input?.name ?? "",

            content,

            source: "SECURITY_ANALYSIS",

            securityType,

            controlType: input?.controlType,

            dataSource: input?.dataSource,

            description: input?.description,

            required: input?.required,

            validationType: input?.validationType,

            severity: input?.severity,

            priority: input?.priority,

            riskCategory: input?.riskCategory,

            requirementReference: input?.requirementReference
        };
    }

    createActionSecurityCase(context, content, securityType) {
        return {
            module: context?.module ?? "",

            feature: context?.feature ?? "",

            inputName: "",

            content,

            source: "SECURITY_ANALYSIS",

            securityType
        };
    }

    /*
    =================================================
    Utilities
    =================================================
    */

    getSecurityComparisonKey(value) {
        if (!value || typeof value !== "object") {
            return ["", "", "", this.normalizeForComparison(value), ""].join("|");
        }

        return [
            this.normalizeForComparison(value.module),

            this.normalizeForComparison(value.feature),

            this.normalizeForComparison(value.inputName),

            this.normalizeForComparison(value.content),

            this.normalizeForComparison(value.securityType)
        ].join("|");
    }

    addUnique(target, value) {
        if (!Array.isArray(target) || !value) {
            return;
        }

        const comparisonKey = this.getSecurityComparisonKey(value);

        const existed = target.some(item => this.getSecurityComparisonKey(item) === comparisonKey);

        if (!existed) {
            target.push(value && typeof value === "object" ? value : this.normalizeText(value));
        }
    }

    normalizeText(value) {
        if (value === undefined || value === null) {
            return "";
        }

        return String(value).replace(/\s+/g, " ").trim();
    }

    normalizeForComparison(value) {
        return this.normalizeText(value).toLowerCase();
    }
}

export default SecurityCaseAnalyzer;
