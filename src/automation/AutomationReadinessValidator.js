/**
 * AutomationReadinessValidator
 * Kiểm tra một Approved TestCase xem có đủ dữ liệu để automation không
 * (route/navigation, locator/control, action, data, assertion).
 * Trả về { readiness, blockers }.
 */
import { normalizeAction } from "./AutomationActions.js";

export default class AutomationReadinessValidator {
    /**
     * @param {object} options
     * @param {import('./LocatorReferenceStore.js').default} [options.locatorStore]
     */
    constructor({ locatorStore = null } = {}) {
        this.locatorStore = locatorStore;
    }

    /**
     * @param {object} testCase  một testcase từ approved-testcases.json
     * @returns {{ready:boolean, blockers:string[], missing:string[]}}
     */
    evaluate(testCase) {
        const blockers = [];
        const missing = [];

        const hints = testCase.automationHints ?? {};
        const screen = hints.screen ?? testCase.module ?? "";
        const operation = (hints.operation ?? "").toUpperCase();
        const route = hints.route ?? "";
        const controls = hints.controls ?? {};

        // 1. Route / navigation
        const hasNav = Boolean(route) || Array.isArray(hints.navigation && hints.navigation.length);
        if (!hasNav) {
            missing.push("routeOrNavigation");
            blockers.push("MISSING_ROUTE");
        }

        // 2. Operation phải nhận diện được
        if (!operation) {
            missing.push("operation");
            blockers.push("UNKNOWN_OPERATION");
        }

        // 3. Đủ control/action cho từng step
        const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
        const actionTargets = [];
        for (const step of steps) {
            const action = normalizeAction(step.action);
            if (!action) {
                missing.push(`action:${step.order}`);
                blockers.push(`UNKNOWN_ACTION:${step.order}:${String(step.action).slice(0, 40)}`);
                continue;
            }
            // setup / verify không phải action cần automation thao tác trực tiếp
            if (action === "setup" || action === "verify") continue;
            if (action === "fill" || action === "select" || action === "click" || action === "check") {
                const target = step.target;
                if (!target) {
                    missing.push(`target:${step.order}`);
                    blockers.push(`MISSING_TARGET:${step.order}`);
                    continue;
                }
                actionTargets.push({ order: step.order, action, target, value: step.value ?? "" });
            }
        }

        // 4. Locator resolve (nếu có store)
        if (this.locatorStore && screen) {
            for (const at of actionTargets) {
                const { locator, blocker } = this.locatorStore.resolve(screen, at.target);
                if (blocker) {
                    missing.push(`locator:${at.target}`);
                    blockers.push(blocker);
                } else if (locator && locator.isDraft) {
                    // draft là cần review, không phải blocker
                    missing.push(`locator_draft:${at.target}`);
                }
            }
        }

        // 5. Data
        const dataRequired = actionTargets.some(
            (a) => (a.action === "fill" || a.action === "select") && !a.value
        );
        const hasData = Boolean(testCase.testData?.value) || Boolean(testCase.testData?.inputs);
        if (dataRequired && !hasData) {
            missing.push("testData");
            blockers.push("DATA_REQUIRED");
        }

        // 6. Assertions
        const assertions = Array.isArray(testCase.assertions) ? testCase.assertions : [];
        if (assertions.length === 0) {
            missing.push("assertions");
            blockers.push("MISSING_ASSERTION");
        }

        return {
            ready: blockers.length === 0,
            blockers,
            missing
        };
    }

    /** Trả về readiness level ổn định: READY | DATA_REQUIRED | NOT_READY */
    readinessOf(result) {
        if (result.ready) return "READY";
        if (result.blockers.length === 0) return "DATA_REQUIRED";
        return "NOT_READY";
    }
}
