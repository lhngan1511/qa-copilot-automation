import { normalizeTestData } from "../utils/TestDataReadiness.js";

export default class RuleTestDataBuilder {
    classify({ rule = "", source = "", scenario = {} } = {}) {
        const text = this.normalize(this.businessText(rule));
        const sourceCategory = this.normalize(source);
        const functionName = this.normalize(scenario.feature ?? scenario.function);

        if (sourceCategory.includes("required") || /không được để trống|bỏ trống/.test(text)) {
            return "REQUIRED";
        }
        if (/trùng|duy nhất|đã tồn tại/.test(text)) {
            return "DUPLICATE";
        }
        if (/người dùng khác.*(?:thay đổi|xóa)|đã bị người dùng khác/.test(text)) {
            return "CONCURRENT_CHANGE";
        }
        if (/hệ thống xảy ra lỗi|lỗi trong quá trình/.test(text)) {
            return "SYSTEM_FAILURE";
        }
        if (/không nhập điều kiện|không có điều kiện|điều kiện trống/.test(text)) {
            return "EMPTY_SEARCH";
        }
        if (/không tìm thấy|không có kết quả/.test(text)) {
            return "NO_RESULT";
        }
        if (/không có dữ liệu.*(?:hiển thị|trạng thái)|hiển thị trạng thái.*không có dữ liệu/.test(text)) {
            return "EMPTY_RESULT";
        }
        if (/một hoặc nhiều điều kiện|kết hợp.*điều kiện|điều kiện.*kết hợp/.test(text)) {
            return "SEARCH_MULTI";
        }
        if (
            functionName.includes("tìm kiếm") &&
            /một điều kiện|theo mã|theo tên|theo từ khóa/.test(text)
        ) {
            return "SEARCH_SINGLE";
        }
        if (
            sourceCategory.includes("permission") ||
            /không có quyền|phải có quyền|có quyền|quyền truy cập|quyền thực hiện/.test(text)
        ) {
            return "PERMISSION_DENIED";
        }
        if (/dữ liệu liên quan|ràng buộc.*xóa/.test(text)) {
            return "RELATED_DATA";
        }
        if (
            /đang được sử dụng|đang sử dụng|đã ngừng sử dụng|trạng thái (?:không cho phép|bị chặn)|không còn dữ liệu đang xử lý/.test(
                text
            )
        ) {
            return "STATE_RESTRICTION";
        }
        if (
            /(?:yêu cầu|cần|phải) xác nhận|xác nhận trước khi|hủy xác nhận (?:thao tác|xóa)|người dùng (?:không )?xác nhận/.test(
                text
            )
        ) {
            return "CONFIRMATION";
        }
        if (
            (/\d/.test(text) &&
                /độ dài|tối đa|tối thiểu|min|max|giới hạn|ký tự|số lượng|không quá|ít nhất|nhiều nhất/.test(
                    text
                )) ||
            /(?:<=|>=|<|>)|(?:ngày bắt đầu|startdate).*(?:ngày kết thúc|enddate)/.test(text)
        ) {
            return "BOUNDARY_CONCRETE";
        }
        if (/độ dài|tối đa|tối thiểu|vượt quá.*cho phép/.test(text)) {
            return "BOUNDARY_UNKNOWN";
        }
        if (/không tồn tại|không còn tồn tại|phải tồn tại/.test(text) && !/danh mục/.test(text)) {
            return "RECORD_NOT_FOUND";
        }
        if (
            /danh mục|giá trị hợp lệ/.test(text) ||
            (/không hợp lệ/.test(text) && /loại|trạng thái|dropdown|tham chiếu/.test(text))
        ) {
            return "INVALID_REFERENCE";
        }

        return "GENERIC_RULE";
    }

    build({ scenario = {}, sourceItem = {}, existingTestData = {} } = {}) {
        const rule = String(sourceItem.content ?? "").trim();
        const classification = this.classify({
            rule,
            source: sourceItem.source,
            scenario
        });
        const fieldName = this.extractFieldName(rule, classification);
        const testData = this.baseData(existingTestData);
        const flags = {
            needsClarification: false,
            requiresRuntimeSupport: false,
            needsEnrichment: false
        };

        switch (classification) {
            case "REQUIRED":
                if (this.isSpecificField(fieldName)) {
                    this.buildRequired(testData, scenario, fieldName);
                } else {
                    testData.context.targetFieldKnown = false;
                    flags.needsClarification = true;
                }
                break;
            case "DUPLICATE":
                this.buildDuplicate(testData, scenario, fieldName);
                break;
            case "INVALID_REFERENCE":
                this.buildInvalidReference(testData, scenario, fieldName);
                flags.requiresRuntimeSupport = true;
                break;
            case "RECORD_NOT_FOUND":
                testData.invalid.targetIdentifier = "NON_EXISTING_RECORD";
                testData.context.targetRecordExists = false;
                break;
            case "STATE_RESTRICTION":
                testData.context.targetRecord = {
                    statusCondition: this.extractStateCondition(rule)
                };
                break;
            case "RELATED_DATA":
                testData.context.targetRecordHasRelatedData = true;
                break;
            case "CONFIRMATION":
                testData.action.confirm = false;
                break;
            case "EMPTY_SEARCH":
                testData.valid.searchCriteria = {};
                flags.needsClarification = /hoặc|có thể/.test(this.normalize(rule));
                break;
            case "SEARCH_SINGLE":
                this.buildSearchCriteria(testData, scenario, 1);
                break;
            case "SEARCH_MULTI":
                this.buildSearchCriteria(testData, scenario, 2);
                flags.needsClarification = !/theo\s+(?:and|or)|đồng thời tất cả|ít nhất một/.test(
                    this.normalize(rule)
                );
                break;
            case "NO_RESULT":
                this.buildSearchCriteria(testData, scenario, 1);
                if (this.inputNames(scenario).length === 0) {
                    flags.needsEnrichment = true;
                }
                testData.context.matchingRecords = [];
                break;
            case "EMPTY_RESULT":
                testData.context.matchingRecords = [];
                break;
            case "PERMISSION_DENIED":
                testData.context.userHasRequiredPermission = false;
                break;
            case "CONCURRENT_CHANGE":
                testData.context.recordLoadedInitially = true;
                testData.context.recordChangedOrDeletedBeforeSubmit = true;
                break;
            case "SYSTEM_FAILURE":
                testData.context.faultInjectionRequired = true;
                flags.requiresRuntimeSupport = true;
                break;
            case "BOUNDARY_UNKNOWN":
                testData.context.boundaryValueKnown = false;
                flags.needsClarification = true;
                break;
            case "BOUNDARY_CONCRETE":
                testData.invalid.boundaryValue = sourceItem.boundaryValue ?? rule;
                testData.context.boundaryCase = sourceItem.boundaryCase ?? "EXPLICIT_LIMIT";
                testData.context.boundaryEvidence = rule;
                testData.expectedState.boundaryAccepted = this.isAcceptedBoundaryCase(
                    sourceItem.boundaryCase
                );
                break;
            default:
                testData.invalid.condition = rule;
                flags.needsEnrichment = true;
                if (/có thể|tùy thiết kế|nếu có/.test(this.normalize(rule))) {
                    flags.needsClarification = true;
                }
                break;
        }

        testData.expectedState.sourceRule = rule;
        testData.inputs = { ...testData.valid };

        return {
            classification,
            fieldName,
            testData: normalizeTestData(testData, {
                ...scenario,
                sourceItem: {
                    ...sourceItem,
                    text: rule,
                    fieldName
                },
                ruleClassification: classification,
                testData
            }),
            planningData: testData,
            expectedResult: this.buildExpected({
                classification,
                fieldName,
                rule,
                scenario,
                flags
            }),
            preconditions: this.buildPreconditions({
                classification,
                rule,
                scenario
            }),
            trigger: this.buildTrigger(classification, fieldName, rule, testData, scenario),
            ...flags,
            executable:
                !flags.needsClarification && !flags.requiresRuntimeSupport && !flags.needsEnrichment
        };
    }

    baseData(existingTestData) {
        const source =
            existingTestData && typeof existingTestData === "object" ? existingTestData : {};

        return {
            valid: {
                ...(this.isObject(source.valid) ? source.valid : {}),
                ...(this.isObject(source.inputs) ? source.inputs : {})
            },
            invalid: this.isObject(source.invalid) ? { ...source.invalid } : {},
            context: this.isObject(source.context) ? { ...source.context } : {},
            action: this.isObject(source.action) ? { ...source.action } : {},
            expectedState: this.isObject(source.expectedState) ? { ...source.expectedState } : {}
        };
    }

    buildRequired(testData, scenario, fieldName) {
        this.requiredFields(scenario).forEach(name => {
            if (name !== fieldName) {
                testData.valid[name] ??= "";
            }
        });
        delete testData.valid[fieldName];
        testData.invalid[fieldName] = "";
        testData.expectedState.targetField = fieldName;
        testData.expectedState.recordChanged = false;
    }

    buildDuplicate(testData, scenario, fieldName) {
        const target = fieldName || this.findIdentifierField(scenario) || "identifier";
        const existingValue = "";
        this.requiredFields(scenario).forEach(name => {
            if (name !== target) {
                testData.valid[name] ??= "";
            }
        });
        testData.invalid[target] = existingValue;
        testData.context.existingRecord = { [target]: existingValue };
        testData.expectedState.recordCreated = false;
        testData.expectedState.existingRecordChanged = false;
    }

    buildInvalidReference(testData, scenario, fieldName) {
        const target = fieldName || "referenceValue";
        this.requiredFields(scenario).forEach(name => {
            if (name !== target) {
                testData.valid[name] ??= `${name} kiểm thử`;
            }
        });
        testData.invalid[target] = "";
        testData.context.allowedValuesKnown = false;
        testData.context.requiresRuntimeData = true;
        testData.expectedState.recordChanged = false;
    }

    buildSearchCriteria(testData, scenario, count) {
        const fields = this.inputNames(scenario).slice(0, count);
        const selected = fields.length >= count ? fields : ["searchCriteria"];
        testData.valid.searchCriteria = Object.fromEntries(selected.map(name => [name, ""]));
    }

    buildExpected({ classification, fieldName, rule, scenario, flags }) {
        const operation = scenario.feature || scenario.function || "thao tác";

        switch (classification) {
            case "REQUIRED":
                if (!this.isSpecificField(fieldName)) {
                    return "Chưa xác định trường bắt buộc cụ thể; cần clarification trước khi tạo dữ liệu kiểm thử.";
                }
                return `Hệ thống không thực hiện ${operation} và đánh dấu trường ${fieldName} là không hợp lệ; dữ liệu không thay đổi.`;
            case "DUPLICATE":
                return `Hệ thống ${this.blockedDataOperation(operation)} bằng giá trị ${fieldName || "định danh"} đã tồn tại; dữ liệu hiện có không thay đổi.`;
            case "INVALID_REFERENCE":
                return `Hệ thống không cho phép lưu với ${fieldName || "giá trị tham chiếu"} không thuộc danh sách hợp lệ; dữ liệu không thay đổi.`;
            case "RECORD_NOT_FOUND":
                return `Hệ thống không thực hiện ${operation} với bản ghi không tồn tại; dữ liệu không thay đổi.`;
            case "STATE_RESTRICTION":
                return `Hệ thống không thực hiện ${operation} khi bản ghi ở trạng thái bị chặn theo rule; dữ liệu không thay đổi.`;
            case "RELATED_DATA":
                return `Hệ thống không thực hiện ${operation} và không làm mất dữ liệu liên quan.`;
            case "CONFIRMATION":
                return `Hệ thống không thực hiện ${operation} khi người dùng không xác nhận; dữ liệu không thay đổi.`;
            case "EMPTY_SEARCH":
                return flags.needsClarification
                    ? "Chưa thể xác định một kết quả duy nhất khi không nhập điều kiện; cần clarification được phê duyệt."
                    : "Hệ thống xử lý tìm kiếm không điều kiện theo outcome đã được phê duyệt.";
            case "SEARCH_SINGLE":
            case "SEARCH_MULTI":
                return flags.needsClarification
                    ? "Cần clarification về cách kết hợp điều kiện trước khi xác định kết quả."
                    : "Kết quả chỉ gồm các bản ghi phù hợp với điều kiện tìm kiếm.";
            case "NO_RESULT":
                return "Hệ thống hiển thị trạng thái không có dữ liệu phù hợp và không hiển thị bản ghi sai điều kiện.";
            case "EMPTY_RESULT":
                return "Hệ thống hiển thị trạng thái phù hợp khi không có dữ liệu.";
            case "PERMISSION_DENIED":
                return `Hệ thống không cho phép thực hiện ${operation}; dữ liệu không thay đổi.`;
            case "CONCURRENT_CHANGE":
                return "Hệ thống không ghi đè dữ liệu không còn hợp lệ và yêu cầu tải lại trạng thái mới nhất.";
            case "SYSTEM_FAILURE":
                return "Hệ thống không tạo dữ liệu không hoàn chỉnh và thể hiện thao tác không thành công.";
            case "BOUNDARY_UNKNOWN":
                return "Chưa thể tạo giá trị biên cụ thể khi giới hạn chưa được xác định; cần clarification.";
            case "BOUNDARY_CONCRETE":
                return "Hệ thống chấp nhận hoặc từ chối giá trị biên đúng theo giới hạn đã được phê duyệt và không lưu dữ liệu khi giá trị vượt giới hạn.";
            default:
                return `Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: ${rule}`;
        }
    }

    buildPreconditions({ classification, rule, scenario }) {
        const preconditions = Array.isArray(scenario.preconditions)
            ? [...scenario.preconditions]
            : [];
        const filtered = preconditions.filter(value => {
            const text = this.normalize(value);
            if (classification === "PERMISSION_DENIED" && /có quyền/.test(text)) return false;
            if (
                classification === "RECORD_NOT_FOUND" &&
                /đã tồn tại|phải tồn tại|cần .* tồn tại/.test(text)
            ) {
                return false;
            }
            return true;
        });

        const additions = {
            DUPLICATE: "Đã có bản ghi sử dụng giá trị trùng cần kiểm thử.",
            PERMISSION_DENIED: "Người dùng sử dụng tài khoản không có quyền thực hiện chức năng.",
            STATE_RESTRICTION: `Bản ghi mục tiêu ở trạng thái ${this.extractStateCondition(rule)}.`,
            RELATED_DATA: "Bản ghi mục tiêu có dữ liệu liên quan.",
            CONCURRENT_CHANGE:
                "Bản ghi hợp lệ khi mở và bị thay đổi hoặc xóa trước khi gửi thao tác."
        };
        if (additions[classification]) {
            filtered.push(additions[classification]);
        }

        return [...new Set(filtered)];
    }

    buildTrigger(classification, fieldName, rule, testData, scenario = {}) {
        const actions = {
            REQUIRED: `Để trống ${fieldName}`,
            DUPLICATE: `Nhập giá trị đã tồn tại cho ${fieldName || "trường định danh"}`,
            INVALID_REFERENCE: `Chọn giá trị không hợp lệ cho ${fieldName || "trường tham chiếu"}`,
            RECORD_NOT_FOUND: "Thực hiện thao tác với định danh không tồn tại",
            STATE_RESTRICTION: "Thực hiện thao tác với bản ghi ở trạng thái bị chặn",
            RELATED_DATA: "Thực hiện thao tác với bản ghi có dữ liệu liên quan",
            CONFIRMATION: "Không xác nhận thao tác",
            EMPTY_SEARCH: "Thực hiện tìm kiếm với toàn bộ điều kiện để trống",
            SEARCH_SINGLE: "Tìm kiếm bằng một điều kiện",
            SEARCH_MULTI: "Tìm kiếm bằng nhiều điều kiện",
            NO_RESULT: "Tìm kiếm bằng tiêu chí không có bản ghi phù hợp",
            EMPTY_RESULT: "",
            PERMISSION_DENIED: "Thực hiện thao tác bằng người dùng không có quyền",
            CONCURRENT_CHANGE: "Gửi thao tác sau khi bản ghi đã bị thay đổi hoặc xóa",
            SYSTEM_FAILURE: "Kích hoạt fault injection tại thời điểm xử lý",
            BOUNDARY_UNKNOWN: "Chuẩn bị giá trị vượt giới hạn chưa được xác định",
            BOUNDARY_CONCRETE: "Nhập giá trị tại điểm biên đã được xác định"
        };

        return {
            action: actions[classification] ?? "Chuẩn bị điều kiện kiểm thử",
            value:
                classification === "REQUIRED"
                    ? ""
                    : classification === "CONFIRMATION"
                      ? testData.action
                      : rule
        };
    }

    extractFieldName(rule, classification) {
        const patterns = {
            REQUIRED: /^(.+?)\s+(?:không được để trống|bị bỏ trống|phải được nhập|required)\b/i,
            DUPLICATE:
                /^(.+?)(?:\s+phải là duy nhất|\s+không được trùng|\s+đã tồn tại|\s+bị trùng)/i,
            INVALID_REFERENCE:
                /^(.+?)(?:\s+phải tồn tại trong danh mục|\s+phải.*giá trị hợp lệ|\s+không hợp lệ)/i
        };
        return this.businessText(rule).match(patterns[classification])?.[1]?.trim() ?? "";
    }

    extractStateCondition(rule) {
        return (
            String(rule).match(
                /(đang được sử dụng|đang sử dụng|đã ngừng sử dụng|còn dữ liệu đang xử lý)/i
            )?.[1] ?? "trạng thái bị chặn theo rule"
        );
    }

    requiredFields(scenario) {
        const fromSource = (Array.isArray(scenario.sourceItems) ? scenario.sourceItems : [])
            .map(item => ({
                content: typeof item === "string" ? item : (item?.content ?? ""),
                source: typeof item === "object" ? (item?.source ?? "") : ""
            }))
            .filter(
                item =>
                    this.classify({ rule: item.content, source: item.source, scenario }) ===
                    "REQUIRED"
            )
            .map(item => this.extractFieldName(item.content, "REQUIRED"))
            .filter(value => this.isSpecificField(value));

        return [
            ...new Set([
                ...this.inputNames(scenario).filter((_, index) => index < 3),
                ...fromSource
            ])
        ];
    }

    inputNames(scenario) {
        return (Array.isArray(scenario.inputDefinitions) ? scenario.inputDefinitions : [])
            .map(item => item?.name ?? item?.inputName ?? item?.fieldName ?? "")
            .filter(value => typeof value === "string" && value.trim())
            .map(value => value.trim());
    }

    findIdentifierField(scenario) {
        return this.inputNames(scenario).find(name => /mã|code|id/i.test(name)) ?? "";
    }

    businessText(value) {
        return String(value ?? "")
            .replace(/^\s*\[?(?:BR|VR|PR)[\s_-]*\d+\]?\s*(?:[:\-_–—]\s*)?/i, "")
            .trim();
    }

    slug(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\p{L}\p{N}]+/gu, "_")
            .replace(/^_+|_+$/g, "");
    }

    normalize(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/[.!?;:,]+$/g, "")
            .replace(/\s+/g, " ");
    }

    isObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }

    blockedDataOperation(operation) {
        const value = this.normalize(operation);
        if (/thêm|tạo/.test(value)) return "không tạo bản ghi mới";
        if (/sửa|cập nhật/.test(value)) return "không cập nhật bản ghi";
        return "không tạo hoặc cập nhật bản ghi";
    }

    isSpecificField(value) {
        const field = this.normalize(value);
        return Boolean(field && !["trường", "trường bắt buộc", "dữ liệu"].includes(field));
    }

    isAcceptedBoundaryCase(boundaryCase) {
        return ["MIN", "MAX", "LESS_THAN", "EQUAL"].includes(String(boundaryCase ?? ""));
    }
}
