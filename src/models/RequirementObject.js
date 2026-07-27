class RequirementObject {
    constructor() {
        // =====================================
        // Requirement Identity
        // =====================================

        this.id = "";

        // =====================================
        // Module Information
        // Ví dụ: Đăng nhập, Thiết bị
        // =====================================

        this.module = "";

        // Giữ tương thích tạm thời với code cũ.
        // Pipeline mới nên sử dụng:
        //
        // requirement.module
        // requirement.features
        // =====================================

        this.feature = "";

        // =====================================
        // General Information
        // =====================================

        this.purpose = "";

        this.description = "";

        // =====================================
        // Module-level Permissions
        // =====================================

        this.permissions = [];

        // =====================================
        // Shared Data Definitions
        // Dữ liệu dùng chung cho toàn Module
        // =====================================

        this.commonInputs = [];

        // Giữ tương thích với pipeline cũ.
        // Parser có thể tạo bản sao từ commonInputs.
        // =====================================

        this.inputDefinitions = [];

        // =====================================
        // Data Relationships
        // =====================================

        this.relationships = [];

        // =====================================
        // Features
        //
        // Ví dụ:
        // - Đăng nhập
        // - Thêm thiết bị
        // - Sửa thiết bị
        // - Xóa thiết bị
        // - Tìm kiếm thiết bị
        // =====================================

        this.features = [];

        // =====================================
        // Compatibility / Aggregate Fields
        //
        // Các trường này được tổng hợp từ features
        // để analyzer và generator cũ vẫn hoạt động.
        // =====================================

        this.actions = [];

        this.businessRules = [];

        this.expectedResults = [];

        this.edgeCases = [];

        this.conditions = [];

        // =====================================
        // Intelligence Metadata
        // =====================================

        this.questions = [];

        this.notes = [];

        // =====================================
        // Requirement Specification Version
        // =====================================

        this.version = "1.0";
    }

    /*
    =================================================
    Feature Management
    =================================================
    */

    addFeature(feature) {
        if (!feature) {
            return;
        }

        const existed = this.features.some(currentFeature =>
            this.isSameFeature(currentFeature, feature)
        );

        if (existed) {
            return;
        }

        this.features.push(feature);

        if (feature.name && !this.containsString(this.actions, feature.name)) {
            this.actions.push(feature.name);
        }

        this.mergeUnique(this.businessRules, feature.businessRules);

        this.mergeUnique(this.expectedResults, feature.expectedResults);

        this.mergeUnique(this.edgeCases, feature.exceptions);

        this.mergeUnique(this.conditions, feature.preconditions);
    }

    /*
    =================================================
    Common Input Management
    =================================================
    */

    addCommonInput(input) {
        if (!input) {
            return;
        }

        const existed = this.commonInputs.some(
            currentInput => this.getComparableValue(currentInput) === this.getComparableValue(input)
        );

        if (existed) {
            return;
        }

        this.commonInputs.push(input);

        /*
        Giữ đồng bộ để code cũ vẫn có thể sử dụng
        requirement.inputDefinitions.
        */

        this.inputDefinitions = [...this.commonInputs];
    }

    /*
    =================================================
    Relationship Management
    =================================================
    */

    addRelationship(relationship) {
        if (!relationship) {
            return;
        }

        const existed = this.relationships.some(
            currentRelationship =>
                this.getComparableValue(currentRelationship) ===
                this.getComparableValue(relationship)
        );

        if (existed) {
            return;
        }

        this.relationships.push(relationship);
    }

    /*
    =================================================
    Merge Utilities
    =================================================
    */

    mergeUnique(target, source) {
        if (!Array.isArray(target) || !Array.isArray(source)) {
            return;
        }

        source.forEach(item => {
            if (item === undefined || item === null || item === "") {
                return;
            }

            const itemKey = this.getComparableValue(item);

            const existed = target.some(
                currentItem => this.getComparableValue(currentItem) === itemKey
            );

            if (!existed) {
                target.push(item);
            }
        });
    }

    containsString(values, targetValue) {
        if (!Array.isArray(values) || !targetValue) {
            return false;
        }

        const normalizedTarget = String(targetValue).trim().toLowerCase();

        return values.some(
            value =>
                String(value ?? "")
                    .trim()
                    .toLowerCase() === normalizedTarget
        );
    }

    /*
    =================================================
    Comparison Utilities
    =================================================
    */

    isSameFeature(firstFeature, secondFeature) {
        if (!firstFeature || !secondFeature) {
            return false;
        }

        const firstId = String(firstFeature.id ?? "").trim();

        const secondId = String(secondFeature.id ?? "").trim();

        if (firstId && secondId && firstId === secondId) {
            return true;
        }

        const firstName = String(firstFeature.name ?? "")
            .trim()
            .toLowerCase();

        const secondName = String(secondFeature.name ?? "")
            .trim()
            .toLowerCase();

        return Boolean(firstName && secondName && firstName === secondName);
    }

    getComparableValue(value) {
        if (value === undefined || value === null) {
            return "";
        }

        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return String(value).trim().toLowerCase();
        }

        if (typeof value === "object") {
            const code = String(value.code ?? "")
                .trim()
                .toLowerCase();

            const content = String(value.content ?? value.description ?? value.name ?? "")
                .trim()
                .toLowerCase();

            if (code || content) {
                return `${code}|${content}`;
            }

            return JSON.stringify(value, Object.keys(value).sort()).toLowerCase();
        }

        return String(value).trim().toLowerCase();
    }
}

export default RequirementObject;
