/* TemplateTestCaseGenerator — nguồn thứ 3 sinh testcase, "Tạo testcase nhanh theo khuôn mẫu".

   Nguyên tắc cốt lõi (khác hẳn nguồn .md/Requirement và nguồn CodeGen):
   - THUẦN RULE-BASED, KHÔNG dùng AI/LLM ở bất kỳ bước nào — không phân tích thêm, không suy luận,
     không hỏi clarification. Dữ liệu wizard nhập vào CHÍNH LÀ câu trả lời rồi, generate thẳng ra
     testcase. Không có gì mơ hồ cần AI đoán -> không có lớp lỗi "câu hỏi không ổn định giữa các lần
     chạy / ghép câu thô / placeholder rò rỉ" đã gặp ở AI/CodeGen.
   - Hàm generate() là PURE FUNCTION: cùng payload luôn ra cùng kết quả, không đọc/ghi trạng thái
     ngoài, không cần workflow/session — caller (route) chỉ cần gọi thẳng, rồi tự merge kết quả vào
     "Duyệt testcase" đang mở (giống hệt cơ chế merge của "+ Tạo testcase từ CodeGen" — xem
     CodeGenRequirementReviewPage.jsx#performMerge — ID cuối cùng, thứ tự hiển thị do TẦNG MERGE ở
     frontend quyết định qua nextStableTestCaseId()/assignDisplayIds(), KHÔNG phải ở đây).
   - Mỗi thao tác con (Tìm kiếm/Thêm/Sửa/Xóa/In ấn/Xuất Excel/Xuất Word/Lập báo cáo) sinh testcase
     theo ĐÚNG công thức cố định — xem README/tài liệu tính năng "Tạo testcase nhanh theo khuôn mẫu"
     (2026-09-04) để đối chiếu bảng công thức đầy đủ. Test file đi kèm (
     tests/template-testcase-generator-formula-test.js) khẳng định số lượng sinh ra KHỚP CHÍNH XÁC
     công thức cho mọi tổ hợp input — vì nguồn này rule-based 100%, không có "sai số chấp nhận được"
     như nguồn AI.
*/

const OPERATION_ORDER = [
    "SEARCH",
    "CREATE",
    "UPDATE",
    "DELETE",
    "PRINT",
    "EXPORT_EXCEL",
    "EXPORT_WORD",
    "REPORT"
];

const OPERATION_LABEL = {
    SEARCH: "Tìm kiếm",
    CREATE: "Thêm",
    UPDATE: "Sửa",
    DELETE: "Xóa",
    PRINT: "In ấn",
    EXPORT_EXCEL: "Xuất Excel",
    EXPORT_WORD: "Xuất Word",
    REPORT: "Lập báo cáo"
};

const DEFAULTS = {
    CREATE_SUCCESS: "Thông tin sẽ được hiển thị tại danh sách",
    CREATE_FAIL:
        "Xuất hiện thông báo tại vị trí thông tin nhập sai, bắt buộc nhập. Thông tin không được lưu",
    UPDATE_SUCCESS: "Thông tin được cập nhật với giá trị mới và sẽ hiển thị tại danh sách",
    UPDATE_FAIL:
        "Xuất hiện thông báo tại vị trí thông tin nhập sai, không phù hợp. Thông tin không được cập nhật.",
    DELETE_SUCCESS: "Sau khi xóa thông tin không còn hiển thị tại danh sách",
    DELETE_FAIL: "Xuất hiện thông báo lỗi và không cho phép xóa",
    SEARCH_HIT: "Hiển thị kết quả thông tin tương ứng với từ khóa tìm kiếm",
    SEARCH_MISS: "Hiển thị thông báo không có thông tin",
    NO_DATA: "Hiển thị thông báo không có thông tin",
    PRINT_LIKE_QUALITY: "Biểu mẫu đúng, không sai canh chỉnh, dữ liệu chính xác, không sai chính tả",
    FILE_SAVED: "File được tạo và lưu trữ tại máy người dùng",
    REPORT_MISSING: "Xuất hiện thông báo yêu cầu chọn đầy đủ tiêu chí, không cho phép lập báo cáo"
};

export default class TemplateTestCaseGenerator {
    generate({ functionName, operations } = {}) {
        const name = String(functionName ?? "").trim();
        if (!name) {
            throw Object.assign(new Error("functionName is required"), {
                code: "MISSING_FUNCTION_NAME",
                statusCode: 422
            });
        }
        const config = this.isObject(operations) ? operations : {};
        let counter = 0;
        const nextId = () => {
            counter += 1;
            return `TEMPLATE-${counter}`;
        };

        return OPERATION_ORDER.flatMap(operation => {
            const operationConfig = config[operation];
            // Bị bỏ qua ở wizard ("Bỏ qua bước này") hoặc chưa tick ở Bước 1 -> coi như CHƯA CHỌN,
            // không sinh testcase/placeholder nào cho thao tác này.
            if (!this.isObject(operationConfig)) return [];
            const builder = this.builders[operation];
            return builder.call(this, name, operationConfig, nextId);
        });
    }

    builders = {
        SEARCH: this.buildSearch,
        CREATE: this.buildCreate,
        UPDATE: this.buildUpdate,
        DELETE: this.buildDelete,
        PRINT: (name, config, nextId) => this.buildPrintLike(name, config, nextId, "PRINT"),
        EXPORT_EXCEL: (name, config, nextId) => this.buildPrintLike(name, config, nextId, "EXPORT_EXCEL"),
        EXPORT_WORD: (name, config, nextId) => this.buildPrintLike(name, config, nextId, "EXPORT_WORD"),
        REPORT: this.buildReport
    };

    /* ---------------------------------------------------------------------------------------- */

    buildSearch(name, config, nextId) {
        const fields = this.toLines(config.fields);
        const hitExpected = this.text(config.hitExpected) || DEFAULTS.SEARCH_HIT;
        const missExpected = this.text(config.missExpected) || DEFAULTS.SEARCH_MISS;
        const label = OPERATION_LABEL.SEARCH;
        const fieldsClause = fields.length ? ` (${fields.join(", ")})` : "";

        return [
            this.build({
                id: nextId(),
                type: "POSITIVE",
                name,
                label,
                title: `${label} ${name} có kết quả`,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, `Nhập từ khóa tìm kiếm phù hợp với dữ liệu hiện có${fieldsClause}`),
                    this.step(3, `Thực hiện ${label.toLocaleLowerCase("vi")}`)
                ],
                expectedResult: hitExpected
            }),
            this.build({
                id: nextId(),
                type: "NEGATIVE",
                name,
                label,
                title: `${label} ${name} không có kết quả`,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, `Nhập từ khóa tìm kiếm không khớp dữ liệu nào${fieldsClause}`),
                    this.step(3, `Thực hiện ${label.toLocaleLowerCase("vi")}`)
                ],
                expectedResult: missExpected
            })
        ];
    }

    buildCreate(name, config, nextId) {
        return this.buildAddOrUpdate(name, config, nextId, {
            operation: "CREATE",
            label: OPERATION_LABEL.CREATE,
            openStep: "Chọn chức năng Thêm mới",
            successTitle: `${OPERATION_LABEL.CREATE} ${name} thành công với dữ liệu hợp lệ`,
            successDefault: DEFAULTS.CREATE_SUCCESS,
            failDefault: DEFAULTS.CREATE_FAIL,
            failTitle: field => `${OPERATION_LABEL.CREATE} ${name} không thành công khi bỏ trống ${field}`,
            fillStep: (requiredLabel, optionalLabel) =>
                `Nhập đầy đủ thông tin hợp lệ${requiredLabel ? ` (${requiredLabel}${optionalLabel ? `, ${optionalLabel}` : ""})` : ""}`,
            missingStep: field => `Nhập dữ liệu hợp lệ cho các trường còn lại, để trống ${field}`
        });
    }

    buildUpdate(name, config, nextId) {
        return this.buildAddOrUpdate(name, config, nextId, {
            operation: "UPDATE",
            label: OPERATION_LABEL.UPDATE,
            openStep: "Chọn bản ghi cần sửa đang tồn tại",
            successTitle: `${OPERATION_LABEL.UPDATE} ${name} thành công với dữ liệu hợp lệ`,
            successDefault: DEFAULTS.UPDATE_SUCCESS,
            failDefault: DEFAULTS.UPDATE_FAIL,
            failTitle: field => `${OPERATION_LABEL.UPDATE} ${name} không thành công khi bỏ trống ${field}`,
            fillStep: (requiredLabel, optionalLabel) =>
                `Thay đổi thông tin hợp lệ${requiredLabel ? ` (${requiredLabel}${optionalLabel ? `, ${optionalLabel}` : ""})` : ""}`,
            missingStep: field => `Thay đổi dữ liệu hợp lệ cho các trường còn lại, để trống ${field}`
        });
    }

    /** Thêm/Sửa dùng CHUNG công thức 1 POSITIVE + N VALIDATION (N = số trường bắt buộc) — chỉ khác
     *  nhãn thao tác, bước mở đầu, và câu kết quả mặc định. Gộp logic dùng chung ở đây để KHÔNG lặp
     *  code giữa buildCreate/buildUpdate (2 nhánh dễ lệch nhau nếu viết tách rời — đúng bài học từ
     *  các bug "2 nơi cùng làm 1 việc nhưng khác nhau" đã gặp trong AI/CodeGen pipeline). */
    buildAddOrUpdate(name, config, nextId, spec) {
        const required = this.toLines(config.requiredFields);
        const optional = this.toLines(config.optionalFields);
        const saveLabel = this.text(config.saveButtonLabel) === "Cập nhật" ? "Cập nhật" : "Lưu";
        const successExpected = this.text(config.successExpected) || spec.successDefault;
        const failExpected = this.text(config.failExpected) || spec.failDefault;
        const requiredLabel = required.join(", ");
        const optionalLabel = optional.join(", ");

        const testCases = [
            this.build({
                id: nextId(),
                type: "POSITIVE",
                name,
                label: spec.label,
                title: spec.successTitle,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, spec.openStep),
                    this.step(3, spec.fillStep(requiredLabel, optionalLabel)),
                    this.step(4, `Bấm "${saveLabel}"`)
                ],
                expectedResult: successExpected
            })
        ];

        required.forEach(field => {
            testCases.push(
                this.build({
                    id: nextId(),
                    type: "VALIDATION",
                    name,
                    label: spec.label,
                    title: spec.failTitle(field),
                    steps: [
                        this.step(1, `Mở màn hình ${name}`),
                        this.step(2, spec.openStep),
                        this.step(3, spec.missingStep(field)),
                        this.step(4, `Bấm "${saveLabel}"`)
                    ],
                    expectedResult: failExpected,
                    testData: this.testDataForMissingField(field)
                })
            );
        });

        return testCases;
    }

    buildDelete(name, config, nextId) {
        const blockingCases = this.toLines(config.blockingCases);
        const successExpected = this.text(config.successExpected) || DEFAULTS.DELETE_SUCCESS;
        const failExpected = this.text(config.failExpected) || DEFAULTS.DELETE_FAIL;
        const label = OPERATION_LABEL.DELETE;

        const testCases = [
            this.build({
                id: nextId(),
                type: "POSITIVE",
                name,
                label,
                title: `${label} ${name} thành công`,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, "Chọn bản ghi cần xóa đang tồn tại"),
                    this.step(3, "Xác nhận xóa")
                ],
                expectedResult: successExpected
            })
        ];

        blockingCases.forEach(caseText => {
            testCases.push(
                this.build({
                    id: nextId(),
                    type: "NEGATIVE",
                    name,
                    label,
                    title: `${label} ${name} không thành công khi ${this.lowerFirst(caseText)}`,
                    steps: [
                        this.step(1, `Mở màn hình ${name}`),
                        this.step(2, `Chọn bản ghi cần xóa đang ở trạng thái: ${caseText}`),
                        this.step(3, "Xác nhận xóa")
                    ],
                    expectedResult: failExpected
                })
            );
        });

        return testCases;
    }

    /** In ấn / Xuất Excel / Xuất Word dùng CHUNG công thức và cấu trúc bước, chỉ khác nhãn thao tác
     *  và câu mặc định "mặc định" có thêm "File được tạo và lưu trữ tại máy người dùng" cho Excel/
     *  Word (In ấn không có file lưu lại nên không thêm câu này). */
    buildPrintLike(name, config, nextId, operationKey) {
        const label = OPERATION_LABEL[operationKey];
        const isFileOutput = operationKey !== "PRINT";
        const criteria = this.toLines(config.criteria);
        const qualitySuffix = ` ${DEFAULTS.PRINT_LIKE_QUALITY}`;
        const fileSuffix = isFileOutput ? ` ${DEFAULTS.FILE_SAVED}` : "";

        const defaultExpected =
            this.text(config.defaultExpected) ||
            `Hệ thống ${label === "In ấn" ? "in" : "xuất"} toàn bộ danh sách hoặc trang đang chọn.${qualitySuffix}${fileSuffix}`;
        const hitExpected =
            this.text(config.criteriaHitExpected) ||
            `Hiển thị/xuất đúng dữ liệu theo tiêu chí đã chọn.${qualitySuffix}`;
        const missExpected = this.text(config.criteriaMissExpected) || DEFAULTS.NO_DATA;

        const actionVerb = label === "In ấn" ? "in" : "xuất";
        const testCases = [
            this.build({
                id: nextId(),
                type: "POSITIVE",
                name,
                label,
                title: `${label} ${name} mặc định (không chọn tiêu chí)`,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, `Không chọn tiêu chí lọc nào, thực hiện ${actionVerb}`)
                ],
                expectedResult: defaultExpected
            })
        ];

        if (criteria.length === 0) return testCases;

        testCases.push(
            this.build({
                id: nextId(),
                type: "POSITIVE",
                name,
                label,
                title: `${label} ${name} theo tiêu chí đã chọn, có dữ liệu phù hợp`,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, `Chọn tiêu chí lọc (${criteria.join(", ")}) có dữ liệu phù hợp`),
                    this.step(3, `Thực hiện ${actionVerb}`)
                ],
                expectedResult: hitExpected
            }),
            this.build({
                id: nextId(),
                type: "NEGATIVE",
                name,
                label,
                title: `${label} ${name} theo tiêu chí đã chọn, không có dữ liệu phù hợp`,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, `Chọn tiêu chí lọc (${criteria.join(", ")}) không có dữ liệu phù hợp`),
                    this.step(3, `Thực hiện ${actionVerb}`)
                ],
                expectedResult: missExpected
            })
        );

        return testCases;
    }

    buildReport(name, config, nextId) {
        const criteria = this.toCriteriaList(config.criteria);
        const requiredCriteria = criteria.filter(item => item.required);
        const allNames = criteria.map(item => item.name);
        const label = OPERATION_LABEL.REPORT;

        const successExpected =
            this.text(config.successExpected) ||
            `Báo cáo được lập với các tiêu chí đã chọn. Thông tin biểu mẫu đúng, không sai canh chỉnh, dữ liệu chính xác, không sai chính tả`;
        const missingExpected = this.text(config.missingExpected) || DEFAULTS.REPORT_MISSING;
        const noDataExpected = this.text(config.noDataExpected) || DEFAULTS.NO_DATA;

        const testCases = [
            this.build({
                id: nextId(),
                type: "POSITIVE",
                name,
                label,
                title: `${label} ${name} thành công với đầy đủ tiêu chí`,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, `Chọn đầy đủ tiêu chí báo cáo${allNames.length ? ` (${allNames.join(", ")})` : ""}`),
                    this.step(3, "Thực hiện lập báo cáo")
                ],
                expectedResult: successExpected
            })
        ];

        requiredCriteria.forEach(item => {
            testCases.push(
                this.build({
                    id: nextId(),
                    type: "VALIDATION",
                    name,
                    label,
                    title: `${label} ${name} không thành công khi thiếu ${item.name}`,
                    steps: [
                        this.step(1, `Mở màn hình ${name}`),
                        this.step(2, `Chọn tiêu chí báo cáo, để trống ${item.name}`),
                        this.step(3, "Thực hiện lập báo cáo")
                    ],
                    expectedResult: missingExpected,
                    testData: this.testDataForMissingField(item.name)
                })
            );
        });

        testCases.push(
            this.build({
                id: nextId(),
                type: "NEGATIVE",
                name,
                label,
                title: `${label} ${name} với đầy đủ tiêu chí nhưng không có dữ liệu phù hợp`,
                steps: [
                    this.step(1, `Mở màn hình ${name}`),
                    this.step(2, `Chọn đầy đủ tiêu chí báo cáo${allNames.length ? ` (${allNames.join(", ")})` : ""}, không có dữ liệu phù hợp`),
                    this.step(3, "Thực hiện lập báo cáo")
                ],
                expectedResult: noDataExpected
            })
        );

        return testCases;
    }

    /* ------------------------------- helpers ------------------------------- */

    build({ id, type, name, label, title, steps, expectedResult, testData }) {
        return {
            id,
            testcaseId: id,
            module: name,
            feature: `${label} ${name}`,
            function: `${label} ${name}`,
            type,
            title,
            scenario: title,
            testScenario: title,
            preconditions: [],
            testData: testData ?? { fields: {}, requirement: "", value: "", requiresTesterInput: false },
            steps,
            expectedResult,
            expectedResults: [expectedResult],
            reviewStatus: "PENDING",
            source: "TEMPLATE",
            automationCandidate: false
        };
    }

    step(order, action) {
        return { order, action, expected: "" };
    }

    testDataForMissingField(fieldName) {
        return {
            fields: {
                [fieldName]: { value: "", purpose: "EMPTY" }
            },
            requirement: "",
            value: "",
            requiresTesterInput: false
        };
    }

    /** "Tên trường/tiêu chí" nhập nhiều dòng (textarea) -> tách từng dòng, bỏ dòng rỗng, giữ nguyên
     *  thứ tự nhập (không sắp xếp lại — thứ tự người dùng nhập có thể có ý nghĩa). */
    toLines(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.text(item)).filter(Boolean);
        }
        return String(value ?? "")
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
    }

    /** Tiêu chí Lập báo cáo — mỗi dòng có thể là chuỗi thuần (mặc định KHÔNG bắt buộc) hoặc object
     *  {name, required} (wizard gửi lên khi tester tick "bắt buộc" cho tiêu chí đó). */
    toCriteriaList(value) {
        const list = Array.isArray(value) ? value : this.toLines(value);
        return list
            .map(item => {
                if (this.isObject(item)) {
                    const name = this.text(item.name ?? item.label);
                    return name ? { name, required: item.required === true } : null;
                }
                const name = this.text(item);
                return name ? { name, required: false } : null;
            })
            .filter(Boolean);
    }

    lowerFirst(value) {
        const text = this.text(value);
        return text ? text.charAt(0).toLocaleLowerCase("vi") + text.slice(1) : "";
    }

    text(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    isObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }
}

export { OPERATION_ORDER, OPERATION_LABEL };
