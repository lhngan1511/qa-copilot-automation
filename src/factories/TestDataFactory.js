const PURPOSES = new Set([
    "VALID",
    "EMPTY",
    "DUPLICATE",
    "INVALID",
    "BELOW_MIN",
    "AT_MIN",
    "ABOVE_MAX",
    "AT_MAX",
    "NOT_ALLOWED",
    "SEARCH_CRITERIA",
    "EXISTING_VALUE",
    "UPDATED_VALUE"
]);

const NOT_SPECIFIED = /requirement không (đề cập|nói)|chưa xác định/i;

export default class TestDataFactory {
    create({ source = {}, scenario = {}, inputDefinitions = [], clarificationAnswers = [] } = {}) {
        if (this.isCanonical(source)) return this.cloneCanonical(source);

        const planning = this.normalizeLegacyPlanning(source);
        const definitions = Array.isArray(inputDefinitions) ? inputDefinitions : [];
        let classification = this.classification(scenario, planning);
        const targetField = this.targetField(scenario, planning, definitions, classification);
        const clarificationFacts = this.clarificationFacts(clarificationAnswers);
        if (
            classification === "BOUNDARY_UNKNOWN" &&
            clarificationFacts.boundaries.has(this.key(targetField))
        ) {
            classification = /vượt quá|lớn hơn|max/i.test(
                String(scenario.sourceItem?.content ?? scenario.title ?? "")
            )
                ? "BOUNDARY_MAX_PLUS"
                : "BOUNDARY_MAX";
        }
        const fields = {};

        for (const input of definitions) {
            if (classification === "EMPTY_RESULT") continue;
            const name = this.text(input?.name ?? input?.inputName ?? input?.fieldName);
            if (!name || input?.required === false) continue;
            const explicit = this.findExistingValue(name, planning);
            const clarificationValue = clarificationFacts.fields.get(this.key(name));
            const purpose = this.fieldPurpose(name, targetField, classification);
            const hasExplicitValue =
                explicit !== undefined && (purpose === "EMPTY" || this.hasValue(explicit));
            fields[name] = this.fieldEntry({
                name,
                input,
                value: hasExplicitValue ? explicit : clarificationValue,
                explicitValue: hasExplicitValue,
                purpose,
                clarificationFacts,
                classification
            });
        }

        if (classification !== "EMPTY_RESULT") {
            this.addUnmodeledFields(fields, planning, classification, targetField);
        }
        if (targetField && !fields[targetField]) {
            const existingValue = this.findExistingValue(targetField, planning);
            const purpose = this.fieldPurpose(targetField, targetField, classification);
            const hasExplicitValue =
                existingValue !== undefined &&
                (purpose === "EMPTY" || this.hasValue(existingValue));
            fields[targetField] = this.fieldEntry({
                name: targetField,
                input: {},
                value: hasExplicitValue ? existingValue : undefined,
                explicitValue: hasExplicitValue,
                purpose,
                clarificationFacts,
                classification
            });
        }

        const result = {
            fields,
            constraints: Object.fromEntries(
                [...clarificationFacts.boundaries.entries()].map(([field, boundary]) => [
                    field,
                    {
                        [boundary.boundaryType === "MIN" ? "min" : "max"]: boundary.value,
                        kind: boundary.kind
                    }
                ])
            ),
            requirement: "",
            value: "",
            requiresTesterInput: Object.values(fields).some(
                field => field.requiresTesterInput === true
            )
        };
        if (result.requiresTesterInput) {
            result.requirement = Object.values(fields)
                .filter(field => field.requiresTesterInput)
                .map(field => field.instruction)
                .filter(Boolean)
                .join("; ");
        }

        this.addScenarioState(
            result,
            scenario,
            planning,
            classification,
            fields,
            clarificationFacts
        );
        return result;
    }

    normalizeLegacy(value, context = {}) {
        if (this.isCanonical(value)) return this.cloneCanonical(value);
        if (typeof value === "string") {
            return {
                fields: {},
                requirement: value.trim(),
                value: "",
                requiresTesterInput: Boolean(value.trim())
            };
        }
        if (Array.isArray(value)) {
            const fields = {};
            value.forEach(item => {
                if (!item || typeof item !== "object") return;
                const name = this.text(item.field ?? item.name ?? item.label);
                if (!name) return;
                fields[name] = {
                    value: item.value ?? null,
                    purpose: PURPOSES.has(item.purpose) ? item.purpose : "VALID",
                    ...(item.requiresTesterInput === true
                        ? {
                              requiresTesterInput: true,
                              instruction: this.text(item.instruction)
                          }
                        : {})
                };
            });
            return { fields, requirement: "", value: "", requiresTesterInput: false };
        }
        if (value && typeof value === "object") {
            if (Object.hasOwn(value, "requirement") || Object.hasOwn(value, "value")) {
                return {
                    ...structuredClone(value),
                    fields: this.normalizeFields(value.fields),
                    requirement: this.text(value.requirement),
                    value: this.text(value.value),
                    requiresTesterInput:
                        value.requiresTesterInput === true ||
                        (Boolean(this.text(value.requirement)) && !Boolean(this.text(value.value)))
                };
            }
            return this.create({
                source: value,
                scenario: context,
                inputDefinitions: context.inputDefinitions,
                clarificationAnswers: context.clarificationAnswers
            });
        }
        return { fields: {}, requirement: "", value: "", requiresTesterInput: false };
    }

    fieldEntry({
        name,
        input,
        value,
        explicitValue = false,
        purpose,
        clarificationFacts,
        classification = ""
    }) {
        if (purpose === "EMPTY") return { value: "", purpose };
        if (purpose === "INVALID" && !this.hasKnownBoundary(clarificationFacts, name)) {
            return {
                value: null,
                purpose,
                requiresTesterInput: true,
                instruction: `Xác định giá trị biên cụ thể cho ${name} từ requirement đã làm rõ`
            };
        }

        if (purpose === "DUPLICATE" && !explicitValue) {
            return {
                value: null,
                purpose,
                requiresTesterInput: true,
                instruction: `Nhập một ${name} đang tồn tại trong hệ thống`
            };
        }
        if (purpose === "SEARCH_CRITERIA" && !explicitValue) {
            return {
                value: null,
                purpose,
                requiresTesterInput: true,
                instruction: `Nhập ${name} khớp với dữ liệu đang tồn tại`
            };
        }

        if (
            explicitValue &&
            ["AT_MIN", "BELOW_MIN", "AT_MAX", "ABOVE_MAX"].includes(purpose) &&
            Number.isFinite(Number(value))
        ) {
            const numeric = Number(value);
            return {
                value: this.isTextField(name, input) ? "A".repeat(Math.max(0, numeric)) : numeric,
                purpose
            };
        }

        const boundary = this.boundaryValue(name, input, purpose, clarificationFacts);
        if (boundary !== undefined) return { value: boundary, purpose };

        if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !/(?:kiểm thử|\btest\b|\bdata\b|\bvalue\b)/i.test(String(value))
        ) {
            return { value: this.clone(value), purpose };
        }

        const options = this.options(input);
        const selectable = this.isSelect(input) || /^(loại|trạng thái|danh mục)/i.test(name);
        if (selectable && options.length > 0) {
            if (["NOT_ALLOWED", "INVALID"].includes(purpose)) {
                return {
                    value: null,
                    purpose,
                    requiresTesterInput: true,
                    instruction: `Chuẩn bị một giá trị ${name} không thuộc danh sách cho phép`
                };
            }
            return { value: options[0], purpose };
        }
        if (selectable) {
            const invalid = ["NOT_ALLOWED", "INVALID"].includes(purpose);
            return {
                value: null,
                purpose,
                requiresTesterInput: true,
                instruction: invalid
                    ? `Chuẩn bị một giá trị ${name} không thuộc danh sách cho phép`
                    : `Chọn một ${name} hợp lệ đang tồn tại trong hệ thống`
            };
        }
        if (purpose === "NOT_ALLOWED") {
            return {
                value: null,
                purpose,
                requiresTesterInput: true,
                instruction:
                    classification === "RECORD_NOT_FOUND"
                        ? `Chuẩn bị một giá trị ${name} không tồn tại trong hệ thống`
                        : `Chuẩn bị một giá trị ${name} không hợp lệ theo requirement`
            };
        }
        const normalizedName = this.comparable(name);
        if (/can sua|can xoa|ban ghi|doi tuong can/.test(normalizedName)) {
            return {
                value: null,
                purpose,
                requiresTesterInput: true,
                instruction: `Chọn một ${name} đang tồn tại trong hệ thống`
            };
        }
        if (/^xac nhan|^confirm/.test(normalizedName)) {
            return {
                value: null,
                purpose,
                requiresTesterInput: true,
                instruction: `Thực hiện ${name} theo requirement`
            };
        }
        if (/tai khoan|username|user name|mat khau|password/.test(normalizedName)) {
            return {
                value: null,
                purpose,
                requiresTesterInput: true,
                instruction: `Nhập ${name} hợp lệ do tester chuẩn bị`
            };
        }

        return {
            value: null,
            purpose,
            requiresTesterInput: true,
            instruction:
                purpose === "UPDATED_VALUE"
                    ? `Nhập giá trị mới cho ${name} theo requirement`
                    : `Nhập ${name} hợp lệ theo requirement`
        };
    }

    hasKnownBoundary(facts, name) {
        return facts?.boundaries?.has(this.key(name)) === true;
    }

    boundaryValue(name, input, purpose, facts) {
        if (!["AT_MIN", "BELOW_MIN", "AT_MAX", "ABOVE_MAX"].includes(purpose)) return undefined;
        const limit = facts.boundaries.get(this.key(name));
        if (!limit) return undefined;
        const delta = purpose === "BELOW_MIN" ? -1 : purpose === "ABOVE_MAX" ? 1 : 0;
        const value = limit.value + delta;
        if (limit.kind === "TEXT_LENGTH") return "A".repeat(Math.max(0, value));
        if (limit.kind === "DATE") {
            const date = new Date(limit.date);
            date.setUTCDate(date.getUTCDate() + delta);
            return new Intl.DateTimeFormat("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                timeZone: "UTC"
            }).format(date);
        }
        return value;
    }

    clarificationFacts(answers) {
        const fields = new Map();
        const boundaries = new Map();
        const defaults = new Map();
        const rules = new Map();
        (Array.isArray(answers) ? answers : []).forEach(item => {
            const answer = this.text(item?.answer);
            if (!answer || NOT_SPECIFIED.test(answer)) return;
            const field = this.text(item?.targetField);
            if (field) fields.set(this.key(field), answer);
            const question = this.comparable(item?.question);
            const numeric = Number(answer.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", "."));
            if (
                field &&
                Number.isFinite(numeric) &&
                /do dai|ky tu|toi da|toi thieu/.test(question)
            ) {
                boundaries.set(this.key(field), {
                    kind: "TEXT_LENGTH",
                    value: numeric,
                    boundaryType: /toi thieu|min/.test(question) ? "MIN" : "MAX"
                });
            }
            const date = answer.match(/\d{2}[/-]\d{2}[/-]\d{4}/)?.[0];
            if (field && date && /ngay/.test(question)) {
                const [day, month, year] = date.split(/[/-]/).map(Number);
                boundaries.set(this.key(field), {
                    kind: "DATE",
                    value: 0,
                    date: Date.UTC(year, month - 1, day),
                    boundaryType: /toi thieu|min|som nhat/.test(question) ? "MIN" : "MAX"
                });
            }
            if (field && /mac dinh/.test(question)) defaults.set(this.key(field), answer);
            const targetRule = this.text(item?.targetRule);
            if (targetRule) rules.set(this.key(targetRule), answer);
        });
        return { fields, boundaries, defaults, rules };
    }

    fieldPurpose(name, targetField, classification) {
        if (this.key(name) !== this.key(targetField))
            return classification === "UPDATE" ? "VALID" : "VALID";
        const purposes = {
            REQUIRED: "EMPTY",
            DUPLICATE: "DUPLICATE",
            INVALID_OPTION: "NOT_ALLOWED",
            INVALID_REFERENCE: "NOT_ALLOWED",
            RECORD_NOT_FOUND: "NOT_ALLOWED",
            BOUNDARY_UNKNOWN: "INVALID",
            SEARCH_SINGLE: "SEARCH_CRITERIA",
            SEARCH_MULTI: "SEARCH_CRITERIA",
            NO_RESULT: "SEARCH_CRITERIA",
            BOUNDARY_MIN: "AT_MIN",
            BOUNDARY_MIN_MINUS: "BELOW_MIN",
            BOUNDARY_MAX: "AT_MAX",
            BOUNDARY_MAX_PLUS: "ABOVE_MAX",
            UPDATE: "UPDATED_VALUE"
        };
        return purposes[classification] ?? "VALID";
    }

    classification(scenario, planning) {
        const explicit = String(scenario.ruleClassification ?? "").toUpperCase();
        if (explicit === "BOUNDARY_CONCRETE") {
            const boundary = scenario.sourceItem?.boundaryCase ?? planning?.expected?.boundaryCase;
            const map = {
                MIN: "BOUNDARY_MIN",
                MIN_MINUS_ONE: "BOUNDARY_MIN_MINUS",
                MAX: "BOUNDARY_MAX",
                MAX_PLUS_ONE: "BOUNDARY_MAX_PLUS"
            };
            return map[boundary] ?? explicit;
        }
        if (explicit) return explicit;
        const operation = this.comparable(scenario.feature ?? scenario.function);
        if (/sua|cap nhat/.test(operation) && String(scenario.type).toUpperCase() === "POSITIVE") {
            return "UPDATE";
        }
        if (/tim kiem/.test(operation)) return "SEARCH_SINGLE";
        return String(scenario.type ?? "POSITIVE").toUpperCase();
    }

    targetField(scenario, planning, definitions, classification = "") {
        if (classification === "EMPTY_RESULT") return "";
        const explicit = this.text(
            scenario.sourceItem?.fieldName ??
                scenario.sourceItem?.inputName ??
                planning?.expected?.validationField ??
                planning?.expectedState?.targetField
        );
        if (explicit) return explicit;
        if (classification === "RECORD_NOT_FOUND") {
            const recordField = definitions.find(input =>
                /cần sửa|cần xóa|định danh|mã|code|\bid\b/i.test(this.text(input?.name))
            );
            if (recordField?.name) return recordField.name;
        }
        const planningField = Object.keys(planning?.invalid ?? {}).find(
            name => !/^(targetIdentifier|boundaryValue|condition)$/i.test(name)
        );
        if (planningField) return planningField;
        if (/sua|cap nhat/.test(this.comparable(scenario.feature ?? scenario.function))) {
            const updated = definitions.find(input => {
                const name = this.comparable(input?.name);
                return input?.required !== false && /ten|name/.test(name) && !/can sua/.test(name);
            });
            if (updated?.name) return updated.name;
        }
        return this.text(definitions[0]?.name);
    }

    addScenarioState(result, scenario, planning, classification, fields, clarificationFacts) {
        const operation = this.comparable(scenario.feature ?? scenario.function);
        const identifier = Object.entries(fields).find(([name]) => /mã|code|id/i.test(name));
        const identifierValue = identifier?.[1]?.value;
        if (classification === "DUPLICATE") {
            result.dataState = identifierValue
                ? `${identifierValue} đã tồn tại`
                : "Giá trị đã tồn tại";
        }
        if (/xoa/.test(operation)) {
            result.record = identifierValue || "Bản ghi mục tiêu";
            if (/STATE_RESTRICTION|RELATED_DATA/.test(classification)) {
                result.recordState = this.text(
                    planning?.context?.targetRecord?.statusCondition ??
                        scenario.sourceItem?.content ??
                        planning?.expected?.entityState ??
                        "Đang được sử dụng"
                );
            }
            const deleteDecision = [...(clarificationFacts?.rules?.entries?.() ?? [])].find(
                ([rule]) => /xoa|su dung/.test(rule)
            );
            if (deleteDecision && /^không$|^khong$/i.test(deleteDecision[1])) {
                result.recordState ||= "Đang được sử dụng và không được phép xóa";
            }
        }
        if (classification === "UPDATE") {
            result.existing = {};
            result.updated = {};
            Object.entries(fields).forEach(([name, field]) => {
                if (field.purpose === "UPDATED_VALUE") result.updated[name] = field.value;
                else result.existing[name] = field.value;
            });
        }
    }

    addUnmodeledFields(fields, planning, classification, targetField) {
        const collections = [planning.inputs, planning.valid, planning.invalid].filter(
            value => value && typeof value === "object" && !Array.isArray(value)
        );
        collections.forEach(collection => {
            Object.entries(collection).forEach(([name, value]) => {
                if (
                    name === "userContext" ||
                    /^(targetIdentifier|boundaryValue|condition|searchCriteria)$/i.test(name) ||
                    fields[name]
                ) {
                    return;
                }
                fields[name] = {
                    value: this.clone(value),
                    purpose: this.fieldPurpose(name, targetField, classification)
                };
            });
        });
    }

    findExistingValue(name, planning) {
        for (const collection of [planning.inputs, planning.valid, planning.invalid]) {
            if (collection && Object.hasOwn(collection, name)) return collection[name];
        }
        return undefined;
    }

    normalizeLegacyPlanning(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return {};
        if (value.fields) {
            return {
                inputs: Object.fromEntries(
                    Object.entries(value.fields).map(([name, field]) => [name, field?.value])
                )
            };
        }
        if (Object.hasOwn(value, "requirement") || Object.hasOwn(value, "value")) return value;
        if (value.inputs || value.valid || value.invalid) return structuredClone(value);
        return { inputs: structuredClone(value) };
    }

    normalizeFields(fields) {
        if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
        return Object.fromEntries(
            Object.entries(fields).map(([name, field]) => [
                name,
                field && typeof field === "object"
                    ? {
                          ...structuredClone(field),
                          purpose: PURPOSES.has(field.purpose) ? field.purpose : "VALID"
                      }
                    : { value: this.clone(field), purpose: "VALID" }
            ])
        );
    }

    cloneCanonical(source) {
        return {
            ...structuredClone(source),
            fields: this.normalizeFields(source.fields),
            requirement: this.text(source.requirement),
            value: this.text(source.value),
            requiresTesterInput:
                source.requiresTesterInput === true ||
                Object.values(source.fields ?? {}).some(
                    field => field?.requiresTesterInput === true
                )
        };
    }

    isCanonical(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.fields);
    }

    options(input) {
        const values = input?.options ?? input?.allowedValues ?? input?.values;
        return Array.isArray(values)
            ? values.filter(value => ["string", "number"].includes(typeof value))
            : [];
    }

    isSelect(input) {
        return /dropdown|select|combobox|radio/.test(
            this.comparable(input?.controlType ?? input?.type)
        );
    }

    isTextField(name, input) {
        const control = this.comparable(input?.controlType ?? input?.type);
        const field = this.comparable(name);
        if (/number|numeric|integer|decimal|date|time/.test(control)) return false;
        if (/so luong|quantity|ngay|date/.test(field)) return false;
        return /text|input|textarea/.test(control) || /ten|ma|code|noi dung/.test(field);
    }

    hasValue(value) {
        return value !== undefined && value !== null && String(value).trim() !== "";
    }

    key(value) {
        return this.comparable(value);
    }

    text(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    comparable(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    clone(value) {
        return value && typeof value === "object" ? structuredClone(value) : value;
    }
}
