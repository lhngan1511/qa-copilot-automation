import RecommendedScenario from "../models/RecommendedScenario.js";

class ScenarioRecommendationEngine {
    constructor() {
        this.counter = 1;
    }

    /*
    =================================================
     Generate Recommended Scenarios
    =================================================
    */

    generate(knowledge, requirement) {
        if (!knowledge) {
            return [];
        }

        this.counter = 1;

        const scenarios = [];

        if (
            knowledge.module &&
            Array.isArray(knowledge.functions) &&
            knowledge.functions.length > 0
        ) {
            this.generateFromStructuredFunctions(knowledge, scenarios, requirement);
            this.generateOwnedSuggestions(knowledge, scenarios, requirement);
            this.mergeConfirmedFacts(knowledge, scenarios, requirement);
            return this.removeDuplicateScenarios(scenarios);
        }

        this.generateFromList(
            knowledge.positiveCases,
            "POSITIVE",
            "MEDIUM",
            scenarios,
            requirement
        );

        this.generateFromList(knowledge.negativeCases, "NEGATIVE", "HIGH", scenarios, requirement);

        this.generateFromList(
            knowledge.boundaryCases,
            "BOUNDARY",
            "MEDIUM",
            scenarios,
            requirement
        );

        this.generateFromList(knowledge.securityCases, "SECURITY", "HIGH", scenarios, requirement);

        this.generateFromList(
            knowledge.permissionCases,
            "PERMISSION",
            "HIGH",
            scenarios,
            requirement
        );

        this.generateFromList(
            knowledge.dataIntegrityCases,
            "DATA_INTEGRITY",
            "HIGH",
            scenarios,
            requirement
        );

        this.mergeConfirmedFacts(knowledge, scenarios, requirement);
        return this.removeDuplicateScenarios(scenarios);
    }

    mergeConfirmedFacts(knowledge, scenarios, requirement) {
        const confirmed = this.collectConfirmedKnowledge(knowledge);
        if (confirmed.length === 0) return;

        /*
         Feed the confirmed knowledge into the existing recommendation
         context: each fact that already maps onto a business scenario
         (matched by its covered rules / expected results) is attached to
         that scenario and traced back to its CLARIFICATION source. This is
         the primary path - confirmed facts stay inside the business
         scenario they belong to instead of becoming standalone entries.
         */

        const uncovered = [];
        confirmed.forEach(item => {
            const normalized = this.normalizeForComparison(item.fact);
            const existing = scenarios.find(scenario =>
                this.matchesConfirmedFact(scenario, normalized)
            );
            if (existing) {
                existing.sourceReferences = this.mergeSourceReferences(
                    existing.sourceReferences,
                    item.references
                );
                if (
                    Array.isArray(existing.expectedResults) &&
                    !existing.expectedResults.some(value =>
                        this.normalizeForComparison(value) === normalized
                    )
                ) {
                    existing.expectedResults.push(item.fact);
                }
                return;
            }
            uncovered.push(item);
        });

        /*
         Facts that are not covered by an existing business scenario are
         classified semantically:
         - a fact that describes an independent test behaviour becomes its own
           business scenario (never a generic "group" of unrelated facts);
         - the scenario type and title are derived from the fact's meaning
           (login failure -> NEGATIVE, masking -> VALIDATION, attempt limit ->
           BUSINESS_RULE), so the final test type is not a catch-all
           CONFIRMED_FACT when a concrete business type is known.
         Each scenario keeps its CLARIFICATION source reference.
         */

        if (uncovered.length === 0) return;

        uncovered.forEach(item => {
            const scenario = this.buildConfirmedFactScenario(knowledge, item, requirement);
            if (!scenario) return;
            this.generateFromList(
                [scenario],
                scenario.type,
                scenario.priority || "HIGH",
                scenarios,
                requirement
            );
        });
    }

    collectConfirmedKnowledge(knowledge) {
        const sourceMap = this.isPlainObject(knowledge?.knowledgeSources)
            ? knowledge.knowledgeSources
            : {};
        const result = [];

        [
            "confirmedFacts",
            "businessRules",
            "validationRules",
            "permissions",
            "boundaryCases"
        ].forEach(field => {
            const facts = Array.isArray(knowledge[field]) ? knowledge[field] : [];
            const bucket = this.isPlainObject(sourceMap[field]) ? sourceMap[field] : {};
            facts.forEach(fact => {
                if (typeof fact !== "string" || !fact.trim()) return;
                const normalized = this.normalizeForComparison(fact);
                const trackedKey = Object.keys(bucket).find(
                    key => this.normalizeForComparison(key) === normalized
                );
                const references =
                    trackedKey !== undefined && Array.isArray(bucket[trackedKey])
                        ? bucket[trackedKey]
                        : [];
                /*
                 Only the dedicated confirmedFacts bucket is trusted on its
                 own. For the semantic collections a confirmed fact must carry
                 a CLARIFICATION source reference, otherwise it is a regular
                 rule already represented by the normal recommendation flow.
                 */
                if (field !== "confirmedFacts" && references.length === 0) return;
                if (result.some(item => this.normalizeForComparison(item.fact) === normalized)) {
                    return;
                }
                result.push({ fact, references, field });
            });
        });

        return result;
    }

    matchesConfirmedFact(scenario, normalized) {
        const candidateTexts = [
            ...this.getArray(scenario.coveredRules),
            ...this.getArray(scenario.expectedResults),
            ...this.getArray(scenario.sourceItems).map(item =>
                this.getText(item?.content ?? item?.rule ?? item?.title ?? "")
            )
        ];
        return candidateTexts.some(value =>
            this.normalizeForComparison(value) === normalized
        );
    }

    buildConfirmedFactScenario(knowledge, item, requirement) {
        const feature = this.resolveConfirmedFeature(knowledge, requirement);
        const moduleName =
            this.getText(knowledge?.module?.name) ||
            this.extractModuleFromFeature(this.getText(requirement?.feature)) ||
            this.getText(feature) ||
            "Chức năng";
        const fact = item.fact;
        const classification = this.classifyConfirmedFact(feature, fact);

        return {
            module: moduleName,
            moduleId: this.getText(knowledge?.module?.id),
            feature,
            functionId: this.getText(knowledge?.module?.id),
            functionName: feature,
            title: classification.title,
            type: classification.type,
            priority: classification.priority || "HIGH",
            reason: "Tester-confirmed fact",
            description: classification.title,
            expectedResults: [fact],
            coveredRules: [fact],
            sourceReferences: this.cloneRefs(item.references)
        };
    }

    classifyConfirmedFact(feature, fact) {
        const f = this.capitalize(this.getText(feature) || "Chức năng");
        const normalized = this.comparable(fact);

        /*
         Attempt limit / lockout -> a boundary-style business rule.
         Keep the confirmed count in the title when present.
         */
        if (
            /(gioi han|so lan|khong qua|toi da|toi thieu|khoa tai khoan|khoa tai khoan sau|\blan\b)/.test(
                normalized
            )
        ) {
            const count = String(fact ?? "").match(/\d+/)?.[0];
            const limit = count ? `${count} lần` : "số lần quy định";
            return {
                title: `${f} sai quá ${limit} và kiểm tra cơ chế giới hạn`,
                type: "BUSINESS_RULE",
                priority: "HIGH"
            };
        }

        /*
         Password masking / hidden input -> a validation concern.
         */
        if (/che dau|masking|bi an|an mat|khong hien thi/.test(normalized)) {
            return {
                title: `${f} với mật khẩu được che dấu khi nhập`,
                type: "VALIDATION",
                priority: "HIGH"
            };
        }

        /*
         Wrong credentials / failed login -> negative behaviour.
         */
        if (
            /(sai (mat khau|tai khoan)|sai thong tin dang nhap|khong duoc dang nhap|dang nhap that bai|dang nhap khong thanh cong|mat khau.*khong (dung|chinh xac)|tai khoan.*khong (dung|chinh xac))/.test(
                normalized
            )
        ) {
            return {
                title: `${f} sai mật khẩu và kiểm tra phản hồi`,
                type: "NEGATIVE",
                priority: "HIGH"
            };
        }

        /*
         Generic failure handling.
         */
        if (/(loi|fail|that bai|khong hop le|khong duoc)/.test(normalized)) {
            return {
                title: `${f} và xử lý đúng phản hồi lỗi`,
                type: "NEGATIVE",
                priority: "HIGH"
            };
        }

        /*
         Fallback: treat as an independent confirmed behaviour with a business
         title (never the raw fact as title).
         */
        return {
            title: `${f}: ${this.getText(fact)}`,
            type: "CONFIRMED_FACT",
            priority: "HIGH"
        };
    }

    resolveConfirmedFeature(knowledge, requirement) {
        const functions = this.getArray(knowledge?.functions).filter(
            fn => this.getText(fn?.name)
        );
        if (functions.length === 1) {
            return this.getText(functions[0].name);
        }
        const moduleName = this.getText(knowledge?.module?.name);
        if (moduleName) {
            return this.capitalize(moduleName);
        }
        const feature = this.getText(requirement?.feature);
        return feature || "Chức năng";
    }

    comparable(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    cloneRefs(references) {
        return (Array.isArray(references) ? references : []).map(reference => ({ ...reference }));
    }

    capitalize(value) {
        const text = this.getText(value);
        return text ? text.charAt(0).toLocaleUpperCase("vi") + text.slice(1) : "";
    }

    mergeSourceReferences(current, incoming) {
        const result = Array.isArray(current) ? [...current] : [];
        (Array.isArray(incoming) ? incoming : []).forEach(reference => {
            if (!reference || !reference.sourceType || !reference.sourceId) return;
            if (!result.some(item => item.sourceType === reference.sourceType && item.sourceId === reference.sourceId)) result.push({ ...reference });
        });
        return result;
    }

    generateFromStructuredFunctions(knowledge, scenarios, requirement) {
        const moduleName = this.getText(knowledge.module?.name);
        const moduleId = this.getText(knowledge.module?.id);

        knowledge.functions.forEach(functionKnowledge => {
            const functionName = this.getText(functionKnowledge?.name);
            const functionId = this.getText(functionKnowledge?.id);

            if (!functionName || !functionId) {
                return;
            }

            const reviewedFunction = this.findReviewedFunction(requirement, functionKnowledge);
            const context = {
                module: moduleName,
                moduleId,
                feature: functionName,
                functionId,
                functionName,
                preconditions: this.getArray(functionKnowledge.preconditions),
                inputDefinitions: this.getArray(reviewedFunction?.inputs),
                steps: this.userSteps(reviewedFunction?.flow),
                operation: this.getText(reviewedFunction?.automation?.operation),
                requirementReferences: this.getArray(functionKnowledge.requirementReferences),
                source: knowledge.source || "Approved Module Artifact"
            };
            const permissionRules = this.uniqueRules([
                ...this.getArray(functionKnowledge.permissions),
                ...this.filterRules(functionKnowledge.businessRules, value =>
                    this.hasPermissionEvidence(value)
                )
            ]);
            const businessRules = this.filterRules(
                functionKnowledge.businessRules,
                value => !this.hasPermissionEvidence(value)
            );
            const requiredValidations = this.filterRules(functionKnowledge.validationRules, value =>
                /không được để trống|bỏ trống|required/i.test(value)
            );
            const valueValidations = this.filterRules(
                functionKnowledge.validationRules,
                value => !/không được để trống|bỏ trống|required/i.test(value)
            );
            const candidates = [
                {
                    ...context,
                    title: functionName,
                    type: "POSITIVE",
                    priority: "MEDIUM",
                    reason: functionKnowledge.description || "Approved business function",
                    description: functionKnowledge.description || "",
                    expectedResults: this.resolvePositiveExpectedResults(
                        reviewedFunction,
                        functionKnowledge,
                        functionName
                    ),
                    coveredRules: context.requirementReferences
                },
                this.buildGroupedCandidate(
                    businessRules,
                    context,
                    "BUSINESS_RULE",
                    "HIGH",
                    `Kiểm tra quy tắc nghiệp vụ của ${functionName}`,
                    "BUSINESS_RULE"
                ),
                this.buildGroupedCandidate(
                    requiredValidations,
                    context,
                    "VALIDATION",
                    "HIGH",
                    `Kiểm tra các trường bắt buộc của ${functionName}`,
                    "REQUIRED_VALIDATION"
                ),
                this.buildGroupedCandidate(
                    valueValidations,
                    context,
                    "VALIDATION",
                    "HIGH",
                    `Kiểm tra định dạng hoặc giá trị không hợp lệ của ${functionName}`,
                    "FORMAT_OR_VALUE_VALIDATION"
                ),
                this.buildGroupedCandidate(
                    permissionRules,
                    context,
                    "PERMISSION",
                    "HIGH",
                    `Kiểm tra quyền thực hiện ${functionName}`,
                    "PERMISSION"
                ),
                this.buildGroupedCandidate(
                    this.filterConcreteBoundaries(functionKnowledge.boundaries),
                    context,
                    "BOUNDARY",
                    "MEDIUM",
                    `Kiểm tra điều kiện biên của ${functionName}`,
                    "BOUNDARY"
                ),
                this.buildGroupedCandidate(
                    functionKnowledge.exceptions,
                    context,
                    "EXCEPTION",
                    "HIGH",
                    `Kiểm tra ngoại lệ của ${functionName}`,
                    "EXCEPTION"
                ),
                this.buildGroupedCandidate(
                    this.filterTestableRisks(functionKnowledge.risks),
                    context,
                    "RISK",
                    "HIGH",
                    `Kiểm tra rủi ro của ${functionName}`,
                    "RISK"
                )
            ].filter(Boolean);

            candidates.forEach(candidate => {
                this.generateFromList(
                    [candidate],
                    candidate.type,
                    candidate.priority,
                    scenarios,
                    requirement
                );
            });
        });
    }

    buildGroupedCandidate(values, context, type, priority, title, groupType = type) {
        const contents = Array.isArray(values)
            ? values
                  .filter(value => typeof value === "string" && value.trim())
                  .map(value => value.trim())
            : [];
        if (contents.length === 0) return null;
        return {
            ...context,
            title,
            type,
            priority,
            reason: `${type} from approved function`,
            description: contents.join("; "),
            expectedResults: contents,
            coveredRules: contents,
            sourceItems: contents.map(content => ({
                content,
                source: groupType
            })),
            groupType,
            riskReason: type === "RISK" ? contents.join("; ") : ""
        };
    }

    filterRules(values, predicate) {
        return (Array.isArray(values) ? values : [])
            .filter(value => typeof value === "string" && value.trim())
            .filter(value => predicate(value.trim()));
    }

    filterConcreteBoundaries(values) {
        return (Array.isArray(values) ? values : []).filter(value => {
            if (typeof value !== "string") return false;
            const hasNumericLimit =
                /\d/.test(value) &&
                /tối đa|tối thiểu|min|max|giới hạn|độ dài|ký tự|số lượng|không quá|ít nhất|nhiều nhất/i.test(
                    value
                );
            const hasExplicitRelationship =
                /(?:<=|>=|<|>)|(?:nhỏ hơn|lớn hơn|trước|sau).*(?:hoặc bằng|bằng)|(?:ngày bắt đầu|startDate).*(?:ngày kết thúc|endDate)/i.test(
                    value
                );
            return hasNumericLimit || hasExplicitRelationship;
        });
    }

    hasPermissionEvidence(value) {
        return /(?:quyền|permission|role|vai trò|nhóm người dùng|được phép|không được phép|allow|deny|unauthorized)/i.test(
            String(value ?? "")
        );
    }

    uniqueRules(values) {
        const seen = new Set();
        return values.filter(value => {
            if (typeof value !== "string" || !value.trim()) return false;
            const key = this.normalizeForComparison(value).replace(/^(?:br|vr|pr)\s*\d+\s*/i, "");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    findReviewedFunction(requirement, functionKnowledge) {
        return this.getArray(requirement?.features).find(feature => {
            if (!feature || typeof feature !== "object") return false;
            return (
                this.normalizeForComparison(feature.id) ===
                    this.normalizeForComparison(functionKnowledge.id) ||
                this.normalizeForComparison(feature.name ?? feature.feature ?? feature.title) ===
                    this.normalizeForComparison(functionKnowledge.name)
            );
        });
    }

    userSteps(flow) {
        return this.getArray(flow)
            .filter(value => typeof value === "string" && /^người dùng\b/i.test(value.trim()))
            .map(value => {
                const action = value
                    .trim()
                    .replace(/^người dùng\s+/i, "")
                    .replace(/[.!?;:,]+$/g, "");
                return action
                    ? action.charAt(0).toLocaleUpperCase("vi") + action.slice(1)
                    : "";
            })
            .filter(Boolean);
    }

    resolvePositiveExpectedResults(reviewedFunction, functionKnowledge, functionName) {
        const reviewedResults = this.getArray(reviewedFunction?.expectedResults).filter(
            value => typeof value === "string" && value.trim()
        );
        if (reviewedResults.length > 0) return reviewedResults;

        return [];
    }

    filterTestableRisks(values) {
        return (Array.isArray(values) ? values : []).filter(value =>
            /lỗi|mất|trùng|xung đột|đồng thời|chậm|hiệu năng|quyền|không thể|thất bại/i.test(value)
        );
    }

    generateOwnedSuggestions(knowledge, scenarios, requirement) {
        if (!Array.isArray(knowledge.suggestedScenarios)) {
            return;
        }

        knowledge.suggestedScenarios.forEach(item => {
            if (!item || typeof item !== "object") {
                return;
            }

            const owner = knowledge.functions.find(
                functionKnowledge =>
                    (item.functionId && item.functionId === functionKnowledge.id) ||
                    this.normalizeForComparison(item.feature ?? item.function) ===
                        this.normalizeForComparison(functionKnowledge.name)
            );

            if (!owner) {
                return;
            }

            this.generateFromList(
                [
                    {
                        ...item,
                        module: knowledge.module.name,
                        moduleId: knowledge.module.id,
                        feature: owner.name,
                        functionId: owner.id,
                        functionName: owner.name
                    }
                ],
                "POSITIVE",
                "MEDIUM",
                scenarios,
                requirement
            );
        });
    }

    /*
    =================================================
     Generate Scenarios From Knowledge List
    =================================================
    */

    generateFromList(list, defaultType, defaultPriority, scenarios, requirement) {
        if (!Array.isArray(list) || list.length === 0) {
            return;
        }

        list.forEach(item => {
            const title = this.getScenarioTitle(item);

            if (!title) {
                return;
            }

            const feature = this.extractFeature(item, requirement);

            const type = this.getText(item?.type) || defaultType;

            const priority = this.getText(item?.priority) || defaultPriority;

            const scenario = new RecommendedScenario({
                id: `SC${String(this.counter++).padStart(3, "0")}`,

                title,

                /*
                    Module ưu tiên dữ liệu của item.

                    Nếu item chưa có module thì lấy
                    module của RequirementObject.
                    */

                module:
                    this.getText(item?.module) ||
                    this.getText(requirement?.module) ||
                    this.extractModuleFromFeature(this.getText(requirement?.feature)),

                /*
                    Feature được xác định theo từng
                    tình huống nghiệp vụ.

                    Không lấy cố định actions[0].
                    */

                feature,

                moduleId: this.getText(item?.moduleId),

                functionId: this.getText(item?.functionId),

                functionName:
                    this.getText(item?.functionName) || this.getText(item?.function) || feature,

                testScenario: this.getText(item?.testScenario) || title,

                type,

                priority,

                severity: this.getText(item?.severity) || priority,

                reason: this.getText(item?.reason) || `${type} risk detected`,

                description: this.getText(item?.description),

                source: this.getText(item?.source) || "Requirement Intelligence",

                requirementReference:
                    this.getText(item?.requirementReference) || this.getText(item?.code) || title,

                requirementReferences:
                    this.getArray(item?.requirementReferences).length > 0
                        ? this.getArray(item?.requirementReferences)
                        : [
                              this.getText(item?.requirementReference) ||
                                  this.getText(item?.code) ||
                                  title
                          ],

                coveredRules: this.getArray(item?.coveredRules),

                sourceItems: this.getArray(item?.sourceItems),

                sourceReferences: this.getArray(item?.sourceReferences),

                riskReason: this.getText(item?.riskReason),

                riskCategory: this.getText(item?.riskCategory) || type,

                /*
                    Điều kiện và dữ liệu đầu vào
                    */

                preconditions: this.getArray(item?.preconditions),

                inputDefinitions: this.getArray(item?.inputDefinitions),

                testData: this.getTestData(item?.testData),

                /*
                    Luồng thao tác
                    */

                steps: this.getArray(item?.steps),

                operation: this.getText(item?.operation),

                /*
                    Kết quả nghiệp vụ tổng hợp
                    */

                expectedResult: this.getText(item?.expectedResult),

                /*
                    Danh sách kết quả chi tiết.

                    Giữ lại để tương thích với các
                    generator và exporter cũ.
                    */

                expectedResults: this.getArray(item?.expectedResults),

                /*
                    Assertion phục vụ automation.
                    */

                assertions: this.getArray(item?.assertions),

                automationCandidate: item?.automationCandidate !== false
            });

            scenarios.push(scenario);
        });
    }

    /*
    =================================================
     Feature Resolution
    =================================================
    */

    extractFeature(item, requirement) {
        /*
        Nếu Analyzer hoặc AI đã trả feature rõ ràng,
        ưu tiên sử dụng trực tiếp.
        */

        const itemFeature = this.getText(item?.feature) || this.getText(item?.featureName);

        if (itemFeature) {
            return itemFeature;
        }

        /*
        Ghép toàn bộ nội dung có thể dùng để
        xác định feature.
        */

        const sourceText = [
            this.getText(item),

            this.getText(item?.title),

            this.getText(item?.content),

            this.getText(item?.description),

            this.getText(item?.reason),

            this.getText(item?.requirementReference)
        ]
            .filter(Boolean)
            .join(" ");

        /*
        Ưu tiên đối chiếu với danh sách feature
        parser đã phân tích từ requirement.
        */

        const matchedFeature = this.matchRequirementFeature(sourceText, requirement);

        if (matchedFeature) {
            return matchedFeature;
        }

        /*
        Nếu chưa match được thì suy luận dựa
        trên từ khóa nghiệp vụ.
        */

        const inferredFeature = this.inferFeatureFromText(sourceText, requirement);

        if (inferredFeature) {
            return inferredFeature;
        }

        /*
        Chỉ dùng requirement.feature khi requirement
        thực sự có duy nhất một feature.
        */

        const requirementFeatures = this.getRequirementFeatures(requirement);

        if (requirementFeatures.length === 1) {
            return requirementFeatures[0];
        }

        return "Chức năng chưa xác định";
    }

    /*
    =================================================
     Match Feature With Requirement
    =================================================
    */

    matchRequirementFeature(text, requirement) {
        const normalizedText = this.normalizeForComparison(text);

        if (!normalizedText) {
            return "";
        }

        const features = this.getRequirementFeatures(requirement);

        /*
        Ưu tiên tên feature dài hơn.

        Ví dụ:
        "Tìm kiếm thiết bị" phải xét trước
        "Thiết bị".
        */

        const sortedFeatures = [...features].sort(
            (firstFeature, secondFeature) => secondFeature.length - firstFeature.length
        );

        return (
            sortedFeatures.find(feature => {
                const normalizedFeature = this.normalizeForComparison(feature);

                return normalizedFeature && normalizedText.includes(normalizedFeature);
            }) || ""
        );
    }

    /*
    =================================================
     Requirement Feature Collection
    =================================================
    */

    getRequirementFeatures(requirement) {
        const features = [];

        if (Array.isArray(requirement?.features)) {
            requirement.features.forEach(feature => {
                const featureName =
                    this.getText(feature?.name) ||
                    this.getText(feature?.feature) ||
                    this.getText(feature?.title) ||
                    this.getText(feature);

                this.addUnique(features, featureName);
            });
        }

        /*
        Tương thích một số RequirementObject cũ
        lưu chức năng trong actions.
        */

        if (Array.isArray(requirement?.actions)) {
            requirement.actions.forEach(action => {
                const actionName = this.getText(action);

                if (this.isBusinessFeature(actionName)) {
                    this.addUnique(features, actionName);
                }
            });
        }

        /*
        Fallback cho cấu trúc requirement cũ.
        */

        if (features.length === 0) {
            this.addUnique(features, this.getText(requirement?.feature));
        }

        return features;
    }

    /*
    =================================================
     Infer Feature From Text
    =================================================
    */

    inferFeatureFromText(text, requirement) {
        const normalizedText = this.normalizeForComparison(text);

        if (!normalizedText) {
            return "";
        }

        const moduleName =
            this.getText(requirement?.module) ||
            this.extractModuleFromFeature(this.getText(requirement?.feature)) ||
            "đối tượng";

        const normalizedModule = moduleName.toLowerCase();

        /*
        Tìm kiếm phải được kiểm tra trước các
        từ khóa khác để tránh suy luận sai.
        */

        if (
            this.containsAny(normalizedText, [
                "tìm kiếm",
                "tra cứu",
                "tìm theo",
                "lọc dữ liệu",
                "kết quả tìm",
                "không tìm thấy"
            ])
        ) {
            return `Tìm kiếm ${normalizedModule}`;
        }

        if (
            this.containsAny(normalizedText, [
                "xóa",
                "xoá",
                "không được xóa",
                "không được xoá",
                "không cho phép xóa",
                "không cho phép xoá",
                "xóa thành công",
                "xoá thành công",
                "đã được sử dụng"
            ])
        ) {
            return `Xóa ${normalizedModule}`;
        }

        if (
            this.containsAny(normalizedText, [
                "sửa",
                "cập nhật",
                "chỉnh sửa",
                "thay đổi thông tin",
                "lưu thay đổi"
            ])
        ) {
            return `Sửa ${normalizedModule}`;
        }

        if (
            this.containsAny(normalizedText, [
                "thêm",
                "tạo mới",
                "khởi tạo",
                "mã bị trùng",
                "mã đã tồn tại",
                "thêm thành công"
            ])
        ) {
            return `Thêm ${normalizedModule}`;
        }

        return "";
    }

    /*
    =================================================
     Business Feature Detection
    =================================================
    */

    isBusinessFeature(value) {
        const normalizedValue = this.normalizeForComparison(value);

        return this.containsAny(normalizedValue, [
            "thêm",
            "tạo mới",
            "sửa",
            "cập nhật",
            "chỉnh sửa",
            "xóa",
            "xoá",
            "tìm kiếm",
            "tra cứu"
        ]);
    }

    /*
    =================================================
     Remove Duplicate Scenarios
    =================================================
    */

    removeDuplicateScenarios(scenarios) {
        const uniqueScenarios = [];

        const keys = new Set();

        scenarios.forEach(scenario => {
            const key = [
                this.normalizeForComparison(scenario.moduleId),

                this.normalizeForComparison(scenario.functionId),

                this.normalizeForComparison(scenario.module),

                this.normalizeForComparison(scenario.feature),

                this.normalizeForComparison(scenario.title),

                this.normalizeForComparison(scenario.type)
            ].join("|");

            if (keys.has(key)) {
                return;
            }

            keys.add(key);

            uniqueScenarios.push(scenario);
        });

        /*
        Đánh lại ID sau khi loại trùng để ID
        liên tục: SC001, SC002, SC003...
        */

        uniqueScenarios.forEach((scenario, index) => {
            scenario.id = `SC${String(index + 1).padStart(3, "0")}`;
        });

        return uniqueScenarios;
    }

    /*
    =================================================
     Scenario Title
    =================================================
    */

    getScenarioTitle(item) {
        if (typeof item === "string") {
            return this.normalizeText(item);
        }

        if (!item || typeof item !== "object") {
            return "";
        }

        return this.normalizeText(
            String(
                item?.title ??
                    item?.testScenario ??
                    item?.scenario ??
                    item?.content ??
                    item?.description ??
                    item?.name ??
                    item?.rule ??
                    ""
            )
        );
    }

    /*
    =================================================
     Module Utilities
    =================================================
    */

    extractModuleFromFeature(featureName) {
        return this.normalizeText(featureName)
            .replace(/^(thêm|sửa|xóa|xoá|tìm kiếm|tìm|cập nhật|chỉnh sửa|quản lý)\s+/i, "")
            .trim();
    }

    /*
    =================================================
     Array / Object Utilities
    =================================================
    */

    getArray(value) {
        return Array.isArray(value) ? value : [];
    }

    isPlainObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }

    getTestData(value) {
        if (value && typeof value === "object") {
            return value;
        }

        return null;
    }

    /*
    =================================================
     Collection Utilities
    =================================================
    */

    addUnique(target, value) {
        if (!Array.isArray(target)) {
            return;
        }

        const normalizedValue = this.normalizeText(value);

        if (!normalizedValue) {
            return;
        }

        const exists = target.some(existingValue => {
            return (
                this.normalizeForComparison(existingValue) ===
                this.normalizeForComparison(normalizedValue)
            );
        });

        if (!exists) {
            target.push(normalizedValue);
        }
    }

    containsAny(sourceText, keywords) {
        if (!sourceText || !Array.isArray(keywords)) {
            return false;
        }

        return keywords.some(keyword => {
            return sourceText.includes(keyword.toLowerCase());
        });
    }

    /*
    =================================================
     Text Utilities
    =================================================
    */

    normalizeText(value) {
        if (typeof value !== "string") {
            return "";
        }

        return value.replace(/\s+/g, " ").trim();
    }

    normalizeForComparison(value) {
        return this.normalizeText(this.getText(value))
            .replace(/[.!?;:,]+$/g, "")
            .toLowerCase();
    }

    getText(value) {
        if (typeof value === "string") {
            return value.trim();
        }

        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }

        if (!value || typeof value !== "object") {
            return "";
        }

        return String(
            value?.title ??
                value?.content ??
                value?.description ??
                value?.name ??
                value?.feature ??
                value?.featureName ??
                value?.testScenario ??
                value?.scenario ??
                value?.rule ??
                value?.value ??
                value?.code ??
                ""
        ).trim();
    }
}

export default ScenarioRecommendationEngine;
