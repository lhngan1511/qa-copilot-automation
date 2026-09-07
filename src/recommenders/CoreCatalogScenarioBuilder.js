import { domainName, localizedFunctionName } from "../utils/FunctionDisplayName.js";

/**
 * Bổ sung các tình huống catalog tối thiểu mà tester luôn kỳ vọng
 * khi requirement có Tìm kiếm / Thêm mới / Sửa / Xóa:
 *   - Tìm kiếm có kết quả
 *   - Tìm kiếm không có kết quả
 *   - Thêm với đầy đủ thông tin
 *   - Thêm không nhập mã (hệ thống tự sinh) khi mã không bắt buộc
 *   - Cập nhật với dữ liệu hợp lệ
 *   - Xóa thành công
 *
 * Sửa/Xóa được thêm vào đây (2026-09-04, bug thật đã gặp qua log server thật: "Xóa/Sửa" bị
 * ProductionTestCaseQualityGate loại vì MISSING_MAIN_ACTION) — testcase "thành công" gốc của 2
 * operation này được sinh qua ScenarioRecommendationEngine#generateFromStructuredFunctions, bước
 * đó lấy steps qua userSteps(reviewedFunction.flow) — CHỈ nhận dòng bắt đầu bằng "Người dùng "
 * (đúng định dạng requirement .md viết tay). Bản ghi CodeGen sinh flow dạng khác hẳn (vd
 * `Bấm "Xóa"`, `Chọn "..."`  — xem CodeGenRequirementDocumentBuilder#actionLabel), KHÔNG BAO GIỜ
 * khớp tiền tố đó -> userSteps() luôn trả về RỖNG cho mọi requirement nguồn CodeGen -> testcase
 * Sửa/Xóa mất bước thực hiện cụ thể -> bị loại. Tìm kiếm/Thêm mới KHÔNG bị ảnh hưởng vì ĐÃ có
 * catalog riêng ở đây từ trước, dùng steps TỰ VIẾT (searchSteps/createSteps), không phụ thuộc
 * userSteps(). Sửa/Xóa giờ được đối xử NHẤT QUÁN — cùng cơ chế, cùng độ tin cậy.
 */
export default class CoreCatalogScenarioBuilder {
    apply(scenarios, knowledge, requirement) {
        const list = Array.isArray(scenarios) ? scenarios : [];
        const functions = this.functions(knowledge, requirement);

        functions.forEach(fn => {
            if (this.isSearch(fn)) this.ensureSearchCatalog(list, fn, knowledge);
            if (this.isCreate(fn)) this.ensureCreateCatalog(list, fn, knowledge, requirement);
            if (this.isUpdate(fn)) this.ensureUpdateCatalog(list, fn, knowledge, requirement);
            if (this.isDelete(fn)) this.ensureDeleteCatalog(list, fn, knowledge, requirement);
        });

        return list;
    }

    ensureSearchCatalog(scenarios, fn, knowledge) {
        const existing = this.byFunction(scenarios, fn);
        if (!this.hasCatalog(existing, "SEARCH_HIT") && !this.hasSearchHit(existing, fn)) {
            scenarios.push(
                this.buildScenario(fn, knowledge, {
                    catalogKey: "SEARCH_HIT",
                    title: `Tìm kiếm ${this.entity(fn)} có kết quả`,
                    type: "POSITIVE",
                    operation: "SEARCH",
                    expectedResults: [
                        `Hệ thống hiển thị các ${this.entity(fn)} khớp với từ khóa tìm kiếm.`
                    ],
                    steps: this.searchSteps(fn, "có bản ghi phù hợp")
                })
            );
        }

        if (!this.hasDedicatedSearchMiss(existing, fn)) {
            scenarios.push(
                this.buildScenario(fn, knowledge, {
                    catalogKey: "SEARCH_MISS",
                    title: `Tìm kiếm ${this.entity(fn)} không có kết quả`,
                    type: "POSITIVE",
                    operation: "SEARCH",
                    ruleClassification: "NO_RESULT",
                    sourceItems: [
                        {
                            content: `Không tìm thấy ${this.entity(fn)} phù hợp với từ khóa`,
                            source: "NO_RESULT"
                        }
                    ],
                    expectedResults: [
                        "Hệ thống hiển thị trạng thái không có dữ liệu phù hợp và không hiển thị bản ghi sai điều kiện."
                    ],
                    steps: this.searchSteps(fn, "không có bản ghi phù hợp")
                })
            );
        }
    }

    ensureCreateCatalog(scenarios, fn, knowledge, requirement) {
        const existing = this.byFunction(scenarios, fn);
        if (!this.hasCatalog(existing, "CREATE_FULL") && !this.hasFullCreate(existing, fn)) {
            scenarios.push(
                this.buildScenario(fn, knowledge, {
                    catalogKey: "CREATE_FULL",
                    title: `Thêm ${this.entity(fn)} với đầy đủ thông tin`,
                    type: "POSITIVE",
                    operation: "CREATE",
                    expectedResults: [
                        `Hệ thống lưu ${this.entity(fn)} thành công và bản ghi xuất hiện trong danh sách với đúng thông tin đã nhập.`
                    ],
                    steps: this.createSteps(fn, false)
                })
            );
        }

        if (!this.allowsEmptyCode(fn, knowledge, requirement)) return;
        if (this.hasDedicatedAutoCode(existing, fn)) return;

        const codeField = this.codeField(fn, knowledge, requirement);
        scenarios.push(
            this.buildScenario(fn, knowledge, {
                catalogKey: "CREATE_AUTO_CODE",
                title: `Thêm ${this.entity(fn)} khi không nhập ${codeField}`,
                type: "POSITIVE",
                operation: "CREATE",
                ruleClassification: "AUTO_GENERATED",
                sourceItems: [
                    {
                        content: `Khi ${codeField} được để trống, hệ thống tự sinh ${codeField}`,
                        source: "AUTO_GENERATED"
                    }
                ],
                expectedResults: [
                    `Hệ thống tự sinh ${codeField} khi để trống và lưu ${this.entity(fn)} thành công.`
                ],
                steps: this.createSteps(fn, true, codeField)
            })
        );
    }

    /** Cập nhật/Xóa: KHÔNG thêm 1 scenario MỚI song song (sẽ trùng lặp với testcase "thành công"
     *  gốc do generateFromStructuredFunctions sinh — đúng bug "TC005/TC006 gần như trùng lặp" đã sửa
     *  trước đó). Thay vào đó, VÁ TRỰC TIẾP scenario "thành công" gốc của function này nếu nó đang
     *  thiếu bước thực hiện cụ thể (do userSteps() không hiểu định dạng flow CodeGen — xem ghi chú ở
     *  class), gắn catalogKey để cùng được hưởng độ tin cậy như Tìm kiếm/Thêm mới (bỏ qua kiểm tra
     *  isGrounded/isAmbiguous nghiêm ngặt — nội dung vẫn đến từ đúng requirement/clarification, chỉ
     *  bước thực hiện bị thiếu). KHÔNG đụng vào scenario đã có bước thực hiện hợp lệ (vd requirement
     *  .md viết tay đúng định dạng "Người dùng ...") — chỉ vá khi thật sự cần. */
    ensureFollowUpCatalog(scenarios, fn, knowledge, requirement, { catalogKey, title, operation, fallbackExpectedResult, steps }) {
        const existing = this.byFunction(scenarios, fn);
        const nativePositive = existing.find(
            item => String(item.type ?? "").toUpperCase() === "POSITIVE" && !item.catalogKey
        );
        if (nativePositive) {
            if (!this.hasMeaningfulSteps(nativePositive.steps)) {
                nativePositive.steps = steps;
                nativePositive.catalogKey = catalogKey;
            }
            return;
        }
        if (this.hasCatalog(existing, catalogKey)) return;
        scenarios.push(
            this.buildScenario(fn, knowledge, {
                catalogKey,
                title,
                type: "POSITIVE",
                operation,
                expectedResults: this.confirmedExpectedResults(fn, requirement, fallbackExpectedResult),
                steps
            })
        );
    }

    ensureUpdateCatalog(scenarios, fn, knowledge, requirement) {
        this.ensureFollowUpCatalog(scenarios, fn, knowledge, requirement, {
            catalogKey: "UPDATE_VALID",
            title: `Cập nhật ${this.entity(fn)} với dữ liệu hợp lệ`,
            operation: "UPDATE",
            fallbackExpectedResult: `Hệ thống lưu thay đổi thành công và ${this.entity(fn)} hiển thị đúng thông tin mới.`,
            steps: this.updateSteps(fn)
        });
    }

    ensureDeleteCatalog(scenarios, fn, knowledge, requirement) {
        this.ensureFollowUpCatalog(scenarios, fn, knowledge, requirement, {
            catalogKey: "DELETE_VALID",
            title: `Xóa ${this.entity(fn)} thành công`,
            operation: "DELETE",
            fallbackExpectedResult: `Hệ thống xóa ${this.entity(fn)} thành công và ${this.entity(fn)} không còn xuất hiện trong danh sách.`,
            steps: this.deleteSteps(fn)
        });
    }

    /** feature.expectedResults (ĐÃ được QACopilot#applyOracleConfirmationAnswers thay bằng văn bản
     *  tester xác nhận, nếu có — xem ghi chú ở đó) là nguồn ƯU TIÊN, phản ánh ĐÚNG những gì tester đã
     *  xác nhận thay vì suy đoán bằng câu mẫu chung chung. Rơi về fallback khi feature CHƯA có
     *  expectedResults thật (vẫn "Chưa xác định" hoặc rỗng). */
    confirmedExpectedResults(fn, requirement, fallback) {
        const feature = this.featureOf(requirement, fn);
        const values = this.array(feature?.expectedResults).filter(
            value => typeof value === "string" && value.trim() && !/chưa xác định/i.test(value)
        );
        return values.length > 0 ? values : [fallback];
    }

    hasMeaningfulSteps(steps) {
        return (
            Array.isArray(steps) &&
            steps.length > 0 &&
            steps.some(step => String(step?.action ?? "").trim())
        );
    }

    updateSteps(fn) {
        const screen = this.functionLabel(fn, "UPDATE");
        return [
            { order: 1, action: `Mở màn hình ${screen}`, target: fn.name },
            { order: 2, action: "Chọn bản ghi cần sửa đang tồn tại", target: fn.name },
            { order: 3, action: "Thay đổi thông tin hợp lệ", target: fn.name },
            { order: 4, action: "Lưu dữ liệu", target: fn.name }
        ];
    }

    deleteSteps(fn) {
        const screen = this.functionLabel(fn, "DELETE");
        return [
            { order: 1, action: `Mở màn hình ${screen}`, target: fn.name },
            { order: 2, action: "Chọn bản ghi cần xóa đang tồn tại", target: fn.name },
            { order: 3, action: "Xác nhận xóa", target: fn.name }
        ];
    }

    isUpdate(fn) {
        const operation = this.operation(fn);
        return operation === "UPDATE" || /^(sửa|cập nhật|chỉnh sửa)\b/.test(this.comparable(fn.name));
    }

    isDelete(fn) {
        const operation = this.operation(fn);
        return operation === "DELETE" || /^(xóa|xoá)\b/.test(this.comparable(fn.name));
    }

    buildScenario(fn, knowledge, extra) {
        return {
            module: this.text(knowledge?.module?.name) || this.text(fn.module),
            moduleId: this.text(knowledge?.module?.id) || this.text(fn.moduleId),
            feature: fn.name,
            functionId: fn.id,
            functionName: fn.name,
            function: fn.name,
            reason: "Core catalog",
            description: extra.title,
            source: "CORE_CATALOG",
            inputDefinitions: this.inputs(fn),
            preconditions: this.array(fn.preconditions),
            coveredRules: extra.sourceItems?.map(item => item.content) ?? [],
            sourceReferences: [],
            ...extra
        };
    }

    searchSteps(fn, dataState) {
        const screen = this.functionLabel(fn, "SEARCH");
        return [
            { order: 1, action: `Mở màn hình ${screen}`, target: fn.name },
            {
                order: 2,
                action: "Nhập từ khóa tìm kiếm",
                target: this.searchField(fn),
                value: dataState
            },
            { order: 3, action: "Thực hiện tìm kiếm", target: fn.name }
        ];
    }

    createSteps(fn, emptyCode, codeField = this.codeField(fn)) {
        const screen = this.functionLabel(fn, "CREATE");
        const steps = [
            { order: 1, action: `Mở màn hình ${screen}`, target: fn.name },
            { order: 2, action: `Chọn chức năng ${screen}`, target: fn.name }
        ];
        if (emptyCode) {
            steps.push({
                order: 3,
                action: `Để trống ${codeField} để hệ thống tự sinh`,
                target: codeField,
                value: ""
            });
            steps.push({
                order: 4,
                action: "Nhập dữ liệu hợp lệ cho các trường còn lại",
                target: fn.name
            });
        } else {
            steps.push({
                order: 3,
                action: "Nhập đầy đủ thông tin hợp lệ",
                target: fn.name
            });
        }
        steps.push({
            order: steps.length + 1,
            action: "Lưu dữ liệu",
            target: fn.name
        });
        return steps;
    }

    functions(knowledge, requirement) {
        const fromKnowledge = this.array(knowledge?.functions).filter(item => this.text(item?.name));
        if (fromKnowledge.length > 0) {
            return fromKnowledge.map(item => ({
                ...item,
                inputs: this.inputs(item).length ? this.inputs(item) : this.featureInputs(requirement, item),
                automation: item.automation ?? this.featureOf(requirement, item)?.automation,
                businessRules: this.ruleTexts(item.businessRules),
                exceptions: this.ruleTexts(item.exceptions),
                preconditions: this.array(item.preconditions)
            }));
        }
        return this.array(requirement?.features)
            .filter(item => this.text(item?.name))
            .map(item => ({
                ...item,
                inputs: this.inputs(item),
                businessRules: this.ruleTexts(item.businessRules),
                exceptions: this.ruleTexts(item.exceptions)
            }));
    }

    featureOf(requirement, fn) {
        return this.array(requirement?.features).find(
            feature =>
                this.same(feature?.id, fn?.id) || this.same(feature?.name, fn?.name)
        );
    }

    featureInputs(requirement, fn) {
        return this.inputs(this.featureOf(requirement, fn));
    }

    isSearch(fn) {
        const operation = this.operation(fn);
        return operation === "SEARCH" || /tìm kiếm|tra cứu|lọc/.test(this.comparable(fn.name));
    }

    isCreate(fn) {
        const operation = this.operation(fn);
        return operation === "CREATE" || /^(thêm|tạo mới|thêm mới)\b/.test(this.comparable(fn.name));
    }

    operation(fn) {
        return String(fn?.automation?.operation ?? fn?.operation ?? "")
            .trim()
            .toUpperCase()
            .replace(/[\s_-]+/g, "");
    }

    allowsEmptyCode(fn, knowledge, requirement) {
        const inputs = this.collectCodeInputs(fn, knowledge, requirement);
        const field = inputs.find(input => /mã|code/i.test(input.name));
        if (field && field.required === false) return true;
        if (field && /khong bat buoc|co the de trong|de trong/.test(this.comparable(field.description))) {
            return true;
        }
        const rules = [
            ...this.ruleTexts(fn.businessRules),
            ...this.ruleTexts(fn.validationRules),
            ...this.ruleTexts(knowledge?.businessRules),
            ...this.ruleTexts(requirement?.relationships?.map(item => item.description ?? item)),
            ...inputs.map(input => input.description)
        ].join(" ");
        return /(?:de trong|khong nhap).*(?:tu sinh|tu dong sinh)|(?:tu sinh|tu dong sinh).*(?:de trong|khong nhap)|ma .* khong bat buoc/.test(
            this.comparable(rules)
        );
    }

    collectCodeInputs(fn, knowledge, requirement) {
        const feature = this.featureOf(requirement, fn);
        return [
            ...this.inputs(fn),
            ...this.inputs(feature),
            ...this.inputs({ inputs: requirement?.commonInputs }),
            ...this.inputs({ inputs: requirement?.inputDefinitions }),
            ...this.array(knowledge?.functions).flatMap(item => this.inputs(item))
        ];
    }

    codeField(fn) {
        return this.inputs(fn).find(input => /mã|code/i.test(input.name))?.name || "Mã";
    }

    searchField(fn) {
        return (
            this.inputs(fn).find(input => /từ khóa|tìm kiếm|search/i.test(input.name))?.name ||
            "Từ khóa tìm kiếm"
        );
    }

    entity(fn) {
        return domainName(fn?.name, "dữ liệu");
    }

    functionLabel(fn, operation) {
        return localizedFunctionName(fn?.name, operation || this.operation(fn));
    }

    hasCatalog(scenarios, key) {
        return scenarios.some(item => item.catalogKey === key);
    }

    hasSearchHit(scenarios, fn) {
        return scenarios.some(
            item =>
                this.sameFunction(item, fn) &&
                String(item.type).toUpperCase() === "POSITIVE" &&
                /có kết quả|khớp|phù hợp/.test(this.comparable(item.title))
        );
    }

    hasDedicatedSearchMiss(scenarios, fn) {
        return scenarios.some(item => {
            if (!this.sameFunction(item, fn)) return false;
            if (item.catalogKey === "SEARCH_MISS") return true;
            const title = this.comparable(item.title);
            const classification = String(item.ruleClassification ?? "").toUpperCase();
            return (
                /khong co ket qua|khong tim thay/.test(title) &&
                ["POSITIVE", "VALIDATION", "NEGATIVE"].includes(String(item.type ?? "").toUpperCase())
            ) || ["NO_RESULT", "EMPTY_RESULT"].includes(classification);
        });
    }

    hasFullCreate(scenarios, fn) {
        return scenarios.some(
            item =>
                this.sameFunction(item, fn) &&
                String(item.type).toUpperCase() === "POSITIVE" &&
                /đầy đủ|hợp lệ/.test(this.comparable(item.title))
        );
    }

    hasDedicatedAutoCode(scenarios, fn) {
        return scenarios.some(item => {
            if (!this.sameFunction(item, fn)) return false;
            if (item.catalogKey === "CREATE_AUTO_CODE") return true;
            if (String(item.ruleClassification ?? "").toUpperCase() === "AUTO_GENERATED") return true;
            return /de trong.*ma|khong nhap ma|tu sinh/.test(this.comparable(item.title));
        });
    }

    byFunction(scenarios, fn) {
        return scenarios.filter(item => this.sameFunction(item, fn));
    }

    sameFunction(scenario, fn) {
        return (
            this.same(scenario.functionId, fn.id) ||
            this.same(scenario.feature, fn.name) ||
            this.same(scenario.function, fn.name) ||
            this.same(scenario.functionName, fn.name)
        );
    }

    inputs(value) {
        return this.array(value?.inputs ?? value?.inputDefinitions)
            .map(item => ({
                name: this.text(item?.name ?? item?.inputName ?? item?.fieldName ?? item?.["Trường"]),
                required: item?.required === true || /^(có|yes|true)$/i.test(String(item?.["Bắt buộc"] ?? "")),
                description: this.text(item?.description ?? item?.rule ?? item?.["Quy tắc"])
            }))
            .filter(item => item.name);
    }

    ruleTexts(values) {
        return this.array(values)
            .map(value => this.text(typeof value === "string" ? value : value?.content ?? value?.description))
            .filter(Boolean);
    }

    array(value) {
        return Array.isArray(value) ? value : [];
    }

    text(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    same(left, right) {
        return Boolean(this.comparable(left) && this.comparable(left) === this.comparable(right));
    }

    comparable(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[.!?;:,]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }
}
