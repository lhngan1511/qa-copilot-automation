/**
 * MappingBuilder — dựng Automation Mapping CHỈ từ bằng chứng APPROVED.
 * Không tự sinh locator/data/assertion/route. Mọi thành phần thiếu được ghi
 * vào missingEvidence để ReadinessEvaluator quyết định.
 */
import slugify from "../../utils/Slug.js";
import AutomationMapping from "./AutomationMapping.js";
import { MAPPING_STATE } from "./MappingState.js";
import { normalizeAction } from "../AutomationActions.js";
import { canBeUsedInMapping } from "../evidence/EvidenceState.js";

const TARGET_ACTIONS = new Set(["fill", "select", "click", "check", "press"]);
const VALUE_ACTIONS = new Set(["fill", "select"]);

export default class MappingBuilder {
    /**
     * @param {object} options
     * @param {function} [options.makeId] sinh artifactId
     */
    constructor({ makeId = null } = {}) {
        this.makeId = makeId;
    }

    /**
     * @param {object} input
     * @param {object} input.testCase  testcase từ approved-testcases.json
     * @param {Array<import('../evidence/AutomationEvidence.js').default>} input.approvedEvidence
     * @param {string} [input.state]
     */
    build({ testCase, approvedEvidence = [], state = MAPPING_STATE.DRAFT }) {
        const usable = approvedEvidence.filter((e) => canBeUsedInMapping(e.state));
        const byKindKey = this.index(usable);
        const missingEvidence = [];

        // ---- Route ----
        const routeEv = usable.find((e) => e.kind === "route");
        const route = routeEv ? routeEv.value : null;
        if (!route) missingEvidence.push({ kind: "route", reason: "chưa có route APPROVED" });

        // ---- Page Object ----
        const poEv = usable.find((e) => e.kind === "pageObject");
        const pageObject = poEv ? poEv.value : null;

        // ---- Steps -> actions ----
        const actions = [];
        const setup = [];
        const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
        const seenTargets = new Map(); // key -> {locatorKey,strategy,value,evidenceId}

        for (const step of steps) {
            const order = step.order;
            const action = normalizeAction(step.action);
            if (!action) {
                missingEvidence.push({ kind: "action", step: order, reason: "action không nhận diện" });
                continue;
            }
            if (action === "setup") {
                setup.push({ stepId: `${testCase.id}-STEP-${order}`, description: step.action, sourceStep: order });
                continue;
            }
            if (action === "verify") continue;
            if (action === "goto" || action === "open") {
                actions.push({ stepId: `${testCase.id}-STEP-${order}`, action: "goto", target: route ?? "/", valueRef: null, sourceStep: order });
                continue;
            }
            if (!TARGET_ACTIONS.has(action)) continue;
            if (!step.target) {
                missingEvidence.push({ kind: "target", step: order, reason: "step thiếu target" });
                continue;
            }

            const key = slugify(step.target);
            const locEv = this.findLocator(usable, key) || this.findLocator(usable, slugify(step.target));
            let locatorKey = null;
            if (locEv) {
                locatorKey = locEv.key;
                if (!seenTargets.has(locatorKey)) {
                    seenTargets.set(locatorKey, {
                        locatorKey,
                        strategy: locEv.strategy,
                        value: locEv.value
                    });
                }
            } else {
                missingEvidence.push({ kind: "locator", step: order, target: step.target, reason: "chưa có locator APPROVED" });
            }

            // valueRef
            let valueRef = null;
            if (VALUE_ACTIONS.has(action)) {
                const dataEv = usable.find((e) => e.kind === "testData" && e.key === key);
                if (dataEv && dataEv.value) {
                    valueRef = `literal:${dataEv.value}`;
                } else if (step.value) {
                    valueRef = `literal:${step.value}`;
                } else {
                    missingEvidence.push({ kind: "testData", step: order, target: step.target, reason: "MISSING_DATA" });
                }
            }

            actions.push({
                stepId: `${testCase.id}-STEP-${order}`,
                action,
                target: step.target,
                locatorKey,
                valueRef,
                sourceStep: order
            });
        }

        // ---- Assertions ----
        const assertions = [];
        const assertionsList = Array.isArray(testCase.assertions) ? testCase.assertions : [];
        for (const a of assertionsList) {
            const target = a.target ?? testCase.feature ?? "";
            const key = slugify(target);
            const assertKey = `${key}.assert`;
            const locEv = usable.find((e) => e.kind === "locator" && e.key === assertKey);
            const assertion = {
                type: "toBeVisible",
                locatorKey: locEv ? locEv.key : null,
                target,
                expectedValue: a.expected ?? ""
            };
            if (locEv && !seenTargets.has(assertKey)) {
                seenTargets.set(assertKey, { locatorKey: assertKey, strategy: locEv.strategy, value: locEv.value });
            }
            if (!locEv) {
                missingEvidence.push({ kind: "assertionLocator", target, reason: "chưa có assertion locator APPROVED" });
            }
            assertions.push(assertion);
        }

        // ---- Data references ----
        const dataReferences = {};
        for (const e of usable.filter((x) => x.kind === "testData" && x.value)) {
            dataReferences[e.key] = e.value;
        }

        // ---- Locator references ----
        const locatorReferences = Array.from(seenTargets.values());

        const artifactId =
            this.makeId?.({ testCaseId: testCase.id, state }) ?? `AM-${testCase.id}`;

        return new AutomationMapping({
            artifactId,
            testCaseId: testCase.id,
            module: testCase.module ?? "",
            feature: testCase.feature ?? "",
            state,
            pageObject,
            route,
            setup,
            actions,
            assertions,
            locatorReferences,
            dataReferences,
            evidenceIds: usable.map((e) => e.id),
            missingEvidence
        });
    }

    findLocator(evidence, key) {
        return evidence.find((e) => e.kind === "locator" && e.key === key);
    }

    index(evidence) {
        const map = new Map();
        for (const e of evidence) {
            (map.get(e.kind) ?? map.set(e.kind, []).get(e.kind)).push(e);
        }
        return map;
    }
}
