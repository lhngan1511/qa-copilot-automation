/**
 * ReadinessEvaluator — đánh giá READY / PARTIAL / BLOCKED trên Automation Mapping đã review.
 *
 * Quy tắc nghiêm ngặt (theo kiến trúc):
 *  - KHÔNG dựa trên demo data, AI proposal, route/assertion suy luận, demo app.
 *  - Chỉ dùng locator thật sự có (locatorKey) trong mapping.
 *  - Thiếu route -> BLOCKED.
 *  - Thiếu locator cho action chính (fill/select/click/check/press) -> BLOCKED.
 *  - Action không nhận diện -> BLOCKED.
 *  - Thiếu assertion evidence (assertion locator) -> BLOCKED (không READY).
 *  - Thiếu test data cho fill/select -> PARTIAL (MISSING_DATA).
 *  - Đủ hết -> READY.
 */

const LOCATOR_REQUIRED_ACTIONS = new Set(["fill", "select", "click", "check", "press"]);
const DATA_REQUIRED_ACTIONS = new Set(["fill", "select"]);

export default class ReadinessEvaluator {
    /**
     * @param {import('./AutomationMapping.js').default} mapping
     * @returns {{level:'READY'|'PARTIAL'|'BLOCKED', blockers:string[], missingData:object[]}}
     */
    evaluate(mapping) {
        const blockers = [];
        const missingData = [];

        // Route
        if (!mapping.route) {
            blockers.push("ROUTE_MISSING");
        }

        // Actions
        for (const action of mapping.actions ?? []) {
            if (action.action === "goto" || action.action === "open" || action.action === "wait" || action.action === "screenshot") {
                continue;
            }
            if (LOCATOR_REQUIRED_ACTIONS.has(action.action)) {
                if (!action.locatorKey) {
                    blockers.push(`LOCATOR_MISSING:${action.sourceStep}:${action.target}`);
                }
            }
            if (DATA_REQUIRED_ACTIONS.has(action.action) && !action.valueRef) {
                missingData.push({ step: action.sourceStep, target: action.target });
            }
        }

        // Assertions
        for (const assertion of mapping.assertions ?? []) {
            if (!assertion.locatorKey) {
                blockers.push(`ASSERTION_LOCATOR_MISSING:${assertion.target}`);
            }
        }

        // Unresolved action (action chưa nhận diện, được ghi vào missingEvidence kind=action)
        for (const miss of mapping.missingEvidence ?? []) {
            if (miss.kind === "action") blockers.push(`ACTION_UNMAPPED:${miss.step}`);
        }

        let level;
        if (blockers.length > 0) {
            level = "BLOCKED";
        } else if (missingData.length > 0) {
            level = "PARTIAL";
        } else {
            level = "READY";
        }

        return { level, blockers, missingData };
    }

    apply(mapping) {
        const result = this.evaluate(mapping);
        mapping.readiness = result.level;
        return result;
    }
}
