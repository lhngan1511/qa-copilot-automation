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

        inputs.forEach(input => {
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
                this.addUnique(knowledge.securityCases, `${inputName} cần kiểm tra bảo mật`);
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
                    `${inputName} cần kiểm tra dữ liệu nhập nguy hiểm`
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
                    `${inputName} cần kiểm tra dữ liệu đăng nhập bất thường`
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
                    `${inputName} cần kiểm tra khả năng bỏ qua xác thực`
                );
            }
        });
    }

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

            const inputName = this.normalizeText(input.name).toLowerCase();

            if (!inputName) {
                return;
            }

            const existed = target.some(currentInput => {
                return this.normalizeText(currentInput?.name).toLowerCase() === inputName;
            });

            if (!existed) {
                target.push(input);
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

        actions.forEach(action => {
            const normalizedAction = this.normalizeText(action).toLowerCase();

            if (!normalizedAction) {
                return;
            }

            if (normalizedAction.includes("xóa") || normalizedAction.includes("delete")) {
                this.addUnique(knowledge.securityCases, "Kiểm tra quyền xóa dữ liệu");
            }

            if (
                normalizedAction.includes("sửa") ||
                normalizedAction.includes("cập nhật") ||
                normalizedAction.includes("update") ||
                normalizedAction.includes("edit")
            ) {
                this.addUnique(knowledge.securityCases, "Kiểm tra quyền chỉnh sửa dữ liệu");
            }

            if (normalizedAction.includes("đăng nhập") || normalizedAction.includes("login")) {
                this.addUnique(
                    knowledge.securityCases,
                    "Kiểm tra chống dò mật khẩu và đăng nhập lặp lại"
                );

                this.addUnique(knowledge.securityCases, "Kiểm tra quản lý phiên đăng nhập");
            }

            if (
                normalizedAction.includes("thêm") ||
                normalizedAction.includes("tạo") ||
                normalizedAction.includes("create") ||
                normalizedAction.includes("add")
            ) {
                this.addUnique(
                    knowledge.securityCases,
                    "Kiểm tra dữ liệu đầu vào trước khi tạo mới"
                );
            }
        });
    }

    collectActions(requirement) {
        const actions = [];

        this.mergeActions(actions, requirement.actions);

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                if (feature.name) {
                    this.mergeActions(actions, [feature.name]);
                }

                const operation = feature.automation?.operation;

                if (operation) {
                    this.mergeActions(actions, [operation]);
                }
            });
        }

        if (actions.length === 0 && requirement.feature) {
            this.mergeActions(actions, [requirement.feature]);
        }

        return actions;
    }

    mergeActions(target, source) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(action => {
            const normalizedAction = this.normalizeText(action);

            if (!normalizedAction) {
                return;
            }

            const existed = target.some(currentAction => {
                return (
                    this.normalizeText(currentAction).toLowerCase() ===
                    normalizedAction.toLowerCase()
                );
            });

            if (!existed) {
                target.push(normalizedAction);
            }
        });
    }

    /*
    =================================================
    Utilities
    =================================================
    */

    addUnique(target, value) {
        if (!Array.isArray(target) || !value) {
            return;
        }

        const normalizedValue = this.normalizeText(value).toLowerCase();

        if (!normalizedValue) {
            return;
        }

        const existed = target.some(item => {
            return this.normalizeText(item).toLowerCase() === normalizedValue;
        });

        if (!existed) {
            target.push(this.normalizeText(value));
        }
    }

    normalizeText(value) {
        if (value === undefined || value === null) {
            return "";
        }

        return String(value).replace(/\s+/g, " ").trim();
    }
}

export default SecurityCaseAnalyzer;
