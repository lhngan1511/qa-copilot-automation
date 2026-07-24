import ValidationResult from "../models/ValidationResult.js";

/*
=====================================================

 RequirementValidator

 Purpose

 - Validate RequirementObject
 - Phát hiện lỗi dữ liệu
 - Sinh Warning
 - Sinh Error

=====================================================
*/

export default class RequirementValidator {
    validate(requirement) {
        const result = new ValidationResult();

        if (!requirement) {
            result.addError("REQ-001", "RequirementObject is null.");

            return result;
        }

        this.validateModule(requirement, result);

        this.validatePermissions(requirement, result);

        this.validateCommonInputs(requirement, result);

        this.validateRelationships(requirement, result);

        this.validateFeatures(requirement, result);

        this.validateBusinessRules(requirement, result);

        this.validateExceptions(requirement, result);

        this.validateAggregatedData(requirement, result);

        return result;
    }

    /*
    =================================================
    Module
    =================================================
    */

    validateModule(requirement, result) {
        if (!requirement.module || !requirement.module.trim()) {
            result.addError("REQ-002", "Module name is required.", "module");
        }
    }

    /*
    =================================================
    Permissions
    =================================================
    */

    validatePermissions(requirement, result) {
        if (!Array.isArray(requirement.permissions)) {
            result.addError("REQ-003", "Permissions must be an array.", "permissions");

            return;
        }

        if (requirement.permissions.length === 0) {
            result.addWarning("REQ-W001", "No permissions defined.", "permissions");
        }
    }

    /*
=================================================
Common Inputs
=================================================
*/

    validateCommonInputs(requirement, result) {
        const commonInputs = requirement.commonInputs;

        if (!Array.isArray(commonInputs)) {
            result.addError("REQ-017", "Common inputs must be an array.", "commonInputs");

            return;
        }

        const usedNames = new Set();

        commonInputs.forEach((input, index) => {
            const path = `commonInputs[${index}]`;

            if (!input || typeof input !== "object") {
                result.addError("REQ-018", "Common input must be an object.", path);

                return;
            }

            if (!input.name || !String(input.name).trim()) {
                result.addError("REQ-019", "Common input name is required.", `${path}.name`);
            }

            if (!input.controlType || !String(input.controlType).trim()) {
                result.addWarning(
                    "REQ-W006",
                    "Common input control type is empty.",
                    `${path}.controlType`
                );
            }

            if (typeof input.required !== "boolean") {
                result.addError(
                    "REQ-020",
                    "Common input required must be boolean.",
                    `${path}.required`
                );
            }

            const normalizedName = String(input.name ?? "")
                .trim()
                .toLowerCase();

            if (!normalizedName) {
                return;
            }

            if (usedNames.has(normalizedName)) {
                result.addError(
                    "REQ-021",
                    `Duplicate common input name: ${input.name}.`,
                    `${path}.name`
                );
            } else {
                usedNames.add(normalizedName);
            }
        });
    }

    /*
=================================================
Relationships
=================================================
*/

    validateRelationships(requirement, result) {
        const relationships = requirement.relationships;

        if (!Array.isArray(relationships)) {
            result.addError("REQ-022", "Relationships must be an array.", "relationships");

            return;
        }

        relationships.forEach((relationship, index) => {
            const path = `relationships[${index}]`;

            if (!relationship || typeof relationship !== "object") {
                result.addError("REQ-023", "Relationship must be an object.", path);

                return;
            }

            if (!relationship.relatedObject || !String(relationship.relatedObject).trim()) {
                result.addError("REQ-024", "Related object is required.", `${path}.relatedObject`);
            }

            if (!relationship.description || !String(relationship.description).trim()) {
                result.addWarning(
                    "REQ-W007",
                    "Relationship description is empty.",
                    `${path}.description`
                );
            }

            if (!relationship.type || !String(relationship.type).trim()) {
                result.addWarning("REQ-W008", "Relationship type is empty.", `${path}.type`);
            }
        });
    }
    /*
    =================================================
    Features
    =================================================
    */

    validateFeatures(requirement, result) {
        if (!Array.isArray(requirement.features)) {
            result.addError("REQ-004", "Features must be an array.", "features");

            return;
        }

        if (requirement.features.length === 0) {
            result.addError("REQ-005", "Requirement has no feature.", "features");

            return;
        }

        const usedFeatureIds = new Set();

        const usedFeatureNames = new Set();

        requirement.features.forEach((feature, index) => {
            const featurePath = `features[${index}]`;

            const normalizedId = String(feature?.id ?? "")
                .trim()
                .toLowerCase();

            if (!normalizedId) {
                result.addWarning("REQ-W009", "Feature ID is empty.", `${featurePath}.id`);
            } else if (usedFeatureIds.has(normalizedId)) {
                result.addError(
                    "REQ-025",
                    `Duplicate feature ID: ${feature.id}.`,
                    `${featurePath}.id`
                );
            } else {
                usedFeatureIds.add(normalizedId);
            }

            const normalizedName = String(feature?.name ?? "")
                .trim()
                .toLowerCase();

            if (normalizedName && usedFeatureNames.has(normalizedName)) {
                result.addError(
                    "REQ-026",
                    `Duplicate feature name: ${feature.name}.`,
                    `${featurePath}.name`
                );
            } else if (normalizedName) {
                usedFeatureNames.add(normalizedName);
            }

            this.validateFeature(feature, index, result);
        });
    }

    validateFeature(feature, index, result) {
        const path = `features[${index}]`;

        if (!feature.name || !feature.name.trim()) {
            result.addError("REQ-006", "Feature name is required.", path);
        }

        if (!feature.description || !feature.description.trim()) {
            result.addWarning("REQ-W002", "Feature description is empty.", path);
        }

        if (!feature.preconditions || feature.preconditions.length === 0) {
            result.addWarning("REQ-W003", "No preconditions.", path);
        }

        if (!feature.flow || feature.flow.length === 0) {
            result.addWarning("REQ-W004", "No flow defined.", path);
        }

        if (!feature.expectedResults || feature.expectedResults.length === 0) {
            result.addWarning("REQ-W005", "No expected result.", path);
        }
    }
    /*
=================================================
Business Rules
=================================================
*/

    validateBusinessRules(requirement, result) {
        const usedCodes = new Map();

        requirement.features.forEach((feature, featureIndex) => {
            const rules = feature.businessRules;

            if (!Array.isArray(rules)) {
                result.addError(
                    "REQ-007",
                    "Business rules must be an array.",
                    `features[${featureIndex}].businessRules`
                );

                return;
            }

            rules.forEach((rule, ruleIndex) => {
                const path = `features[${featureIndex}].businessRules[${ruleIndex}]`;

                if (!rule || typeof rule !== "object") {
                    result.addError("REQ-008", "Business rule must be an object.", path);

                    return;
                }

                if (!rule.code || !String(rule.code).trim()) {
                    result.addError("REQ-009", "Business rule code is required.", `${path}.code`);
                }

                if (!rule.content || !String(rule.content).trim()) {
                    result.addError(
                        "REQ-010",
                        "Business rule content is required.",
                        `${path}.content`
                    );
                }

                const normalizedCode = String(rule.code ?? "")
                    .trim()
                    .toUpperCase();

                if (!normalizedCode) {
                    return;
                }

                if (usedCodes.has(normalizedCode)) {
                    result.addError(
                        "REQ-011",
                        `Duplicate business rule code: ${normalizedCode}.`,
                        `${path}.code`
                    );
                } else {
                    usedCodes.set(normalizedCode, path);
                }
            });
        });
    }

    /*
=================================================
Exceptions
=================================================
*/

    validateExceptions(requirement, result) {
        const usedCodes = new Map();

        requirement.features.forEach((feature, featureIndex) => {
            const exceptions = feature.exceptions;

            if (!Array.isArray(exceptions)) {
                result.addError(
                    "REQ-012",
                    "Exceptions must be an array.",
                    `features[${featureIndex}].exceptions`
                );

                return;
            }

            exceptions.forEach((exception, exceptionIndex) => {
                const path = `features[${featureIndex}].exceptions[${exceptionIndex}]`;

                if (!exception || typeof exception !== "object") {
                    result.addError("REQ-013", "Exception must be an object.", path);

                    return;
                }

                if (!exception.code || !String(exception.code).trim()) {
                    result.addError("REQ-014", "Exception code is required.", `${path}.code`);
                }

                if (!exception.content || !String(exception.content).trim()) {
                    result.addError("REQ-015", "Exception content is required.", `${path}.content`);
                }

                const normalizedCode = String(exception.code ?? "")
                    .trim()
                    .toUpperCase();

                if (!normalizedCode) {
                    return;
                }

                if (usedCodes.has(normalizedCode)) {
                    result.addError(
                        "REQ-016",
                        `Duplicate exception code: ${normalizedCode}.`,
                        `${path}.code`
                    );
                } else {
                    usedCodes.set(normalizedCode, path);
                }
            });
        });
    }
    /*
=================================================
Aggregated Requirement Data
=================================================
*/

    validateAggregatedData(requirement, result) {
        const featureActions = requirement.features
            .map(feature => String(feature?.name ?? "").trim())
            .filter(Boolean);

        const featureBusinessRules = requirement.features.flatMap(feature =>
            Array.isArray(feature?.businessRules) ? feature.businessRules : []
        );

        const featureExpectedResults = requirement.features
            .flatMap(feature =>
                Array.isArray(feature?.expectedResults) ? feature.expectedResults : []
            )
            .map(item => String(item).trim())
            .filter(Boolean);

        const featureExceptions = requirement.features.flatMap(feature =>
            Array.isArray(feature?.exceptions) ? feature.exceptions : []
        );

        const featureConditions = requirement.features
            .flatMap(feature =>
                Array.isArray(feature?.preconditions) ? feature.preconditions : []
            )
            .map(item => String(item).trim())
            .filter(Boolean);

        this.compareStringArrays(
            requirement.actions,
            featureActions,
            "actions",
            "REQ-W010",
            "Actions do not match feature names.",
            result
        );

        this.compareObjectCodes(
            requirement.businessRules,
            featureBusinessRules,
            "businessRules",
            "REQ-W011",
            "Aggregated business rules do not match feature business rules.",
            result
        );

        this.compareStringArrays(
            requirement.expectedResults,
            featureExpectedResults,
            "expectedResults",
            "REQ-W012",
            "Aggregated expected results do not match feature expected results.",
            result
        );

        this.compareObjectCodes(
            requirement.edgeCases,
            featureExceptions,
            "edgeCases",
            "REQ-W013",
            "Aggregated edge cases do not match feature exceptions.",
            result
        );

        this.compareStringArrays(
            requirement.conditions,
            featureConditions,
            "conditions",
            "REQ-W014",
            "Aggregated conditions do not match feature preconditions.",
            result,
            true
        );
    }

    /*
=================================================
Compare String Arrays
=================================================
*/

    compareStringArrays(
        actual,
        expected,
        path,
        warningCode,
        warningMessage,
        result,
        uniqueValues = false
    ) {
        if (!Array.isArray(actual)) {
            result.addError("REQ-027", `${path} must be an array.`, path);

            return;
        }

        const normalize = values => {
            const normalized = values
                .map(value => String(value).trim().toLowerCase())
                .filter(Boolean);

            return uniqueValues ? [...new Set(normalized)] : normalized;
        };

        const actualValues = normalize(actual);

        const expectedValues = normalize(expected);

        if (JSON.stringify(actualValues) !== JSON.stringify(expectedValues)) {
            result.addWarning(warningCode, warningMessage, path);
        }
    }

    /*
=================================================
Compare Object Codes
=================================================
*/

    compareObjectCodes(actual, expected, path, warningCode, warningMessage, result) {
        if (!Array.isArray(actual)) {
            result.addError("REQ-028", `${path} must be an array.`, path);

            return;
        }

        const normalize = values =>
            values
                .map(item => ({
                    code: String(item?.code ?? "")
                        .trim()
                        .toUpperCase(),

                    content: String(item?.content ?? "")
                        .trim()
                        .toLowerCase()
                }))
                .filter(item => item.code || item.content);

        const actualValues = normalize(actual);

        const expectedValues = normalize(expected);

        if (JSON.stringify(actualValues) !== JSON.stringify(expectedValues)) {
            result.addWarning(warningCode, warningMessage, path);
        }
    }
}
