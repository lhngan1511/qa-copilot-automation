export default class TestStepNormalizer {
    normalize(steps, context = {}) {
        const parsed = this.parseSteps(steps);
        const expanded = parsed.flatMap(step => this.expandStep(step, context));
        let normalized = expanded
            .map(step => this.naturalizeStep(step, context))
            .filter(Boolean)
            .filter(step => !this.isPreconditionStep(step, context))
            .filter(step => !this.isVerificationOnly(step));

        if (context.preserveManualSteps !== true) {
            normalized = this.insertOperationStart(normalized, context);
            normalized = this.insertKnownFieldActions(normalized, context);
            normalized = this.reorderTemplate(normalized, context);
        }
        normalized = this.deduplicate(normalized);

        return normalized.map((step, index) => {
            const result = { order: index + 1, action: step.action };
            if (this.hasValue(step.target)) result.target = this.clone(step.target);
            if (this.hasValue(step.value)) result.value = this.clone(step.value);
            if (this.hasValue(step.expected)) result.expected = this.clone(step.expected);
            return result;
        });
    }

    parseSteps(steps) {
        if (!Array.isArray(steps)) return [];
        return steps
            .map((step, index) => {
                if (typeof step === "string") {
                    const action = this.stripNumbering(step);
                    return action ? { order: index + 1, action } : null;
                }
                if (!step || typeof step !== "object" || Array.isArray(step)) return null;
                const action = this.stripNumbering(
                    step.action ?? step.description ?? step.step ?? ""
                );
                if (!action) return null;
                return {
                    order: step.order ?? step.stepNumber ?? index + 1,
                    action,
                    target: this.clone(step.target ?? step.field ?? ""),
                    value: this.clone(step.value ?? ""),
                    expected: this.clone(step.expected ?? step.expectedResult ?? "")
                };
            })
            .filter(Boolean);
    }

    expandStep(step, context) {
        const normalized = this.comparable(step.action);
        if (!/nhap du lieu hop le cho cac truong con lai/.test(normalized)) return [step];

        const excluded = this.comparable(
            context.sourceItem?.fieldName ??
                context.sourceItem?.inputName ??
                context.testData?.expectedState?.targetField ??
                ""
        );
        const data = this.fieldData(context);
        const fields = this.inputDefinitions(context)
            .filter(input => input.required !== false)
            .map(input => this.clean(input.name ?? input.inputName ?? input.fieldName))
            .filter(field => field && this.comparable(field) !== excluded);

        return fields.map(field => {
            const definition = this.inputDefinitions(context).find(
                input =>
                    this.comparable(input.name ?? input.inputName ?? input.fieldName) ===
                    this.comparable(field)
            );
            const selectable = /dropdown|select|combobox|radio/.test(
                this.comparable(definition?.controlType ?? definition?.type)
            );
            return {
                order: step.order,
                action: selectable
                    ? this.choiceAction(field, data[field])
                    : this.inputAction(field, data[field]),
                target: field,
                value: data[field] ?? "",
                expected: ""
            };
        });
    }

    naturalizeStep(step, context) {
        const action = this.clean(step.action);
        const normalized = this.comparable(action);
        const feature = this.feature(context);
        const target = this.clean(step.target);
        const value = step.value;

        if (/^(mo|truy cap|di den).*(man hinh|trang|chuc nang)/.test(normalized)) {
            const navigationTarget =
                target ||
                action.replace(/^(?:Mở|Truy cập|Đi đến)\s+(?:màn hình|trang|chức năng)\s+/i, "");
            return {
                ...step,
                action: `Mở chức năng ${navigationTarget || feature}`,
                target: navigationTarget || feature
            };
        }
        if (/^(thiet lap|chuan bi) du lieu cho tinh huong/.test(normalized)) {
            return this.dataRequirementStep(step, context);
        }
        if (
            /^thiet lap dieu kien truoc|^chuan bi (du lieu|tai khoan|tinh huong)/.test(normalized)
        ) {
            return null;
        }
        if (/^nhap du lieu|^dien du lieu|^nhap hoac chon du lieu/.test(normalized)) {
            if (!target) return null;
            return {
                ...step,
                action: this.inputAction(target, value),
                target,
                value
            };
        }
        if (/^chon gia tri/.test(normalized)) {
            if (!target) return null;
            const instruction = context.testData?.fields?.[target]?.instruction;
            return {
                ...step,
                action: instruction || this.choiceAction(target, value),
                target,
                value
            };
        }
        if (/^de trong truong|^de trong /.test(normalized)) {
            const field = target || action.replace(/^Để trống (?:trường )?/i, "");
            return { ...step, action: `Để trống ${field}`, target: field, value: "" };
        }
        if (/nhap gia tri da ton tai/.test(normalized)) {
            const field = target || action.replace(/^.*?cho\s+/i, "");
            return {
                ...step,
                action: this.hasValue(value)
                    ? `Nhập ${field} là ${this.valueText(value)}`
                    : `Nhập giá trị ${field} đã tồn tại`,
                target: field,
                value
            };
        }
        if (/chon gia tri khong hop le/.test(normalized)) {
            const field = target || action.replace(/^.*?cho\s+/i, "");
            return {
                ...step,
                action: this.hasValue(value)
                    ? `Chọn ${field} là ${this.valueText(value)}`
                    : `Chọn giá trị không hợp lệ cho ${field}`,
                target: field,
                value
            };
        }
        if (
            /nhap gia tri (tai diem bien|vuot gioi han|nho hon|min|bang max|bang min)/.test(
                normalized
            )
        ) {
            const field = this.clean(
                context.sourceItem?.fieldName ?? context.sourceItem?.inputName ?? target
            );
            const boundaryValue =
                context.testData?.fields?.[field]?.value ??
                context.sourceItem?.boundaryValue ??
                context.testData?.invalid?.boundaryValue ??
                value;
            return {
                ...step,
                action:
                    field && this.hasValue(boundaryValue)
                        ? `Nhập ${field} là ${this.valueText(boundaryValue)}`
                        : field
                          ? `Nhập giá trị biên cho ${field}`
                          : "Nhập giá trị biên đã xác định",
                target: field,
                value: boundaryValue
            };
        }
        if (/nguoi dung khong co quyen|tai khoan khong co quyen/.test(normalized)) {
            return null;
        }
        if (/^tim kiem bang|^thuc hien tim kiem voi/.test(normalized)) {
            return {
                ...step,
                action: this.hasValue(value)
                    ? `Nhập điều kiện tìm kiếm là ${this.valueText(value)}`
                    : "Nhập điều kiện tìm kiếm",
                target: target || "Điều kiện tìm kiếm",
                value
            };
        }
        if (/^thuc hien thao tac$|^thuc hien chuc nang$|^thuc hien /.test(normalized)) {
            return this.operationStep(step, context);
        }
        if (/^luu du lieu|^nhan luu|^bam luu|^gui du lieu/.test(normalized)) {
            return { ...step, action: "Thực hiện lưu dữ liệu", target: target || feature };
        }
        if (/^thuc hien tim kiem|^tim kiem$|^nhan tim kiem/.test(normalized)) {
            return { ...step, action: "Thực hiện tìm kiếm", target: target || feature };
        }
        if (/^xoa du lieu|^thuc hien xoa/.test(normalized)) {
            return {
                ...step,
                action: `Thực hiện xóa ${this.entity(context)}`,
                target: target || feature
            };
        }
        if (/^xac nhan thao tac xoa|^xac nhan xoa/.test(normalized)) {
            return {
                ...step,
                action: `Xác nhận xóa ${this.entity(context)}`,
                target: target || feature
            };
        }

        return { ...step, action };
    }

    dataRequirementStep(step, context) {
        const requirement = this.clean(context.testData?.requirement);
        if (!requirement) return null;
        const duplicate = requirement.match(/Sử dụng (?:một )?giá trị (.+?) đã tồn tại/i);
        if (duplicate?.[1]) {
            return {
                ...step,
                action: `Nhập giá trị ${duplicate[1]} đã tồn tại`,
                target: duplicate[1]
            };
        }
        const empty = requirement.match(/để trống (?:trường )?(.+)$/i);
        if (empty?.[1]) {
            return { ...step, action: `Để trống ${empty[1]}`, target: empty[1], value: "" };
        }
        if (/^nhập |^chọn |^để trống /i.test(requirement)) {
            return { ...step, action: requirement };
        }
        return null;
    }

    operationStep(step, context) {
        const operation = this.operation(context);
        if (["CREATE", "UPDATE", "SAVE"].includes(operation)) {
            return { ...step, action: "Thực hiện lưu dữ liệu", target: this.feature(context) };
        }
        if (operation === "DELETE") {
            return {
                ...step,
                action: `Thực hiện xóa ${this.entity(context)}`,
                target: this.feature(context)
            };
        }
        if (operation === "SEARCH") {
            return { ...step, action: "Thực hiện tìm kiếm", target: this.feature(context) };
        }
        return null;
    }

    insertOperationStart(steps, context) {
        const operation = this.operation(context);
        if (!["CREATE", "UPDATE"].includes(operation)) return steps;
        const hasStart = steps.some(step => {
            const action = this.comparable(step.action);
            return /bat dau (them moi|chinh sua)|chon (them moi|sua)|mo bieu mau/.test(action);
        });
        if (hasStart) return steps;

        const navigationIndex = steps.findIndex(step =>
            this.semanticKey(step).startsWith("navigation:")
        );
        const entity = this.entity(context);
        const start = {
            action:
                operation === "CREATE"
                    ? `Bắt đầu thêm mới ${entity}`
                    : `Bắt đầu chỉnh sửa ${entity}`,
            target: this.feature(context)
        };
        const result = [...steps];
        result.splice(navigationIndex >= 0 ? navigationIndex + 1 : 0, 0, start);
        return result;
    }

    insertKnownFieldActions(steps, context) {
        if (!["CREATE", "UPDATE"].includes(this.operation(context))) return steps;
        const definitions = this.inputDefinitions(context).filter(
            input => input.required !== false
        );
        if (definitions.length === 0) return steps;
        const data = this.fieldData(context);
        const represented = new Set(
            steps
                .filter(step => /^(nhap|chon|de trong)\b/.test(this.comparable(step.action)))
                .map(step =>
                    this.comparable(
                        step.target || this.fieldFromAction(this.comparable(step.action))
                    )
                )
        );
        const missing = definitions
            .map(input => {
                const name = this.clean(input.name ?? input.inputName ?? input.fieldName);
                return {
                    name,
                    controlType: this.comparable(input.controlType ?? input.type),
                    value: data[name],
                    instruction: context.testData?.fields?.[name]?.instruction
                };
            })
            .filter(input => input.name && !represented.has(this.comparable(input.name)))
            .map(input => ({
                action:
                    input.instruction ||
                    (/dropdown|select|combobox|radio/.test(input.controlType)
                        ? this.choiceAction(input.name, input.value)
                        : this.inputAction(input.name, input.value)),
                target: input.name,
                value: input.value ?? ""
            }));
        if (missing.length === 0) return steps;
        const submitIndex = steps.findIndex(step => this.semanticKey(step).startsWith("submit:"));
        const result = [...steps];
        result.splice(submitIndex >= 0 ? submitIndex : result.length, 0, ...missing);
        return result;
    }

    reorderTemplate(steps, context) {
        const classification = String(context.ruleClassification ?? "").toUpperCase();
        const operation = this.operation(context);
        const rank = step => {
            const key = this.semanticKey(step);
            const action = this.comparable(step.action);
            if (key.startsWith("navigation:")) return 1;
            if (operation === "UPDATE" && /chon ban ghi|chon .* can sua/.test(action)) return 2;
            if (/^bat dau /.test(action)) return operation === "UPDATE" ? 3 : 2;
            if (classification === "REQUIRED" && this.inputMode(action) === "empty") return 3;
            if (key.startsWith("field:")) return 4;
            if (key.startsWith("submit:")) return 5;
            return 4;
        };
        return steps
            .map((step, index) => ({ step, index, rank: rank(step) }))
            .sort((first, second) => first.rank - second.rank || first.index - second.index)
            .map(item => item.step);
    }

    deduplicate(steps) {
        const result = [];
        const keys = new Map();
        for (const step of steps) {
            const key = this.semanticKey(step);
            if (!key) continue;
            const existingIndex = keys.get(key);
            if (existingIndex === undefined) {
                keys.set(key, result.length);
                result.push(step);
            } else if (this.specificity(step) > this.specificity(result[existingIndex])) {
                result[existingIndex] = step;
            }
        }
        return result;
    }

    semanticKey(step) {
        const action = this.comparable(step.action);
        const target = this.comparable(step.target);
        const value = this.comparable(this.valueText(step.value));
        if (!action) return "";
        if (/^(mo|truy cap|di den).*(chuc nang|man hinh|trang)/.test(action)) {
            return `navigation:${target || this.navigationTarget(action)}`;
        }
        if (/luu du lieu|nhan luu|bam luu|gui du lieu/.test(action)) return "submit:save";
        if (/thuc hien tim kiem|nhan tim kiem/.test(action)) return "submit:search";
        if (/thuc hien xoa/.test(action)) return `submit:delete:${target}`;
        if (/^nhap |^chon |^de trong /.test(action)) {
            return `field:${target || this.fieldFromAction(action)}:${value}:${this.inputMode(action)}`;
        }
        return `action:${action}`;
    }

    isPreconditionStep(step, context) {
        const action = this.comparable(step.action);
        if (/dang nhap|tai khoan.*quyen|nguoi dung.*quyen/.test(action)) return true;
        if (/dam bao|thiet lap|chuan bi/.test(action)) return true;
        const preconditions = Array.isArray(context.preconditions) ? context.preconditions : [];
        const actionKey = this.comparable(step.action);
        return preconditions.some(precondition => {
            const preconditionKey = this.comparable(precondition);
            return (
                preconditionKey &&
                (preconditionKey === actionKey ||
                    preconditionKey.includes(actionKey) ||
                    actionKey.includes(preconditionKey))
            );
        });
    }

    isVerificationOnly(step) {
        return /^(kiem tra|xac minh|doi chieu) (ket qua|thong bao|du lieu)/.test(
            this.comparable(step.action)
        );
    }

    inputAction(field, value) {
        return this.hasValue(value) ? `Nhập ${field} là ${this.valueText(value)}` : `Nhập ${field}`;
    }

    choiceAction(field, value) {
        return this.hasValue(value) ? `Chọn ${field} là ${this.valueText(value)}` : `Chọn ${field}`;
    }

    fieldData(context) {
        const source = context.testData;
        if (!source || typeof source !== "object" || Array.isArray(source)) return {};
        const canonicalFields =
            source.fields && typeof source.fields === "object" && !Array.isArray(source.fields)
                ? Object.fromEntries(
                      Object.entries(source.fields)
                          .filter(
                              ([, field]) => field?.value !== undefined && field?.value !== null
                          )
                          .map(([name, field]) => [name, field.value])
                  )
                : {};
        const nested = [canonicalFields, source.inputs, source.valid, source.invalid].filter(
            value => value && typeof value === "object" && !Array.isArray(value)
        );
        const direct = Object.fromEntries(
            Object.entries(source).filter(
                ([key, value]) =>
                    ![
                        "inputs",
                        "valid",
                        "invalid",
                        "context",
                        "action",
                        "expectedState",
                        "requirement",
                        "value"
                    ].includes(key) &&
                    (typeof value === "string" ||
                        typeof value === "number" ||
                        typeof value === "boolean")
            )
        );
        return Object.assign({}, ...nested, direct);
    }

    inputDefinitions(context) {
        return Array.isArray(context.inputDefinitions) ? context.inputDefinitions : [];
    }

    operation(context) {
        const explicit = String(
            context.operation?.type ?? context.operation ?? context.automation?.operation ?? ""
        )
            .trim()
            .toUpperCase();
        if (["CREATE", "UPDATE", "DELETE", "SEARCH"].includes(explicit)) return explicit;
        const text = this.comparable(
            `${context.feature ?? context.function ?? ""} ${context.title ?? ""} ${context.expectedResult ?? ""}`
        );
        if (/\b(them|tao moi)\b/.test(text)) return "CREATE";
        if (/\b(sua|cap nhat|chinh sua)\b/.test(text)) return "UPDATE";
        if (/\b(xoa)\b/.test(text)) return "DELETE";
        if (/\b(tim kiem|tra cuu)\b/.test(text)) return "SEARCH";
        if (/\b(luu|ghi nhan)\b/.test(text)) return "SAVE";
        return "OTHER";
    }

    feature(context) {
        return this.clean(context.feature ?? context.function ?? "chức năng");
    }

    entity(context) {
        return (
            this.feature(context)
                .replace(
                    /^(thêm|tạo mới|sửa|cập nhật|chỉnh sửa|xóa|xoá|tìm kiếm|tra cứu|quản lý)\s+/i,
                    ""
                )
                .trim()
                .toLocaleLowerCase("vi") || "bản ghi"
        );
    }

    navigationTarget(action) {
        return action.replace(/^(mo|truy cap|di den)\s+(chuc nang|man hinh|trang)\s+/, "");
    }

    fieldFromAction(action) {
        return action
            .replace(/^(nhap|chon|de trong)( gia tri)?( truong)?\s+/, "")
            .replace(/\s+la\s+.*$/, "");
    }

    inputMode(action) {
        if (action.startsWith("chon ")) return "select";
        if (action.startsWith("de trong ")) return "empty";
        return "input";
    }

    specificity(step) {
        let score = this.clean(step.action).length;
        if (this.hasValue(step.target)) score += 20;
        if (this.hasValue(step.value)) score += 30;
        return score;
    }

    stripNumbering(value) {
        return this.clean(value).replace(/^(?:bước\s*)?\d+\s*[.)\-:]\s*/i, "");
    }

    valueText(value) {
        if (value === undefined || value === null) return "";
        if (typeof value === "string") return value.trim();
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        return "";
    }

    hasValue(value) {
        return this.valueText(value) !== "";
    }

    clean(value) {
        return String(value ?? "")
            .replace(/\s+/g, " ")
            .trim();
    }

    comparable(value) {
        return this.clean(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[.!?;:,]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    clone(value) {
        if (value === undefined || value === null) return value;
        return typeof value === "object" ? structuredClone(value) : value;
    }
}
