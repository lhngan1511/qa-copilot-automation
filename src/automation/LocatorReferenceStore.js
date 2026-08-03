import fs from "node:fs";
import path from "node:path";
import LocatorReference from "./LocatorReference.js";

/**
 * Lưu trữ LocatorReference theo screen.
 * Nạp từ file JSON (config/locators/<screen>.json) do người dùng cung cấp.
 * Nếu thiếu, đề xuất locator draft dựa trên tên trường (cần duyệt).
 */
export default class LocatorReferenceStore {
    /**
     * @param {object} options
     * @param {string} [options.rootDir] thư mục gốc chứa config/locators
     * @param {object} [options.userLocators] map { screen: { locatorKey: {strategy, value} } }
     */
    constructor({ rootDir = process.cwd(), userLocators = null } = {}) {
        this.rootDir = rootDir;
        this.userLocators = userLocators ?? this.loadUserLocators();
    }

    loadUserLocators() {
        const dir = path.join(this.rootDir, "config", "locators");
        if (!fs.existsSync(dir)) return {};
        const result = {};
        fs.readdirSync(dir)
            .filter((f) => f.endsWith(".json"))
            .forEach((file) => {
                const screen = path.basename(file, ".json");
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
                    result[screen] = content;
                } catch {
                    /* bỏ qua file hỏng */
                }
            });
        return result;
    }

    /** Lấy locator đã xác nhận theo locatorKey trong screen. */
    getConfirmed(screen, locatorKey) {
        const ref = this.get(screen, locatorKey);
        return ref && ref.confirmed ? ref : null;
    }

    get(screen, locatorKey) {
        const screenMap = this.userLocators?.[screen];
        const entry = screenMap?.[locatorKey];
        if (entry) {
            return new LocatorReference({
                locatorKey,
                strategy: entry.strategy,
                value: entry.value,
                confirmed: entry.confirmed !== false,
                source: entry.source ?? "USER"
            });
        }
        return null;
    }

    /** Có sẵn bất kỳ locator (kể cả draft) cho screen này không. */
    hasScreen(screen) {
        return Boolean(this.userLocators?.[screen]);
    }

    /**
     * Đề xuất locator draft từ tên trường (fieldName). AI/rule heuristic.
     * - Tên có dạng testid... -> getByTestId
     * - Còn lại ưu tiên getByLabel, fallback getByTestId slug.
     */
    propose(screen, fieldName, { source = "AI_PROPOSAL" } = {}) {
        const name = String(fieldName ?? "").trim();
        if (!name) return null;
        const lower = name.toLowerCase();
        const slug = this.slugify(name);

        let strategy = "getByLabel";
        let value = name;
        if (lower.startsWith("testid") || lower.startsWith("test id")) {
            strategy = "getByTestId";
            value = slug;
        } else if (lower.includes("button") || lower.includes("nút")) {
            strategy = "getByRole";
            value = `button, name: ${JSON.stringify(name)}`;
        }

        return new LocatorReference({
            locatorKey: slug,
            strategy,
            value,
            confirmed: false,
            source
        });
    }

    slugify(text) {
        return String(text ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 80);
    }

    /**
     * Giải locator cho một target (tên trường/điều khiển).
     * Ưu tiên confirmed reference; nếu có screen nhưng chưa có key -> null (blocker);
     * nếu chưa có screen -> đề xuất draft.
     */
    resolve(screen, fieldName) {
        if (!screen || !fieldName) return { locator: null, blocker: "MISSING_TARGET" };
        const key = this.slugify(fieldName);
        const confirmed = this.getConfirmed(screen, key) || this.getConfirmed(screen, fieldName);
        if (confirmed) return { locator: confirmed, blocker: null };
        const existing = this.get(screen, key) || this.get(screen, fieldName);
        if (existing) {
            // Đã có entry nhưng chưa confirmed
            return { locator: existing, blocker: null };
        }
        if (this.hasScreen(screen)) {
            return { locator: null, blocker: `LOCATOR_NOT_FOUND:${screen}.${key}` };
        }
        return { locator: this.propose(screen, fieldName), blocker: null };
    }
}
