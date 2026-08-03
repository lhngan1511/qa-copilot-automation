/**
 * AutomationMappingGenerator
 * Chuyển một Approved TestCase thành Automation Mapping Artifact.
 * - Rule baseline từ steps/assertions (natural language -> structured action/assertion).
 * - Locator: từ LocatorReferenceStore (user-confirmed) hoặc AI-proposed draft.
 * - Mọi locator/route chưa xác nhận đều là draft, mapping có status WAITING_FOR_REVIEW.
 */
import AutomationMappingArtifact from "./AutomationMappingArtifact.js";
import AutomationReadinessValidator from "./AutomationReadinessValidator.js";
import {
    normalizeAction,
    normalizeAssertion,
    mapAssertionType
} from "./AutomationActions.js";

const OPERATION_ROUTES = {
    CREATE: "create",
    UPDATE: "edit",
    DELETE: "delete",
    SEARCH: "list",
    VIEW: "list",
    LOGIN: "login"
};

export default class AutomationMappingGenerator {
    /**
     * @param {object} options
     * @param {import('./LocatorReferenceStore.js').default} [options.locatorStore]
     */
    constructor({ locatorStore = null, readinessValidator = null } = {}) {
        this.locatorStore = locatorStore;
        this.readinessValidator =
            readinessValidator ?? new AutomationReadinessValidator({ locatorStore });
    }

    /**
     * Sinh mapping cho một testcase.
     * @param {object} testCase  testcase từ approved-testcases.json
     * @param {object} [options]
     * @param {boolean} [options.autoApprove] tạm coi locator/route đề xuất là đã duyệt (cho demo)
     * @returns {AutomationMappingArtifact}
     */
    generate(testCase, { autoApprove = false } = {}) {
        const hints = testCase.automationHints ?? {};
        const screen = hints.screen ?? testCase.module ?? "";
        const operation = (hints.operation ?? this.inferOperation(testCase) ?? "").toUpperCase();
        const pageObject = this.slugify(screen || "screen");
        const route = this.resolveRoute(hints, screen, operation, autoApprove);

        const { actions, locatorRefs, dataRefs, setup } = this.buildActions(
            testCase,
            screen,
            operation,
            autoApprove
        );
        const { assertions, assertionLocators } = this.buildAssertions(testCase, screen, autoApprove);
        const blockers = [];
        const missing = [];

        // Route: trong autoApprove, route đề xuất coi như đã duyệt -> không phải blocker
        if (!hints.route && !autoApprove) {
            missing.push("route_draft");
            blockers.push("ROUTE_NOT_CONFIRMED");
        }

        if (autoApprove) {
            // Ở chế độ demo, đánh giá readiness lenient: không chặn vì thiếu route nữa
            this.softenBlockers(blockers, missing, ["MISSING_ROUTE", "ROUTE_NOT_CONFIRMED"]);
        }

        const readiness = this.readinessValidator.evaluate(testCase);
        blockers.push(...readiness.blockers);
        missing.push(...readiness.missing);

        if (autoApprove) {
            this.softenBlockers(blockers, missing, ["MISSING_ROUTE", "ROUTE_NOT_CONFIRMED"]);
            // Nếu đã tự điền data mặc định thì gỡ blocker DATA_REQUIRED
            if (dataRefs && Object.keys(dataRefs).length > 0) {
                this.softenBlockers(blockers, missing, ["DATA_REQUIRED"]);
            }
            this.softenBlockers(blockers, missing, ["UNKNOWN_ACTION", "UNKNOWN_ASSERTION"]);
        }

        const allLocators = [...locatorRefs, ...assertionLocators].filter(Boolean);

        return new AutomationMappingArtifact({
            artifactId: `AM-${testCase.id ?? "TC"}`,
            status: blockers.length === 0 ? "WAITING_FOR_REVIEW" : "DRAFT",
            revision: 1,
            testCaseId: testCase.id ?? testCase.testcaseId ?? "",
            module: testCase.module ?? "",
            feature: testCase.feature ?? "",
            pageObject,
            route,
            setup,
            actions,
            assertions,
            locatorReferences: allLocators,
            dataReferences: dataRefs,
            blockers,
            readiness: blockers.length === 0 ? "READY" : "NOT_READY",
            metadata: {
                createdBy: "RULE_BASELINE+AI_PROPOSAL",
                routeProposed: Boolean(!hints.route && route),
                screen,
                operation,
                sourceArtifactId: testCase.id
            }
        });
    }

    inferOperation(testCase) {
        const text = [
            testCase.title,
            testCase.testScenario,
            ...(testCase.steps || []).map((s) => s.action)
        ]
            .join(" ")
            .toLowerCase();
        if (text.includes("đăng nhập") || text.includes("login")) return "LOGIN";
        if (text.includes("thêm") || text.includes("tạo")) return "CREATE";
        if (text.includes("sửa") || text.includes("cập nhật") || text.includes("update")) {
            return "UPDATE";
        }
        if (text.includes("xóa") || text.includes("xoá")) return "DELETE";
        if (text.includes("tìm") || text.includes("search")) return "SEARCH";
        return "";
    }

    resolveRoute(hints, screen, operation, autoApprove) {
        if (hints.route) return hints.route;
        const base = this.slugify(screen || "app");
        const suffix = OPERATION_ROUTES[operation] ?? "";
        const proposed = suffix ? `/${base}/${suffix}` : `/${base}`;
        return proposed;
    }

    buildActions(testCase, screen, operation, autoApprove) {
        const actions = [];
        const locatorRefs = [];
        const dataRefs = {};
        const setup = [];
        const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
        const seenLocators = new Set();

        for (const step of steps) {
            const action = normalizeAction(step.action);
            if (!action) continue;
            const stepId = `${testCase.id}-STEP-${step.order}`;
            const target = step.target ?? "";

            if (action === "setup") {
                setup.push({ stepId, description: step.action, sourceStep: step.order });
                continue;
            }
            if (action === "verify") {
                // assertion đã được capture riêng; bỏ qua ở action
                continue;
            }
            if (action === "goto" || action === "open") {
                actions.push({
                    stepId,
                    action,
                    target: target || "/",
                    valueRef: null,
                    sourceStep: step.order
                });
                continue;
            }
            if (action === "wait") {
                actions.push({ stepId, action, target: "", valueRef: null, sourceStep: step.order });
                continue;
            }

            if (!target) continue;

            const { locator, blocker } = this.resolveLocator(screen, target, autoApprove);
            if (locator) {
                const key = locator.locatorKey;
                if (!seenLocators.has(key)) {
                    seenLocators.add(key);
                    locatorRefs.push(locator.toJSON());
                }
            }

            const value = step.value ?? "";
            let valueRef = value
                ? `literal:${value}`
                : this.valueRefFor(testCase, target, step, action);

            // Auto-điền dữ liệu demo cho fill/select khi chưa có giá trị thật
            if (autoApprove && (action === "fill" || action === "select") && !value) {
                const demo = this.demoValue(target);
                valueRef = `literal:${demo}`;
                dataRefs[`demo.${this.slugify(target)}`] = demo;
            }

            const entry = {
                stepId,
                action,
                target,
                locatorKey: locator ? locator.locatorKey : null,
                valueRef,
                sourceStep: step.order
            };
            if (blocker) entry.blocker = blocker;
            actions.push(entry);
        }

        return { actions, locatorRefs, dataRefs, setup };
    }

    /** Giá trị demo cho field (dùng chế độ autoApprove). */
    demoValue(target) {
        const t = String(target ?? "").toLowerCase();
        if (t.includes("mã")) return `MA-${Date.now().toString().slice(-6)}`;
        if (t.includes("tên") || t.includes("ten")) return "Thiết bị demo";
        if (t.includes("tài khoản") || t.includes("username") || t.includes("account")) {
            return "admin";
        }
        if (t.includes("mật khẩu") || t.includes("password")) return "demo123";
        if (t.includes("ghi chú") || t.includes("note")) return "Ghi chú tự động";
        if (t.includes("loại") || t.includes("type")) return "Loại 1";
        if (t.includes("trạng thái") || t.includes("status")) return "Hoạt động";
        return `Value ${String(target ?? "").slice(0, 30)}`;
    }

    /** Gỡ các blocker đã được giải quyết trong chế độ demo. */
    softenBlockers(blockers, missing, prefixes) {
        for (let i = blockers.length - 1; i >= 0; i--) {
            if (prefixes.some((p) => blockers[i].startsWith(p))) {
                blockers.splice(i, 1);
            }
        }
    }

    buildAssertions(testCase, screen, autoApprove) {
        const assertions = [];
        const locatorRefs = [];
        const seen = new Set();
        const items = Array.isArray(testCase.assertions)
            ? testCase.assertions
            : Array.isArray(testCase.expectedResults)
              ? testCase.expectedResults.map((e) => ({ target: testCase.feature, expected: e }))
              : [];

        for (const a of items) {
            const assertionType = mapAssertionType(a.type) || normalizeAssertion(a.expected) || "toBeVisible";
            const target = a.target ?? testCase.feature ?? "";
            const { locator } = this.resolveLocator(screen, target, autoApprove);
            if (locator && !seen.has(locator.locatorKey)) {
                seen.add(locator.locatorKey);
                locatorRefs.push(locator.toJSON());
            }
            assertions.push({
                type: assertionType,
                locatorKey: locator ? locator.locatorKey : null,
                target,
                expectedValue: a.expected ?? ""
            });
        }
        return { assertions, assertionLocators: locatorRefs };
    }

    resolveLocator(screen, target, autoApprove) {
        if (!screen || !target) return { locator: null, blocker: "MISSING_TARGET" };
        if (!this.locatorStore) return { locator: null, blocker: "NO_LOCATOR_STORE" };
        const { locator, blocker } = this.locatorStore.resolve(screen, target);
        if (locator && autoApprove && locator.isDraft) {
            locator.confirmed = true;
            locator.source = "AI_PROPOSAL_AUTO";
        }
        return { locator, blocker };
    }

    valueRefFor(testCase, target, step, action) {
        // Ưu tiên testData.inputs theo field name
        const inputs = testCase.testData?.inputs ?? {};
        if (inputs && typeof inputs === "object") {
            const key = Object.keys(inputs).find((k) =>
                String(k).toLowerCase().includes(String(target).toLowerCase())
            );
            if (key) return `testData.inputs.${key}`;
        }
        if (step.value) return `literal:${step.value}`;
        if (action === "fill" || action === "select") return `testData.${this.slugify(target)}`;
        return null;
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
}
