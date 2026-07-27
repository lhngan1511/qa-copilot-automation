class PositiveCaseAnalyzer {
    analyze(requirement, knowledge) {
        if (!requirement || !knowledge) {
            return;
        }

        if (!Array.isArray(knowledge.positiveCases)) {
            knowledge.positiveCases = [];
        }

        const features = this.collectFeatures(requirement);

        features.forEach(feature => {
            this.analyzeFeature(feature, knowledge, requirement);
        });
    }

    /*
    =================================================
     Feature Collection
    =================================================
    */

    collectFeatures(requirement) {
        const features = [];

        if (Array.isArray(requirement?.features)) {
            requirement.features.forEach(feature => {
                if (!feature) {
                    return;
                }

                const featureName = this.getFeatureName(feature);

                if (!featureName) {
                    return;
                }

                const existed = features.some(currentFeature => {
                    return (
                        this.normalizeForComparison(this.getFeatureName(currentFeature)) ===
                        this.normalizeForComparison(featureName)
                    );
                });

                if (!existed) {
                    features.push(feature);
                }
            });
        }

        /*
        Tương thích RequirementObject cấu trúc cũ.
        */

        if (features.length === 0) {
            const legacyFeatureName = this.normalizeText(requirement?.feature);

            if (legacyFeatureName) {
                features.push({
                    name: legacyFeatureName,

                    expectedResults: Array.isArray(requirement?.expectedResults)
                        ? requirement.expectedResults
                        : [],

                    preconditions: Array.isArray(requirement?.preconditions)
                        ? requirement.preconditions
                        : [],

                    inputDefinitions: Array.isArray(requirement?.inputDefinitions)
                        ? requirement.inputDefinitions
                        : [],

                    flow: Array.isArray(requirement?.flow) ? requirement.flow : []
                });
            }
        }

        return features;
    }

    /*
    =================================================
     Positive Business Case Analysis
    =================================================

     Nguyên tắc:

     Một feature
     → một positive business case
     → nhiều expectedResults
     → nhiều assertions

    =================================================
    */

    analyzeFeature(feature, knowledge, requirement) {
        const featureName = this.getFeatureName(feature);

        if (!featureName) {
            return;
        }

        const moduleName =
            this.normalizeText(requirement?.module) || this.extractModuleFromFeature(featureName);

        /*
        Gom toàn bộ expected result của feature.

        Không tạo một case cho từng expected result.
        */

        const expectedResults = this.collectExpectedResults(feature);

        /*
        Một expected result tổng hợp dành cho
        Excel / Markdown / Tester.
        */

        const expectedResult = this.buildBusinessExpectedResult(expectedResults, featureName);

        /*
        Tạo assertion chi tiết dành cho automation.

        Hiện tại giữ ở mức nghiệp vụ.
        Sau này Automation Mapping sẽ chuyển thành
        locator và expect() cụ thể.
        */

        const assertions = this.buildAssertions(expectedResults);

        /*
        Lấy luồng thao tác từ requirement.

        Không hard-code theo Thiết bị.
        */

        const steps = this.collectSteps(feature);

        const preconditions = this.collectPreconditions(feature, requirement);

        const inputDefinitions = this.collectInputDefinitions(feature, requirement);

        /*
        Mỗi feature chỉ tạo một positive case chính.
        */

        const title = this.buildPositiveTitle(featureName);

        this.addUniqueCase(knowledge.positiveCases, {
            module: moduleName,

            feature: featureName,

            title,

            content: title,

            testScenario: title,

            type: "POSITIVE",

            priority: "MEDIUM",

            severity: "MEDIUM",

            reason: "Kiểm tra luồng nghiệp vụ chính với dữ liệu hợp lệ",

            source: "PositiveCaseAnalyzer",

            requirementReference: this.getFeatureReference(feature, featureName),

            riskCategory: "FUNCTIONAL",

            preconditions,

            inputDefinitions,

            steps,

            expectedResult,

            expectedResults,

            assertions,

            automationCandidate: true
        });
    }

    /*
    =================================================
     Expected Result Collection
    =================================================
    */

    collectExpectedResults(feature) {
        const results = [];

        const sourceResults = Array.isArray(feature?.expectedResults)
            ? feature.expectedResults
            : [];

        sourceResults.forEach(item => {
            const content = this.getItemContent(item);

            if (!content) {
                return;
            }

            this.addUniqueText(results, content);
        });

        return results;
    }

    buildBusinessExpectedResult(expectedResults, featureName) {
        if (Array.isArray(expectedResults) && expectedResults.length > 0) {
            return expectedResults
                .map(result => this.removeEndingPunctuation(result))
                .filter(Boolean)
                .join("; ")
                .concat(".");
        }

        return `${featureName} được thực hiện thành công.`;
    }

    /*
    =================================================
     Assertion Generation
    =================================================
    */

    buildAssertions(expectedResults) {
        if (!Array.isArray(expectedResults)) {
            return [];
        }

        return expectedResults
            .map((expected, index) => {
                const content = this.normalizeText(expected);

                if (!content) {
                    return null;
                }

                return {
                    order: index + 1,

                    type: this.detectAssertionType(content),

                    target: "",

                    expected: content,

                    source: "FEATURE_EXPECTED_RESULT"
                };
            })
            .filter(Boolean);
    }

    detectAssertionType(content) {
        const normalizedContent = this.normalizeForComparison(content);

        if (this.containsAny(normalizedContent, ["thông báo", "message", "cảnh báo"])) {
            return "MESSAGE";
        }

        if (
            this.containsAny(normalizedContent, [
                "hiển thị trong danh sách",
                "xuất hiện trong danh sách",
                "kết quả tìm kiếm",
                "danh sách hiển thị"
            ])
        ) {
            return "DATA_VISIBLE";
        }

        if (
            this.containsAny(normalizedContent, [
                "được lưu",
                "lưu thành công",
                "cập nhật thành công",
                "xóa thành công",
                "xoá thành công"
            ])
        ) {
            return "DATA_PERSISTED";
        }

        if (
            this.containsAny(normalizedContent, ["không cho phép", "không được phép", "bị từ chối"])
        ) {
            return "OPERATION_BLOCKED";
        }

        return "BUSINESS_RESULT";
    }

    /*
    =================================================
     Step Collection
    =================================================
    */

    collectSteps(feature) {
        const flow = Array.isArray(feature?.flow)
            ? feature.flow
            : Array.isArray(feature?.steps)
              ? feature.steps
              : [];

        return flow
            .map((item, index) => {
                if (item && typeof item === "object") {
                    const description = this.getItemContent(item);

                    return {
                        order: Number(item?.order) || index + 1,

                        action: this.normalizeText(String(item?.action ?? item?.type ?? "EXECUTE")),

                        target: this.normalizeText(String(item?.target ?? item?.field ?? "")),

                        description,

                        valueRef: this.normalizeText(String(item?.valueRef ?? ""))
                    };
                }

                const description = this.normalizeText(String(item ?? ""));

                if (!description) {
                    return null;
                }

                return {
                    order: index + 1,

                    action: "EXECUTE",

                    target: "",

                    description,

                    valueRef: ""
                };
            })
            .filter(Boolean);
    }

    /*
    =================================================
     Preconditions / Inputs
    =================================================
    */

    collectPreconditions(feature, requirement) {
        const result = [];

        const sources = [requirement?.preconditions, feature?.preconditions];

        sources.forEach(source => {
            if (!Array.isArray(source)) {
                return;
            }

            source.forEach(item => {
                const content = this.getItemContent(item);

                if (content) {
                    this.addUniqueText(result, content);
                }
            });
        });

        return result;
    }

    collectInputDefinitions(feature, requirement) {
        const featureInputs = Array.isArray(feature?.inputDefinitions)
            ? feature.inputDefinitions
            : Array.isArray(feature?.inputs)
              ? feature.inputs
              : [];

        if (featureInputs.length > 0) {
            return [...featureInputs];
        }

        const requirementInputs = Array.isArray(requirement?.inputDefinitions)
            ? requirement.inputDefinitions
            : Array.isArray(requirement?.inputs)
              ? requirement.inputs
              : [];

        return [...requirementInputs];
    }

    /*
    =================================================
     Title Generation
    =================================================
    */

    buildPositiveTitle(featureName) {
        const normalizedFeature = this.normalizeText(featureName);

        if (!normalizedFeature) {
            return "Thực hiện nghiệp vụ thành công";
        }

        if (/thành công$/i.test(normalizedFeature)) {
            return normalizedFeature;
        }

        return `${normalizedFeature} thành công`;
    }

    /*
    =================================================
     Case Utilities
    =================================================
    */

    addUniqueCase(target, value) {
        if (!Array.isArray(target) || !value) {
            return;
        }

        const comparisonKey = this.buildComparisonKey(value);

        if (!comparisonKey) {
            return;
        }

        const existed = target.some(item => {
            return this.buildComparisonKey(item) === comparisonKey;
        });

        if (!existed) {
            target.push(value);
        }
    }

    buildComparisonKey(value) {
        if (typeof value === "string") {
            return this.normalizeForComparison(value);
        }

        if (!value || typeof value !== "object") {
            return "";
        }

        const moduleName = this.normalizeForComparison(value?.module);

        const featureName = this.normalizeForComparison(value?.feature ?? value?.featureName);

        const type = this.normalizeForComparison(value?.type);

        /*
        Không dùng expected result làm khóa.

        Một feature chỉ có một positive business case.
        */

        return [moduleName, featureName, type].join("|");
    }

    addUniqueText(target, value) {
        const normalizedValue = this.normalizeText(value);

        if (!normalizedValue) {
            return;
        }

        const existed = target.some(currentValue => {
            return (
                this.normalizeForComparison(currentValue) ===
                this.normalizeForComparison(normalizedValue)
            );
        });

        if (!existed) {
            target.push(normalizedValue);
        }
    }

    /*
    =================================================
     Feature Utilities
    =================================================
    */

    getFeatureName(feature) {
        if (typeof feature === "string") {
            return this.normalizeText(feature);
        }

        if (!feature || typeof feature !== "object") {
            return "";
        }

        return this.normalizeText(
            String(feature?.name ?? feature?.feature ?? feature?.title ?? "")
        );
    }

    getFeatureReference(feature, fallback) {
        if (feature && typeof feature === "object") {
            const reference = feature?.requirementReference ?? feature?.code ?? feature?.id;

            if (reference) {
                return this.normalizeText(String(reference));
            }
        }

        return fallback;
    }

    getItemContent(item) {
        if (typeof item === "string") {
            return this.normalizeText(item);
        }

        if (!item || typeof item !== "object") {
            return "";
        }

        const content =
            item?.content ??
            item?.description ??
            item?.title ??
            item?.name ??
            item?.expectedResult ??
            item?.result ??
            item?.scenario ??
            item?.action ??
            item?.value ??
            "";

        return this.normalizeText(String(content));
    }

    extractModuleFromFeature(featureName) {
        return this.normalizeText(featureName)
            .replace(/^(thêm|sửa|xóa|xoá|tìm kiếm|tìm|cập nhật|chỉnh sửa|quản lý)\s+/i, "")
            .trim();
    }

    /*
    =================================================
     Text Utilities
    =================================================
    */

    containsAny(sourceText, keywords) {
        if (!sourceText) {
            return false;
        }

        return keywords.some(keyword => {
            return sourceText.includes(keyword.toLowerCase());
        });
    }

    removeEndingPunctuation(value) {
        return this.normalizeText(value)
            .replace(/[.!?;:,]+$/g, "")
            .trim();
    }

    normalizeText(value) {
        if (typeof value !== "string") {
            return "";
        }

        return value.replace(/\s+/g, " ").trim();
    }

    normalizeForComparison(value) {
        return this.normalizeText(typeof value === "string" ? value : String(value ?? ""))
            .replace(/[.!?;:,]+$/g, "")
            .toLowerCase();
    }
}

export default PositiveCaseAnalyzer;
