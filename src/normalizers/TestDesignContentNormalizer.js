export default class TestDesignContentNormalizer {
    normalizeTitle(source = {}) {
        const title = this.stripTraceabilityPrefix(
            source.title ?? source.testScenario ?? source.scenario ?? ""
        );
        const rule = this.stripTraceabilityPrefix(
            source.rule ?? source.sourceItem?.content ?? source.description ?? title
        );
        const feature = this.cleanText(source.feature ?? source.function ?? "chức năng");
        const type = String(source.type ?? "").toUpperCase();
        const classification = String(
            source.ruleClassification ?? source.sourceItem?.classification ?? ""
        ).toUpperCase();
        const searchable = this.comparable([title, rule, classification].filter(Boolean).join(" "));
        const field = this.extractField(rule || title);
        const operation = this.operation(feature, title);
        const entity = this.entity(feature);

        if (
            classification === "REQUIRED" ||
            /bat buoc|khong duoc de trong|bo trong|de trong/.test(searchable)
        ) {
            return `Hiển thị cảnh báo khi bỏ trống ${field || "trường bắt buộc"}`;
        }
        if (/duy nhat|trung|da ton tai/.test(searchable)) {
            const target = field ? this.lowerFirst(field) : `mã ${entity}`;
            return `Không cho phép ${this.operationPhrase(operation, feature)} có ${target} đã tồn tại`;
        }
        if (
            classification === "INVALID_OPTION" ||
            /gia tri khong hop le|lua chon khong hop le/.test(searchable)
        ) {
            return `Không cho phép ${this.operationPhrase(operation, feature)} khi ${
                field ? this.lowerFirst(field) : "giá trị được chọn"
            } không hợp lệ`;
        }
        if (
            /khong co quyen|quyen thuc hien|phai co quyen|permission/.test(searchable) ||
            type === "PERMISSION"
        ) {
            return `Từ chối ${this.operationPhrase(operation, feature)} khi người dùng không có quyền`;
        }
        if (
            operation === "DELETE" &&
            /dang duoc su dung|dang su dung|du lieu lien quan|khong duoc xoa|khong cho phep xoa/.test(
                searchable
            )
        ) {
            if (/dang duoc su dung|dang su dung/.test(searchable)) {
                return `Không cho phép xóa ${entity} đang được sử dụng`;
            }
            if (/du lieu lien quan/.test(searchable)) {
                return `Không cho phép xóa ${entity} có dữ liệu liên quan`;
            }
            return `Không cho phép xóa ${entity}`;
        }
        if (type === "BOUNDARY" || /toi da|toi thieu|gioi han|ky tu/.test(searchable)) {
            const limit = rule.match(
                /\d+(?:[.,]\d+)?\s*(?:ký tự|ky tu|phần tử|phan tu|lần|lan)?/i
            )?.[0];
            if (/toi da|khong qua/.test(searchable) && limit) {
                return `Hiển thị cảnh báo khi ${this.lowerFirst(field || "giá trị")} vượt quá ${limit}`;
            }
            if (/toi thieu|it nhat/.test(searchable) && limit) {
                return `Hiển thị cảnh báo khi ${this.lowerFirst(field || "giá trị")} nhỏ hơn ${limit}`;
            }
            return `Xử lý đúng giới hạn của ${this.lowerFirst(field || feature)}`;
        }
        const originalTitle = this.cleanText(
            source.title ?? source.testScenario ?? source.scenario ?? ""
        );
        if (
            title &&
            title === originalTitle &&
            this.comparable(title) !== this.comparable(feature) &&
            !this.isGenericTitle(title)
        ) {
            return title;
        }
        if (type === "POSITIVE") {
            if (operation === "CREATE") return `Thêm mới ${entity} thành công với dữ liệu hợp lệ`;
            if (operation === "UPDATE") return `Cập nhật ${entity} thành công với dữ liệu hợp lệ`;
            if (operation === "DELETE") return `Xóa ${entity} thành công`;
            if (operation === "SEARCH") return `Tìm kiếm ${entity} thành công với điều kiện hợp lệ`;
            return `${this.capitalize(feature)} hoạt động thành công với dữ liệu hợp lệ`;
        }

        if (/^khong duoc /.test(this.comparable(rule))) {
            return this.capitalize(rule.replace(/^Không được\s+/i, "Không cho phép "));
        }
        if (
            title &&
            title ===
                this.cleanText(source.title ?? source.testScenario ?? source.scenario ?? "") &&
            !this.isGenericTitle(title)
        ) {
            return title;
        }
        if (rule && !this.isGenericTitle(rule)) {
            return `Xác minh ${this.lowerFirst(rule)}`;
        }
        return `${this.capitalize(this.operationPhrase(operation, feature))} theo đúng yêu cầu nghiệp vụ`;
    }

    normalizePreconditions(values, { target = "" } = {}) {
        if (!Array.isArray(values)) return [];
        const result = [];
        const keys = new Map();

        for (const value of values) {
            const text = this.cleanText(
                typeof value === "string"
                    ? value
                    : (value?.content ?? value?.description ?? value?.condition ?? "")
            ).replace(/[.!?;:,]+$/g, "");
            if (!text) continue;
            const key = this.preconditionKey(text, target);
            if (!key) continue;
            const existingIndex = keys.get(key);
            if (existingIndex === undefined) {
                keys.set(key, result.length);
                result.push(text);
                continue;
            }
            if (
                this.preconditionSpecificity(text, target) >
                this.preconditionSpecificity(result[existingIndex], target)
            ) {
                result[existingIndex] = text;
            }
        }
        return result;
    }

    extractBusinessRuleIds(...values) {
        const ids = [];
        const seen = new Set();
        const visit = value => {
            if (Array.isArray(value)) return value.forEach(visit);
            if (value && typeof value === "object") {
                visit(value.code);
                visit(value.id);
                visit(value.reference);
                visit(value.content);
                return;
            }
            if (typeof value !== "string") return;
            for (const match of value.matchAll(/\bBR[\s_-]*0*(\d+)\b/gi)) {
                const id = `BR${String(Number(match[1])).padStart(2, "0")}`;
                if (!seen.has(id)) {
                    seen.add(id);
                    ids.push(id);
                }
            }
        };
        values.forEach(visit);
        return ids;
    }

    stripTraceabilityPrefix(value) {
        return this.cleanText(value)
            .replace(/^\s*\[?BR[\s_-]*\d+\]?\s*(?:[:\-_–—]\s*)?/i, "")
            .trim();
    }

    preconditionKey(text, target) {
        const normalized = this.comparable(text);
        const negative = /khong|chua/.test(normalized);
        if (/dang nhap|xac thuc|tai khoan hop le/.test(normalized)) {
            return `authenticated:${negative ? "negative" : "positive"}`;
        }
        if (/quyen|duoc phep|truy cap/.test(normalized)) {
            const action = this.detectAction(normalized);
            return `permission:${negative ? "negative" : "positive"}:${action}`;
        }
        if (/man hinh|trang |chuc nang.*(mo|hien thi)|dang o/.test(normalized)) {
            return `page:${this.comparable(target) || this.detectAction(normalized)}`;
        }
        if (
            /danh muc|du lieu tham chieu|master data/.test(normalized) &&
            /ton tai|co san/.test(normalized)
        ) {
            return `reference-data:${this.comparable(target)}`;
        }
        if (
            /ban ghi|thiet bi|doi tuong/.test(normalized) &&
            /ton tai|can sua|can xoa/.test(normalized)
        ) {
            return `record-exists:${this.detectAction(normalized)}`;
        }
        if (/dang duoc su dung|dang su dung/.test(normalized)) return "record-use:in-use";
        if (/khong.*su dung|chua.*su dung|co the xoa/.test(normalized)) return "record-use:unused";
        if (/he thong/.test(normalized) && /san sang|hoat dong|kha dung/.test(normalized)) {
            return `system:${negative ? "unavailable" : "available"}`;
        }
        return `text:${normalized}`;
    }

    preconditionSpecificity(text, target) {
        const normalized = this.comparable(text);
        let score = 0;
        if (target && normalized.includes(this.comparable(target))) score += 4;
        if (/quan ly|them|sua|cap nhat|xoa|tim kiem/.test(normalized)) score += 3;
        if (/vao he thong|tai khoan hop le/.test(normalized)) score += 1;
        return score;
    }

    extractField(value) {
        const text = this.stripTraceabilityPrefix(value);
        const patterns = [
            /(?:bỏ trống|để trống)\s+(.+?)(?:\s+khi|\s+thì|$)/i,
            /^(.+?)\s+(?:không được để trống|là bắt buộc|phải duy nhất|không được trùng|không hợp lệ|tối đa|tối thiểu)/i,
            /(?:trường|field)\s+([^,.;:]+)/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match?.[1]) return this.cleanText(match[1]);
        }
        return "";
    }

    operation(feature, title) {
        const normalized = this.comparable(`${feature} ${title}`);
        if (/\b(them|tao moi|create|add)\b/.test(normalized)) return "CREATE";
        if (/\b(sua|cap nhat|update|edit)\b/.test(normalized)) return "UPDATE";
        if (/\b(xoa|delete|remove)\b/.test(normalized)) return "DELETE";
        if (/\b(tim kiem|tra cuu|search|find)\b/.test(normalized)) return "SEARCH";
        return "OTHER";
    }

    operationPhrase(operation, feature) {
        if (operation === "CREATE") return this.lowerFirst(feature || "thêm mới dữ liệu");
        if (operation === "UPDATE") return this.lowerFirst(feature || "cập nhật dữ liệu");
        if (operation === "DELETE") return this.lowerFirst(feature || "xóa dữ liệu");
        if (operation === "SEARCH") return this.lowerFirst(feature || "tìm kiếm dữ liệu");
        return this.lowerFirst(feature || "thực hiện chức năng");
    }

    entity(feature) {
        const entity = this.cleanText(feature)
            .replace(/^(thêm|tạo mới|sửa|cập nhật|xóa|xoá|tìm kiếm|tra cứu|quản lý)\s+/i, "")
            .trim();
        return this.lowerFirst(entity || "dữ liệu");
    }

    detectAction(normalized) {
        if (/them|tao moi/.test(normalized)) return "create";
        if (/sua|cap nhat/.test(normalized)) return "update";
        if (/xoa/.test(normalized)) return "delete";
        if (/tim kiem|tra cuu/.test(normalized)) return "search";
        return "general";
    }

    isGenericTitle(value) {
        return /^(kiểm tra|kiem tra)\s*(chức năng|chuc nang|hợp lệ|hop le|br\d*)?$/i.test(
            this.cleanText(value)
        );
    }

    cleanText(value) {
        return String(value ?? "")
            .replace(/\s+/g, " ")
            .trim();
    }

    comparable(value) {
        return this.cleanText(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    lowerFirst(value) {
        const text = this.cleanText(value);
        return text ? text.charAt(0).toLocaleLowerCase("vi") + text.slice(1) : "";
    }

    capitalize(value) {
        const text = this.cleanText(value);
        return text ? text.charAt(0).toLocaleUpperCase("vi") + text.slice(1) : "";
    }
}
