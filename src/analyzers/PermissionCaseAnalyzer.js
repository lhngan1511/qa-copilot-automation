class PermissionCaseAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        this.analyzePermissions(requirement, knowledge);

        this.analyzeConditions(requirement, knowledge);

        this.analyzeDescription(requirement, knowledge);

        this.analyzeActions(requirement, knowledge);
    }

    /*
    =================================================
    Explicit Permission Analysis
    =================================================
    */

    analyzePermissions(requirement, knowledge) {
        const permissions = Array.isArray(requirement.permissions) ? requirement.permissions : [];

        permissions.forEach(permission => {
            const permissionName = this.getItemContent(permission);

            if (!permissionName) {
                return;
            }

            this.addUnique(
                knowledge.permissionCases,
                this.createPermissionCase(permission, {
                    module: requirement.module,

                    feature: this.resolveRequirementFeature(requirement),

                    permissionName,

                    content: `Kiểm tra ${permissionName}`,

                    permissionType: "GLOBAL_PERMISSION"
                })
            );
        });
    }

    /*
    =================================================
    Condition / Precondition Analysis
    =================================================
    */

    analyzeConditions(requirement, knowledge) {
        const conditions = this.collectConditions(requirement);

        conditions.forEach(condition => {
            const permissionName = this.getItemContent(condition);

            if (!permissionName) {
                return;
            }

            const normalizedContent = this.normalizeForComparison(permissionName);

            if (this.containsPermissionKeyword(normalizedContent)) {
                this.addUnique(
                    knowledge.permissionCases,
                    this.createPermissionCase(condition.item, {
                        module: condition.module,

                        feature: condition.feature,

                        permissionName,

                        content: `Kiểm tra ${permissionName}`,

                        permissionType: condition.feature ? "FEATURE_ACCESS" : "GLOBAL_PERMISSION"
                    })
                );
            }
        });
    }

    collectConditions(requirement) {
        const conditions = [];
        const featureConditionContents = new Set();

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                const featureConditions = [
                    ...(Array.isArray(feature.preconditions) ? feature.preconditions : []),

                    ...(Array.isArray(feature.businessRules) ? feature.businessRules : [])
                ];

                featureConditions.forEach(item => {
                    const content = this.normalizeForComparison(this.getItemContent(item));

                    if (content) {
                        featureConditionContents.add(content);
                    }
                });

                this.mergeItems(conditions, featureConditions, {
                    module: requirement.module,

                    feature: feature.name
                });
            });
        }

        const globalConditions = Array.isArray(requirement.conditions)
            ? requirement.conditions.filter(
                  item =>
                      !featureConditionContents.has(
                          this.normalizeForComparison(this.getItemContent(item))
                      )
              )
            : [];

        this.mergeItems(conditions, globalConditions, {
            module: requirement.module,

            feature: this.resolveRequirementFeature(requirement)
        });

        return conditions;
    }

    /*
    =================================================
    Purpose / Description Analysis
    =================================================
    */

    analyzeDescription(requirement, knowledge) {
        const descriptions = [requirement.purpose, requirement.description];

        descriptions.forEach(description => {
            const normalizedDescription = this.normalizeForComparison(description);

            if (!normalizedDescription) {
                return;
            }

            if (
                normalizedDescription.includes("phân quyền") ||
                normalizedDescription.includes("quyền truy cập") ||
                normalizedDescription.includes("authorization")
            ) {
                this.addUnique(
                    knowledge.permissionCases,
                    this.createPermissionCase(description, {
                        module: requirement.module,

                        feature: this.resolveRequirementFeature(requirement),

                        permissionName: "Quyền truy cập chức năng",

                        content: "Người dùng không có quyền không được truy cập chức năng",

                        permissionType: "UNAUTHORIZED_ACCESS"
                    })
                );
            }

            if (normalizedDescription.includes("quản lý")) {
                this.addUnique(
                    knowledge.permissionCases,
                    this.createPermissionCase(description, {
                        module: requirement.module,

                        feature: this.resolveRequirementFeature(requirement),

                        permissionName: "Quyền truy cập chức năng quản lý",

                        content: "Kiểm tra người dùng có quyền truy cập chức năng quản lý",

                        permissionType: "MANAGEMENT_ACCESS"
                    })
                );

                this.addUnique(
                    knowledge.permissionCases,
                    this.createPermissionCase(description, {
                        module: requirement.module,

                        feature: this.resolveRequirementFeature(requirement),

                        permissionName: "Quyền thao tác chức năng quản lý",

                        content: "Người dùng không có quyền không được thao tác chức năng quản lý",

                        permissionType: "RESTRICTED_ACTION"
                    })
                );
            }
        });
    }

    /*
    =================================================
    Action Permission Analysis
    =================================================
    */

    analyzeActions(requirement, knowledge) {
        const actions = this.collectActions(requirement);

        actions.forEach(entry => {
            const normalizedAction = this.normalizeForComparison(entry.action);

            if (!normalizedAction) {
                return;
            }

            if (
                normalizedAction.includes("thêm") ||
                normalizedAction.includes("tạo") ||
                normalizedAction.includes("create") ||
                normalizedAction.includes("add")
            ) {
                this.addActionPermissionCase(
                    knowledge,
                    entry,
                    "Kiểm tra quyền thêm dữ liệu",
                    "CREATE_PERMISSION"
                );
            }

            if (
                normalizedAction.includes("sửa") ||
                normalizedAction.includes("cập nhật") ||
                normalizedAction.includes("update") ||
                normalizedAction.includes("edit")
            ) {
                this.addActionPermissionCase(
                    knowledge,
                    entry,
                    "Kiểm tra quyền chỉnh sửa dữ liệu",
                    "UPDATE_PERMISSION"
                );
            }

            if (
                normalizedAction.includes("xóa") ||
                normalizedAction.includes("delete") ||
                normalizedAction.includes("remove")
            ) {
                this.addActionPermissionCase(
                    knowledge,
                    entry,
                    "Kiểm tra quyền xóa dữ liệu",
                    "DELETE_PERMISSION"
                );
            }

            if (
                normalizedAction.includes("xem") ||
                normalizedAction.includes("tra cứu") ||
                normalizedAction.includes("tìm kiếm") ||
                normalizedAction.includes("view") ||
                normalizedAction.includes("search")
            ) {
                this.addActionPermissionCase(
                    knowledge,
                    entry,
                    "Kiểm tra quyền xem dữ liệu",
                    "VIEW_PERMISSION"
                );
            }

            if (normalizedAction.includes("xuất") || normalizedAction.includes("export")) {
                this.addActionPermissionCase(
                    knowledge,
                    entry,
                    "Kiểm tra quyền xuất dữ liệu",
                    "EXPORT_PERMISSION"
                );
            }

            /*
            Không tự tạo permission case cho đăng nhập.

            Đăng nhập là bước xác thực danh tính,
            chưa phải kiểm tra quyền thao tác nghiệp vụ.
            */
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

                    feature: feature.name,

                    operation: feature.automation?.operation ?? ""
                });
            });
        }

        const globalActions = Array.isArray(requirement.actions)
            ? requirement.actions.filter(
                  action =>
                      !featureActions.has(this.normalizeForComparison(this.getActionText(action)))
              )
            : [];

        this.mergeActions(actions, globalActions, {
            module: requirement.module,

            feature: this.resolveRequirementFeature(requirement)
        });

        if (actions.length === 0 && requirement.feature) {
            this.mergeActions(actions, [requirement.feature], {
                module: requirement.module,

                feature: this.resolveRequirementFeature(requirement)
            });
        }

        return actions;
    }

    mergeActions(target, source, context = {}) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(action => {
            const isObject = action && typeof action === "object";
            const normalizedAction = this.getActionText(action);

            if (!normalizedAction) {
                return;
            }

            const entry = {
                action: normalizedAction,

                operation: this.firstMeaningful(
                    isObject ? action.operation : "",
                    context.operation
                ),

                module: this.firstMeaningful(context.module, isObject ? action.module : ""),

                feature: this.firstMeaningful(
                    context.feature,
                    isObject ? action.feature : "",
                    isObject ? action.featureName : ""
                )
            };

            const existed = target.some(currentEntry => {
                return (
                    this.normalizeForComparison(currentEntry.action) ===
                        this.normalizeForComparison(entry.action) &&
                    this.normalizeForComparison(currentEntry.module) ===
                        this.normalizeForComparison(entry.module) &&
                    this.normalizeForComparison(currentEntry.feature) ===
                        this.normalizeForComparison(entry.feature)
                );
            });

            if (!existed) {
                target.push(entry);
            }
        });
    }

    addActionPermissionCase(knowledge, entry, content, permissionType) {
        this.addUnique(
            knowledge.permissionCases,
            this.createPermissionCase(entry, {
                module: entry.module,

                feature: entry.feature,

                permissionName: entry.action,

                content,

                permissionType,

                action: entry.action,

                operation: entry.operation
            })
        );
    }

    /*
    =================================================
    Permission Detection
    =================================================
    */

    containsPermissionKeyword(content) {
        const keywords = [
            "quyền",

            "phân quyền",

            "permission",

            "authorization",

            "authorized",

            "role",

            "vai trò",

            "admin",

            "quản trị"
        ];

        return keywords.some(keyword => content.includes(keyword));
    }

    createPermissionCase(item, context = {}) {
        const isObject = item && typeof item === "object";

        return {
            module: this.firstMeaningful(context.module, isObject ? item.module : ""),

            feature: this.firstMeaningful(
                context.feature,
                isObject ? item.feature : "",
                isObject ? item.featureName : ""
            ),

            permissionName:
                context.permissionName ??
                (isObject ? (item.permissionName ?? item.permission ?? item.name) : "") ??
                "",

            content: context.content ?? this.getItemContent(item),

            source: "PERMISSION_ANALYSIS",

            permissionType: context.permissionType ?? (isObject ? item.permissionType : "") ?? "",

            action: this.firstMeaningful(context.action, isObject ? item.action : ""),

            operation: this.firstMeaningful(context.operation, isObject ? item.operation : ""),

            code: isObject ? item.code : undefined,

            severity: isObject ? item.severity : undefined,

            priority: isObject ? item.priority : undefined,

            riskCategory: isObject ? item.riskCategory : undefined,

            requirementReference: isObject ? item.requirementReference : undefined,

            description: isObject ? item.description : undefined
        };
    }

    /*
    =================================================
    Collection Utilities
    =================================================
    */

    mergeItems(target, source, context = {}) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(item => {
            const content = this.getItemContent(item);

            if (!content) {
                return;
            }

            const entry = {
                item,

                module: this.firstMeaningful(
                    context.module,
                    item && typeof item === "object" ? item.module : ""
                ),

                feature: this.firstMeaningful(
                    context.feature,
                    item && typeof item === "object" ? item.feature : "",
                    item && typeof item === "object" ? item.featureName : ""
                ),

                content
            };

            const comparisonKey = [
                this.normalizeForComparison(entry.module),

                this.normalizeForComparison(entry.feature),

                this.normalizeForComparison(entry.content)
            ].join("|");

            const existed = target.some(existingItem => {
                return (
                    [
                        this.normalizeForComparison(existingItem.module),

                        this.normalizeForComparison(existingItem.feature),

                        this.normalizeForComparison(existingItem.content)
                    ].join("|") === comparisonKey
                );
            });

            if (!existed) {
                target.push(entry);
            }
        });
    }

    getPermissionComparisonKey(value) {
        if (!value || typeof value !== "object") {
            return ["", "", "", this.normalizeForComparison(value), ""].join("|");
        }

        return [
            this.normalizeForComparison(value.module),

            this.normalizeForComparison(value.feature),

            this.normalizeForComparison(value.permissionName),

            this.normalizeForComparison(value.content),

            this.normalizeForComparison(value.permissionType)
        ].join("|");
    }

    addUnique(target, value) {
        if (!Array.isArray(target) || !value) {
            return;
        }

        const comparisonKey = this.getPermissionComparisonKey(value);

        const existed = target.some(
            item => this.getPermissionComparisonKey(item) === comparisonKey
        );

        if (!existed) {
            target.push(value && typeof value === "object" ? value : this.normalizeText(value));
        }
    }

    /*
    =================================================
    Content Normalization
    =================================================
    */

    resolveRequirementFeature(requirement) {
        return this.firstMeaningful(requirement?.feature, requirement?.module);
    }

    getActionText(action) {
        if (
            typeof action === "string" ||
            typeof action === "number" ||
            typeof action === "boolean"
        ) {
            return this.normalizeText(action);
        }

        if (!action || typeof action !== "object") {
            return "";
        }

        return this.firstMeaningful(action.action, action.name, action.title);
    }

    firstMeaningful(...values) {
        for (const value of values) {
            const normalized = this.normalizeText(value);

            if (normalized) {
                return normalized;
            }
        }

        return "";
    }

    getItemContent(item) {
        if (item === undefined || item === null) {
            return "";
        }

        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
            return this.normalizeText(String(item));
        }

        if (typeof item === "object") {
            const content =
                item.content ??
                item.description ??
                item.title ??
                item.name ??
                item.permission ??
                item.role ??
                "";

            return this.normalizeText(String(content));
        }

        return "";
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

export default PermissionCaseAnalyzer;
