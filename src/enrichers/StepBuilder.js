class StepBuilder {
    build({ context = {}, testData = {} } = {}) {
        const existingSteps = context?.existing?.steps;

        if (this.hasDetailedExistingSteps(existingSteps, context)) {
            return this.renumberSteps(
                this.removeDuplicateSteps(this.normalizeExistingSteps(existingSteps))
            );
        }

        const operationType = this.resolveOperationType(context);
        const rule = this.resolveRule(testData);
        const steps = [];
        const userContext = testData?.inputs?.userContext;

        if (userContext !== undefined && userContext !== null) {
            steps.push(this.buildUserContextStep(userContext));
        }

        steps.push(...this.buildPreconditionSteps(context, testData));
        steps.push(this.buildOpenStep(context));

        const selector = this.findRecordSelector(context, testData, operationType);
        if (selector) {
            steps.push(this.buildRecordSelectionStep(selector));
        }

        if (rule === "EMPTY_SEARCH") {
            steps.push(this.buildEmptySearchStep(context));
        } else {
            steps.push(...this.buildValidInputSteps(context, testData, selector?.inputName));
            steps.push(...this.buildInvalidInputSteps(context, testData));
        }

        steps.push(this.buildOperationStep(context, operationType));

        if (operationType === "DELETE" && this.requiresConfirmation(context)) {
            steps.push(this.buildConfirmationStep(context));
        }

        steps.push(this.buildVerificationStep(context, testData, rule));

        return this.renumberSteps(this.removeDuplicateSteps(steps));
    }

    hasDetailedExistingSteps(steps, context) {
        if (!Array.isArray(steps) || steps.length === 0) {
            return false;
        }

        const normalized = this.normalizeExistingSteps(steps);
        return (
            normalized.length > 0 && normalized.every(step => !this.isGenericStep(step, context))
        );
    }

    normalizeExistingSteps(steps) {
        if (!Array.isArray(steps)) {
            return [];
        }

        return steps
            .map((step, index) => {
                if (typeof step === "string") {
                    return this.createStep(index + 1, step);
                }

                if (!step || typeof step !== "object") {
                    return null;
                }

                const action = this.firstNonEmpty(step.description, step.action) || "";

                if (!action) {
                    return null;
                }

                return this.createStep(
                    index + 1,
                    action,
                    step.target ?? "",
                    this.cloneValue(step.value ?? ""),
                    step.expected ?? step.expectedResult ?? ""
                );
            })
            .filter(Boolean);
    }

    isGenericStep(step, context) {
        const text = this.normalizeText(step?.action);
        const feature = this.normalizeText(context?.feature?.name ?? context?.identity?.feature);
        const title = this.normalizeText(context?.identity?.title);
        const exactGenericSteps = new Set([
            "open feature",
            "open screen",
            "prepare data",
            "prepare scenario",
            "perform action",
            "execute feature",
            "verify actual result",
            "kiểm tra kết quả thực tế",
            "chuẩn bị dữ liệu",
            "chuẩn bị tình huống"
        ]);

        if (exactGenericSteps.has(text)) {
            return true;
        }

        if (
            text.startsWith("chuẩn bị dữ liệu cho tình huống") ||
            text.startsWith("prepare data for scenario")
        ) {
            return true;
        }

        const genericFeatureSteps = [
            feature && `mở chức năng ${feature}`,
            feature && `thực hiện ${feature}`,
            title && `chuẩn bị dữ liệu cho tình huống ${title}`
        ].filter(Boolean);

        return genericFeatureSteps.includes(text);
    }

    resolveOperationType(context) {
        const explicit = this.normalizeOperation(
            context?.operation?.type ?? context?.operation?.name
        );

        if (explicit !== "UNKNOWN") {
            return explicit;
        }

        const source = this.normalizeText(
            [
                context?.sourceItem?.operation,
                context?.sourceItem?.action,
                context?.feature?.name,
                context?.identity?.feature,
                context?.identity?.title
            ]
                .filter(Boolean)
                .join(" ")
        );

        const mappings = [
            ["CHANGE_PASSWORD", ["change password", "đổi mật khẩu"]],
            ["RESET_PASSWORD", ["reset password", "đặt lại mật khẩu"]],
            ["AUTHENTICATE", ["authenticate", "xác thực"]],
            ["LOGIN", ["login", "đăng nhập"]],
            ["LOGOUT", ["logout", "đăng xuất"]],
            ["APPROVE", ["approve", "phê duyệt", "duyệt"]],
            ["REJECT", ["reject", "từ chối"]],
            ["UPLOAD", ["upload", "tải lên"]],
            ["DOWNLOAD", ["download", "tải xuống"]],
            ["DELETE", ["delete", "xóa", "xoá"]],
            ["UPDATE", ["update", "edit", "sửa", "cập nhật"]],
            ["CREATE", ["create", "add", "thêm", "tạo"]],
            ["SEARCH", ["search", "tìm kiếm", "tra cứu"]],
            ["VIEW", ["view", "xem"]]
        ];

        for (const [type, keywords] of mappings) {
            if (keywords.some(keyword => source.includes(keyword))) {
                return type;
            }
        }

        return "UNKNOWN";
    }

    normalizeOperation(value) {
        const normalized = String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_");
        const aliases = {
            ADD: "CREATE",
            EDIT: "UPDATE",
            REMOVE: "DELETE",
            FIND: "SEARCH",
            READ: "VIEW",
            SIGN_IN: "LOGIN",
            SIGN_OUT: "LOGOUT"
        };
        const supported = new Set([
            "CREATE",
            "UPDATE",
            "DELETE",
            "SEARCH",
            "VIEW",
            "LOGIN",
            "LOGOUT",
            "AUTHENTICATE",
            "CHANGE_PASSWORD",
            "RESET_PASSWORD",
            "APPROVE",
            "REJECT",
            "UPLOAD",
            "DOWNLOAD"
        ]);
        const resolved = aliases[normalized] ?? normalized;

        return supported.has(resolved) ? resolved : "UNKNOWN";
    }

    resolveRule(testData) {
        const expected = testData?.expected ?? {};
        const validationType = this.normalizeText(expected.validationType ?? expected.type);
        const securityType = this.normalizeText(expected.securityType);

        if (expected.permissionAllowed === false) return "PERMISSION";
        if (expected.scriptExecuted === false || securityType) return "SECURITY";
        if (
            expected.operationAllowed === false &&
            this.normalizeText(expected.entityState).includes("in_use")
        ) {
            return "DELETE_BLOCKED";
        }
        if (
            expected.emptySearch === true ||
            expected.searchCondition === "EMPTY" ||
            expected.searchConditionState === "EMPTY" ||
            validationType.includes("empty_search")
        ) {
            return "EMPTY_SEARCH";
        }
        if (validationType.includes("required")) return "REQUIRED";
        if (validationType.includes("duplicate")) return "DUPLICATE";
        if (validationType.includes("invalid_option") || validationType.includes("invalid_value")) {
            return "INVALID_OPTION";
        }

        return "DEFAULT";
    }

    buildUserContextStep(userContext) {
        return this.createStep(
            0,
            "Thiết lập ngữ cảnh người dùng",
            "Người dùng",
            this.cloneValue(userContext),
            "Người dùng có đúng trạng thái và quyền kiểm thử"
        );
    }

    buildPreconditionSteps(context, testData) {
        const preconditions = Array.isArray(context?.preconditions) ? context.preconditions : [];
        const hasUserContext =
            testData?.inputs?.userContext !== undefined && testData?.inputs?.userContext !== null;
        const hasEntityState = testData?.expected?.entityState !== undefined;

        return preconditions
            .filter(precondition => {
                const text = this.normalizeText(
                    typeof precondition === "object"
                        ? (precondition.content ?? precondition.description)
                        : precondition
                );

                if (!text) return false;
                if (
                    hasUserContext &&
                    /(đăng nhập|login|người dùng|user|quyền|permission)/i.test(text)
                ) {
                    return false;
                }
                if (hasEntityState && /(đang được sử dụng|in use|trạng thái|state)/i.test(text)) {
                    return false;
                }

                return !/^(đăng nhập|login)$/i.test(text);
            })
            .map(precondition => {
                const value =
                    typeof precondition === "object"
                        ? (precondition.content ?? precondition.description)
                        : precondition;
                return this.createStep(
                    0,
                    "Thiết lập điều kiện trước",
                    this.getFeatureName(context),
                    this.cloneValue(value),
                    "Điều kiện trước được đáp ứng"
                );
            });
    }

    buildOpenStep(context) {
        const screen =
            this.firstNonEmpty(
                context?.operation?.screen,
                context?.feature?.name,
                context?.identity?.feature
            ) || "chức năng cần kiểm thử";

        return this.createStep(
            0,
            "Mở màn hình hoặc chức năng",
            screen,
            "",
            "Màn hình hoặc chức năng được hiển thị"
        );
    }

    findRecordSelector(context, testData, operationType) {
        if (!["UPDATE", "DELETE", "VIEW"].includes(operationType)) {
            return null;
        }

        const inputs = testData?.inputs;
        if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
            return null;
        }

        const candidates = Object.entries(inputs).filter(([name]) => name !== "userContext");
        let bestCandidate = null;
        let bestScore = 0;

        for (const [inputName, value] of candidates) {
            const definition = this.findInputDefinition(context, inputName);
            const searchable = this.normalizeText(
                [
                    inputName,
                    definition?.controlType,
                    definition?.description,
                    definition?.validationType
                ]
                    .filter(Boolean)
                    .join(" ")
            );
            let score = 0;

            if (/(record.?id|entity.?id|selector|record selector)/i.test(searchable)) {
                score += 5;
            }
            if (/(bản ghi|record|đối tượng|entity)/i.test(searchable)) score += 3;
            if (operationType === "UPDATE" && /(sửa|cập nhật|edit|update)/i.test(searchable)) {
                score += 3;
            }
            if (operationType === "DELETE" && /(xóa|xoá|delete)/i.test(searchable)) {
                score += 3;
            }
            if (operationType === "VIEW" && /(xem|view)/i.test(searchable)) {
                score += 3;
            }

            if (score > bestScore) {
                bestScore = score;
                bestCandidate = { inputName, value, definition };
            }
        }

        return bestScore > 0 ? bestCandidate : null;
    }

    buildRecordSelectionStep(selector) {
        return this.createStep(
            0,
            "Chọn bản ghi",
            selector.inputName,
            this.cloneValue(selector.value),
            "Đúng bản ghi cần thao tác được chọn"
        );
    }

    buildValidInputSteps(context, testData, selectedInputName) {
        const inputs = testData?.inputs;
        if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
            return [];
        }

        return Object.entries(inputs)
            .filter(([inputName]) => inputName !== "userContext" && inputName !== selectedInputName)
            .map(([inputName, value]) => {
                const definition = this.findInputDefinition(context, inputName);
                return this.createStep(
                    0,
                    this.resolveInputAction(definition),
                    inputName,
                    this.cloneValue(value),
                    `Trường ${inputName} nhận giá trị đã nhập`
                );
            });
    }

    buildInvalidInputSteps(context, testData) {
        const invalid = testData?.invalid;
        if (!invalid || typeof invalid !== "object" || Array.isArray(invalid)) {
            return [];
        }

        const rule = this.resolveRule(testData);
        return Object.entries(invalid).map(([inputName, value]) => {
            const definition = this.findInputDefinition(context, inputName);
            const actionByRule = {
                REQUIRED: "Để trống trường",
                DUPLICATE: "Nhập dữ liệu đã tồn tại",
                INVALID_OPTION: "Chọn giá trị không hợp lệ",
                SECURITY: "Nhập dữ liệu kiểm thử bảo mật"
            };

            return this.createStep(
                0,
                actionByRule[rule] ?? this.resolveInputAction(definition),
                inputName,
                this.cloneValue(value),
                `Dữ liệu kiểm thử được áp dụng cho trường ${inputName}`
            );
        });
    }

    buildEmptySearchStep(context) {
        return this.createStep(
            0,
            "Để trống tất cả điều kiện tìm kiếm",
            this.getFeatureName(context),
            "",
            "Không có điều kiện tìm kiếm nào được nhập"
        );
    }

    resolveInputAction(definition = {}) {
        const controlType = this.normalizeText(definition?.controlType ?? definition?.type);

        if (/(entity|record).*(selector)|selector.*(entity|record)/i.test(controlType)) {
            return "Chọn bản ghi";
        }
        if (/(dropdown|select|combobox)/i.test(controlType)) return "Chọn giá trị";
        if (/checkbox/i.test(controlType)) return "Thiết lập lựa chọn";
        if (/radio/i.test(controlType)) return "Chọn tùy chọn";
        if (/(date|datepicker)/i.test(controlType)) return "Chọn ngày";
        if (/(file|upload)/i.test(controlType)) return "Tải tệp lên";
        if (/(textbox|input|textarea)/i.test(controlType)) return "Nhập dữ liệu";

        return "Nhập hoặc chọn dữ liệu";
    }

    buildOperationStep(context, operationType) {
        const actions = {
            CREATE: "Lưu dữ liệu",
            UPDATE: "Cập nhật dữ liệu",
            DELETE: "Xóa dữ liệu",
            SEARCH: "Thực hiện tìm kiếm",
            VIEW: "Xem thông tin",
            LOGIN: "Đăng nhập",
            AUTHENTICATE: "Xác thực",
            LOGOUT: "Đăng xuất",
            CHANGE_PASSWORD: "Đổi mật khẩu",
            RESET_PASSWORD: "Đặt lại mật khẩu",
            APPROVE: "Phê duyệt",
            REJECT: "Từ chối",
            UPLOAD: "Tải dữ liệu lên",
            DOWNLOAD: "Tải dữ liệu xuống",
            UNKNOWN: "Thực hiện thao tác"
        };

        return this.createStep(
            0,
            actions[operationType] ?? actions.UNKNOWN,
            this.getFeatureName(context),
            "",
            "Yêu cầu được gửi để hệ thống xử lý"
        );
    }

    requiresConfirmation(context) {
        const flow = Array.isArray(context?.feature?.flow) ? context.feature.flow : [];
        const searchable = this.normalizeText(
            [
                ...flow.map(item =>
                    typeof item === "object"
                        ? (item.content ?? item.description ?? item.action)
                        : item
                ),
                context?.sourceItem?.content
            ]
                .filter(Boolean)
                .join(" ")
        );

        return /(xác nhận|confirm)/i.test(searchable);
    }

    buildConfirmationStep(context) {
        return this.createStep(
            0,
            "Xác nhận thao tác xóa",
            this.getFeatureName(context),
            "",
            "Yêu cầu xóa được xác nhận"
        );
    }

    buildVerificationStep(context, testData, rule) {
        const expectedText = this.resolveExpectedText(context);
        const target = this.getFeatureName(context);
        const expected = testData?.expected ?? {};
        const byRule = {
            REQUIRED:
                expectedText ||
                "Hiển thị kiểm tra trường bắt buộc và dữ liệu không được lưu hoặc yêu cầu không được xử lý",
            DUPLICATE: expectedText || "Hiển thị kiểm tra dữ liệu trùng và thay đổi không được lưu",
            INVALID_OPTION:
                expectedText || "Giá trị không hợp lệ bị từ chối và yêu cầu không được xử lý",
            DELETE_BLOCKED: expectedText || "Thao tác xóa bị chặn và bản ghi vẫn còn tồn tại",
            PERMISSION: expectedText || "Quyền truy cập bị từ chối và dữ liệu không thay đổi",
            SECURITY:
                expectedText || "Dữ liệu nguy hiểm được xử lý an toàn và mã không được thực thi",
            EMPTY_SEARCH:
                expectedText ||
                "Hệ thống xử lý yêu cầu tìm kiếm không có điều kiện theo quy tắc nghiệp vụ",
            DEFAULT: expectedText || "Kết quả nghiệp vụ phù hợp với yêu cầu"
        };

        if (expected.permissionAllowed === false) {
            return this.createStep(
                0,
                "Kiểm tra quyền truy cập và dữ liệu",
                target,
                "",
                byRule.PERMISSION
            );
        }

        return this.createStep(
            0,
            "Kiểm tra kết quả nghiệp vụ",
            target,
            "",
            byRule[rule] ?? byRule.DEFAULT
        );
    }

    resolveExpectedText(context) {
        const expectedResults = context?.existing?.expectedResults;
        return this.firstNonEmpty(
            context?.existing?.expectedResult,
            Array.isArray(expectedResults) ? expectedResults[0] : undefined,
            context?.sourceItem?.content,
            context?.identity?.title
        );
    }

    findInputDefinition(context, inputName) {
        const inputs = Array.isArray(context?.inputs) ? context.inputs : [];
        const normalizedName = this.normalizeText(inputName);

        return (
            inputs.find(input => {
                if (!input || typeof input !== "object") return false;
                const candidate = input.inputName ?? input.name ?? input.fieldName ?? input.label;
                return this.normalizeText(candidate) === normalizedName;
            }) ?? {}
        );
    }

    getFeatureName(context) {
        return (
            this.firstNonEmpty(
                context?.operation?.screen,
                context?.feature?.name,
                context?.identity?.feature
            ) || "chức năng cần kiểm thử"
        );
    }

    createStep(order, action, target = "", value = "", expected = "") {
        return {
            order,
            action: String(action ?? "").trim(),
            target: target ?? "",
            value: this.cloneValue(value),
            expected: expected ?? ""
        };
    }

    removeDuplicateSteps(steps) {
        const seen = new Set();

        return steps.filter(step => {
            if (!step?.action) return false;
            const key = JSON.stringify([step.action, step.target, step.value, step.expected]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    renumberSteps(steps) {
        return steps.map((step, index) => ({
            order: index + 1,
            action: step.action,
            target: this.cloneValue(step.target),
            value: this.cloneValue(step.value),
            expected: this.cloneValue(step.expected)
        }));
    }

    firstNonEmpty(...values) {
        return values.find(
            value =>
                value !== undefined &&
                value !== null &&
                (typeof value !== "string" || value.trim() !== "")
        );
    }

    normalizeText(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/[.:]+$/g, "")
            .replace(/\s+/g, " ");
    }

    cloneValue(value) {
        if (value === undefined || value === null) return value;
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }
        if (typeof value !== "object") return value;
        return JSON.parse(JSON.stringify(value));
    }
}

export default StepBuilder;
