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
            const content = this.getItemContent(permission);

            if (!content) {
                return;
            }

            this.addUnique(knowledge.permissionCases, `Kiểm tra ${content}`);
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
            const content = this.getItemContent(condition);

            if (!content) {
                return;
            }

            const normalizedContent = this.normalizeForComparison(content);

            if (this.containsPermissionKeyword(normalizedContent)) {
                this.addUnique(knowledge.permissionCases, `Kiểm tra ${content}`);
            }
        });
    }

    collectConditions(requirement) {
        const conditions = [];

        /*
        Requirement-level aggregated conditions
        */

        this.mergeItems(conditions, requirement.conditions);

        /*
        Feature-level preconditions
        */

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                this.mergeItems(conditions, feature.preconditions);
            });
        }

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
                    "Người dùng không có quyền không được truy cập chức năng"
                );
            }

            if (normalizedDescription.includes("quản lý")) {
                this.addUnique(
                    knowledge.permissionCases,
                    "Kiểm tra người dùng có quyền truy cập chức năng quản lý"
                );

                this.addUnique(
                    knowledge.permissionCases,
                    "Người dùng không có quyền không được thao tác chức năng quản lý"
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

        actions.forEach(action => {
            const normalizedAction = this.normalizeForComparison(action);

            if (!normalizedAction) {
                return;
            }

            if (
                normalizedAction.includes("thêm") ||
                normalizedAction.includes("tạo") ||
                normalizedAction.includes("create") ||
                normalizedAction.includes("add")
            ) {
                this.addUnique(knowledge.permissionCases, "Kiểm tra quyền thêm dữ liệu");
            }

            if (
                normalizedAction.includes("sửa") ||
                normalizedAction.includes("cập nhật") ||
                normalizedAction.includes("update") ||
                normalizedAction.includes("edit")
            ) {
                this.addUnique(knowledge.permissionCases, "Kiểm tra quyền chỉnh sửa dữ liệu");
            }

            if (
                normalizedAction.includes("xóa") ||
                normalizedAction.includes("delete") ||
                normalizedAction.includes("remove")
            ) {
                this.addUnique(knowledge.permissionCases, "Kiểm tra quyền xóa dữ liệu");
            }

            if (
                normalizedAction.includes("xem") ||
                normalizedAction.includes("tra cứu") ||
                normalizedAction.includes("tìm kiếm") ||
                normalizedAction.includes("view") ||
                normalizedAction.includes("search")
            ) {
                this.addUnique(knowledge.permissionCases, "Kiểm tra quyền xem dữ liệu");
            }

            if (normalizedAction.includes("xuất") || normalizedAction.includes("export")) {
                this.addUnique(knowledge.permissionCases, "Kiểm tra quyền xuất dữ liệu");
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

        this.mergeItems(actions, requirement.actions);

        if (Array.isArray(requirement.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                if (feature.name) {
                    this.mergeItems(actions, [feature.name]);
                }

                const operation = feature.automation?.operation;

                if (operation) {
                    this.mergeItems(actions, [operation]);
                }
            });
        }

        if (actions.length === 0 && requirement.feature) {
            this.mergeItems(actions, [requirement.feature]);
        }

        return actions;
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

    /*
    =================================================
    Collection Utilities
    =================================================
    */

    mergeItems(target, source) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(item => {
            const content = this.getItemContent(item);

            if (!content) {
                return;
            }

            const normalizedContent = this.normalizeForComparison(content);

            const existed = target.some(existingItem => {
                const existingContent = this.getItemContent(existingItem);

                return this.normalizeForComparison(existingContent) === normalizedContent;
            });

            if (!existed) {
                target.push(content);
            }
        });
    }

    addUnique(target, value) {
        if (!Array.isArray(target) || !value) {
            return;
        }

        const normalizedValue = this.normalizeForComparison(value);

        if (!normalizedValue) {
            return;
        }

        const existed = target.some(item => {
            const itemContent = this.getItemContent(item);

            return this.normalizeForComparison(itemContent) === normalizedValue;
        });

        if (!existed) {
            target.push(this.normalizeText(value));
        }
    }

    /*
    =================================================
    Content Normalization
    =================================================
    */

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
