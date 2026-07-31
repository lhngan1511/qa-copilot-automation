export default class ExpectedResultBuilder {
    build({ testCase = {}, scenario = {}, testData = {}, existing = "" } = {}) {
        if (
            (this.isManualScenario(scenario) ||
                this.isManualExpected(existing) ||
                testCase.needsClarification === true) &&
            this.text(existing) &&
            !this.isGeneric(existing)
        ) {
            return this.text(existing);
        }
        let classification = String(
            testCase.ruleClassification ?? scenario.ruleClassification ?? ""
        ).toUpperCase();
        const operation = this.operation(testCase, scenario);
        const entity = this.entity(testCase.feature ?? testCase.function ?? scenario.feature);
        const fields = testData?.fields ?? {};
        const boundaryPurpose = Object.values(fields).find(field =>
            ["BELOW_MIN", "AT_MIN", "ABOVE_MAX", "AT_MAX"].includes(field?.purpose)
        )?.purpose;
        if (["BOUNDARY_CONCRETE", "BOUNDARY_UNKNOWN"].includes(classification) && boundaryPurpose) {
            classification = `BOUNDARY_${boundaryPurpose}`;
        }
        const targetField = this.targetField(testCase, scenario, fields);
        const targetValue = fields[targetField]?.value;
        const identifier = this.identifier(fields);
        const record = testData.record ?? identifier?.value ?? entity;

        if (classification === "REQUIRED") {
            return `Hệ thống không lưu ${entity} mới. Trường ${targetField || "bắt buộc"} được đánh dấu bắt buộc và hiển thị cảnh báo không được để trống.`;
        }
        if (classification === "DUPLICATE") {
            return `Hệ thống không lưu ${entity} mới và hiển thị cảnh báo ${
                targetField || identifier?.name || "giá trị định danh"
            }${this.withValue(targetValue ?? identifier?.value)} đã tồn tại. Dữ liệu hiện có không bị thay đổi.`;
        }
        if (["INVALID_OPTION", "INVALID_REFERENCE"].includes(classification)) {
            return `Hệ thống không lưu dữ liệu. Trường ${targetField || "giá trị lựa chọn"} được đánh dấu không hợp lệ. Dữ liệu hiện có không bị thay đổi.`;
        }
        if (classification === "BOUNDARY_UNKNOWN") {
            return `Chưa thể xác định kết quả biên cho ${targetField || "trường dữ liệu"} vì requirement chưa cung cấp giới hạn cụ thể.`;
        }
        if (/BOUNDARY/.test(classification)) {
            return this.boundaryResult({
                classification,
                entity,
                targetField,
                testCase,
                scenario,
                testData
            });
        }
        if (
            classification === "PERMISSION_DENIED" ||
            String(testCase.type).toUpperCase() === "PERMISSION"
        ) {
            return `Hệ thống từ chối ${this.operationText(operation, entity)}. Người dùng không thể thay đổi dữ liệu và nhận được thông báo không có quyền thực hiện chức năng.`;
        }
        if (
            ["STATE_RESTRICTION", "RELATED_DATA"].includes(classification) ||
            (operation === "DELETE" && testData.recordState)
        ) {
            const state = testData.recordState || "đang ở trạng thái không cho phép xóa";
            return `Hệ thống không xóa ${entity}${this.withValue(record)} và hiển thị cảnh báo ${this.lowerFirst(
                state
            )}. Dữ liệu ${entity} vẫn được giữ nguyên.`;
        }
        if (operation === "CREATE" && String(testCase.type).toUpperCase() === "POSITIVE") {
            return `Hệ thống lưu ${entity} mới thành công.${
                identifier?.value
                    ? ` ${this.capitalize(entity)} có ${identifier.name} ${identifier.value} xuất hiện trong danh sách với đúng thông tin đã nhập.`
                    : ` ${this.capitalize(entity)} xuất hiện trong danh sách với đúng thông tin đã nhập.`
            }`;
        }
        if (operation === "UPDATE" && String(testCase.type).toUpperCase() === "POSITIVE") {
            const updated = Object.entries(testData.updated ?? {}).find(([, value]) =>
                this.hasValue(value)
            );
            return `Hệ thống lưu thay đổi thành công.${
                identifier?.value
                    ? ` ${this.capitalize(entity)} ${identifier.value}`
                    : ` ${this.capitalize(entity)}`
            }${updated ? ` hiển thị ${this.lowerFirst(updated[0])} mới là ${updated[1]}.` : " hiển thị đúng thông tin mới."}`;
        }
        if (operation === "DELETE" && String(testCase.type).toUpperCase() === "POSITIVE") {
            return `Hệ thống xóa ${entity}${this.withValue(record)} thành công và ${entity} không còn xuất hiện trong danh sách.`;
        }
        if (operation === "SEARCH") {
            const criterion = Object.values(fields).find(
                field => field.purpose === "SEARCH_CRITERIA" && this.hasValue(field.value)
            );
            return `Danh sách chỉ hiển thị các bản ghi phù hợp${
                criterion ? ` với từ khóa ${criterion.value}` : " với điều kiện tìm kiếm"
            }. Các bản ghi không phù hợp không xuất hiện trong kết quả.`;
        }

        return this.normalizeExisting(existing, { entity, operation });
    }

    normalizeLegacy(existing, context = {}) {
        const value = this.text(existing);
        if (!this.isGeneric(value)) return value;
        return this.build({
            testCase: context,
            scenario: context,
            testData: context.testData,
            existing: value
        });
    }

    boundaryResult({ classification, entity, targetField, testCase, scenario, testData }) {
        const rule = this.text(
            testCase.sourceItem?.text ??
                testCase.sourceItem?.content ??
                scenario.sourceItem?.content ??
                testCase.requirementReference
        );
        const constraint = Object.entries(testData?.constraints ?? {}).find(
            ([field]) => this.comparable(field) === this.comparable(targetField)
        )?.[1];
        const limit = rule.match(/\d+(?:[.,]\d+)?/)?.[0] ?? constraint?.max ?? constraint?.min;
        const rejected = /ABOVE_MAX|BELOW_MIN|MAX_PLUS|MIN_MINUS/.test(classification);
        if (rejected) {
            return `Hệ thống không lưu dữ liệu. Trường ${targetField || "giá trị"} hiển thị cảnh báo${
                limit ? ` không được vượt quá ${limit}` : " giá trị nằm ngoài giới hạn cho phép"
            }${/ky tu|ký tự/i.test(rule) || constraint?.kind === "TEXT_LENGTH" ? " ký tự" : ""}. Dữ liệu hiện có không bị thay đổi.`;
        }
        return `Hệ thống chấp nhận ${targetField || "giá trị"} tại giới hạn${
            limit ? ` ${limit}` : " đã xác định"
        } và lưu ${entity} thành công.`;
    }

    normalizeExisting(existing, { entity, operation }) {
        const value = this.text(existing);
        if (!this.isGeneric(value)) return value;
        if (operation === "DELETE") {
            return `Hệ thống không thay đổi dữ liệu ${entity} khi điều kiện xóa không được đáp ứng.`;
        }
        return `Hệ thống không lưu dữ liệu khi điều kiện kiểm thử không được đáp ứng. Dữ liệu hiện có không bị thay đổi.`;
    }

    isManualExpected(value) {
        return /đã duyệt|tester|người dùng xác nhận|manual/i.test(this.text(value));
    }

    isManualScenario(scenario) {
        return (
            /^SC[-_]?USER/i.test(String(scenario?.id ?? "")) ||
            /user|tester|manual/i.test(String(scenario?.source ?? scenario?.createdBy ?? ""))
        );
    }

    isGeneric(value) {
        const normalized = this.comparable(value);
        if (!normalized) return true;
        return [
            "he thong xu ly dung theo yeu cau",
            "ket qua dung",
            "thao tac thanh cong",
            "hien thi thong bao phu hop",
            "du lieu hop le",
            "he thong khong cho phep",
            "ket qua nghiep vu phu hop voi yeu cau"
        ].some(item => normalized === item || normalized.startsWith(`${item} `));
    }

    targetField(testCase, scenario, fields) {
        const explicit = this.text(
            testCase.sourceItem?.fieldName ??
                testCase.sourceItem?.inputName ??
                scenario.sourceItem?.fieldName ??
                scenario.sourceItem?.inputName
        );
        if (explicit) return explicit;
        return Object.keys(fields).find(name => fields[name]?.purpose !== "VALID") ?? "";
    }

    identifier(fields) {
        const entry = Object.entries(fields).find(
            ([name, field]) => /mã|code|\bid\b/i.test(name) && this.hasValue(field?.value)
        );
        return entry ? { name: entry[0], value: entry[1].value } : null;
    }

    operation(testCase, scenario) {
        const explicit = String(
            scenario.operation ??
                scenario.automation?.operation ??
                testCase.automation?.operation ??
                ""
        ).toUpperCase();
        if (/CREATE|ADD/.test(explicit)) return "CREATE";
        if (/UPDATE|EDIT/.test(explicit)) return "UPDATE";
        if (/DELETE|REMOVE/.test(explicit)) return "DELETE";
        if (/SEARCH|FIND/.test(explicit)) return "SEARCH";
        const value = this.comparable(
            `${testCase.feature ?? testCase.function ?? scenario.feature ?? ""} ${
                testCase.title ?? scenario.title ?? ""
            }`
        );
        if (/them|tao moi/.test(value)) return "CREATE";
        if (/sua|cap nhat/.test(value)) return "UPDATE";
        if (/xoa/.test(value)) return "DELETE";
        if (/tim kiem|tra cuu/.test(value)) return "SEARCH";
        return "OTHER";
    }

    operationText(operation, entity) {
        if (operation === "DELETE") return `thao tác xóa ${entity}`;
        if (operation === "UPDATE") return `thao tác cập nhật ${entity}`;
        if (operation === "CREATE") return `thao tác thêm mới ${entity}`;
        if (operation === "SEARCH") return `thao tác tìm kiếm ${entity}`;
        return "thao tác được yêu cầu";
    }

    entity(feature) {
        const value = this.text(feature)
            .replace(/^(thêm|tạo mới|sửa|cập nhật|xóa|xoá|tìm kiếm|tra cứu|quản lý)\s+/i, "")
            .trim();
        return this.lowerFirst(value || "dữ liệu");
    }

    withValue(value) {
        return this.hasValue(value) && value !== "Bản ghi mục tiêu" ? ` ${value}` : "";
    }

    hasValue(value) {
        return value !== undefined && value !== null && String(value).trim() !== "";
    }

    text(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    comparable(value) {
        return this.text(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[.!?;:,]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    lowerFirst(value) {
        const text = String(value ?? "").trim();
        return text ? text.charAt(0).toLocaleLowerCase("vi") + text.slice(1) : "";
    }

    capitalize(value) {
        const text = String(value ?? "").trim();
        return text ? text.charAt(0).toLocaleUpperCase("vi") + text.slice(1) : "";
    }
}
