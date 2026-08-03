/**
 * DiscoveryService — thu thập bằng chứng từ các nguồn cho một testcase.
 *
 * Nguồn được phân loại:
 *  - Locator Repository (config/locators, do tester duy trì): nếu entry confirmed => APPROVED,
 *    ngược lại vẫn là DRAFT.
 *  - AI Proposal: LUÔN DRAFT.
 *  - Confirmed Facts (route/assertion text từ approved-testcases.json): là dữ liệu test-design đã
 *    approved, được đánh dấu CONFIRMED_FACTS (APPROVED cho value, nhưng locator vẫn phải qua review).
 *
 * KHÔNG auto-approve bất kỳ AI Proposal nào.
 */
import slugify from "../../utils/Slug.js";
import AutomationDiscovery from "../evidence/AutomationDiscovery.js";
import AutomationEvidence from "../evidence/AutomationEvidence.js";
import { EVIDENCE_SOURCE } from "../evidence/EvidenceSource.js";
import { EVIDENCE_STATE } from "../evidence/EvidenceState.js";
import { normalizeAction } from "../AutomationActions.js";

const TARGET_ACTIONS = new Set(["fill", "select", "click", "check", "press"]);

export default class DiscoveryService {
    /**
     * @param {object} options
     * @param {object|null} options.locatorStore  LocatorReferenceStore (nạp config/locators)
     * @param {(screen:string, field:string)=>object|null} options.aiProposer  đề xuất AI
     */
    constructor({ locatorStore = null, aiProposer = null } = {}) {
        this.locatorStore = locatorStore;
        this.aiProposer = aiProposer;
    }

    discover(testCase) {
        const hints = testCase.automationHints ?? {};
        const screen = hints.screen ?? testCase.module ?? "";
        const module = testCase.module ?? "";
        const feature = testCase.feature ?? "";
        const discovery = new AutomationDiscovery({ testCaseId: testCase.id, module, feature });

        // ---- Route ----
        this.discoverRoute(discovery, testCase, hints, screen);

        // ---- Page Object (đề xuất, DRAFT) ----
        if (screen) {
            discovery.addEvidence(
                new AutomationEvidence({
                    testCaseId: testCase.id,
                    kind: "pageObject",
                    key: "pageObject",
                    value: slugify(screen),
                    source: EVIDENCE_SOURCE.AI_PROPOSAL,
                    proposedBy: "AI",
                    notes: "Page object đề xuất từ screen"
                })
            );
        }

        // ---- Steps ----
        const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
        for (const step of steps) {
            this.discoverStep(discovery, testCase, step, screen);
        }

        // ---- Assertions ----
        this.discoverAssertions(discovery, testCase, screen);

        return discovery;
    }

    discoverRoute(discovery, testCase, hints, screen) {
        if (hints.route) {
            discovery.addEvidence(
                new AutomationEvidence({
                    testCaseId: testCase.id,
                    kind: "route",
                    key: "route",
                    value: hints.route,
                    source: EVIDENCE_SOURCE.CONFIRMED_FACTS,
                    proposedBy: "TESTER",
                    state: EVIDENCE_STATE.APPROVED,
                    reviewedBy: "TESTER",
                    notes: "Route có trong approved-testcases.json (confirmed facts)"
                })
            );
        } else {
            // Route không xác nhận => AI đề xuất DRAFT (không tự APPROVED)
            const proposed = `/${slugify(screen || "app")}`;
            discovery.addEvidence(
                new AutomationEvidence({
                    testCaseId: testCase.id,
                    kind: "route",
                    key: "route",
                    value: proposed,
                    source: EVIDENCE_SOURCE.AI_PROPOSAL,
                    proposedBy: "AI",
                    notes: "Route suy luận — bắt buộc qua Automation Review"
                })
            );
        }
    }

    discoverStep(discovery, testCase, step, screen) {
        const order = step.order;
        const action = normalizeAction(step.action);

        if (!action) {
            // Action không nhận diện => AI đề xuất diễn giải (DRAFT), đồng thời là cảnh báo
            discovery.addEvidence(
                new AutomationEvidence({
                    testCaseId: testCase.id,
                    stepId: order,
                    kind: "action",
                    key: `action.${order}`,
                    value: step.action,
                    source: EVIDENCE_SOURCE.AI_PROPOSAL,
                    proposedBy: "AI",
                    notes: "Action chưa nhận diện — cần review"
                })
            );
            return;
        }

        if (action === "setup" || action === "verify") {
            // Không phải action automation trực tiếp; ghi chú, không tạo evidence automation
            return;
        }

        if (action === "goto" || action === "open") {
            // Navigation dùng route (đã thu thập riêng)
            return;
        }

        if (!TARGET_ACTIONS.has(action)) {
            return;
        }

        const target = step.target ?? "";
        if (!target) return;

        // ---- Locator cho target ----
        this.discoverLocator(discovery, testCase, order, screen, target, step);

        // ---- Test data ----
        if (action === "fill" || action === "select") {
            this.discoverTestData(discovery, testCase, order, target, step);
        }
    }

    discoverLocator(discovery, testCase, order, screen, target, step) {
        const key = slugify(target);
        // 1) Locator Repository (confirmed)
        const repo = this.locatorStore?.getConfirmed(screen, key) || this.locatorStore?.getConfirmed(screen, target);
        if (repo) {
            discovery.addEvidence(
                new AutomationEvidence({
                    testCaseId: testCase.id,
                    stepId: order,
                    kind: "locator",
                    key,
                    value: repo.value,
                    strategy: repo.strategy,
                    source: EVIDENCE_SOURCE.LOCATOR_REPOSITORY,
                    proposedBy: repo.source ?? "TESTER",
                    state: EVIDENCE_STATE.APPROVED,
                    reviewedBy: "TESTER",
                    notes: "Locator từ Locator Repository (tester duy trì)"
                })
            );
            return;
        }
        // 2) AI Proposal — luôn DRAFT
        const proposal = this.aiProposer
            ? this.aiProposer(screen, target)
            : this.locatorStore?.propose?.(screen, target);
        discovery.addEvidence(
            new AutomationEvidence({
                testCaseId: testCase.id,
                stepId: order,
                kind: "locator",
                key,
                value: proposal?.value ?? target,
                strategy: proposal?.strategy ?? "getByLabel",
                source: EVIDENCE_SOURCE.AI_PROPOSAL,
                proposedBy: "AI",
                notes: "Locator AI đề xuất — bắt buộc qua Automation Review, không tự APPROVED"
            })
        );
    }

    discoverTestData(discovery, testCase, order, target, step) {
        const key = slugify(target);
        const hasValue = Boolean(step.value);
        const hasInputs = Boolean(
            testCase.testData?.inputs && Object.keys(testCase.testData.inputs).length
        );
        if (hasValue || hasInputs) {
            // Dữ liệu test-design approved từ approved-testcases.json
            discovery.addEvidence(
                new AutomationEvidence({
                    testCaseId: testCase.id,
                    stepId: order,
                    kind: "testData",
                    key,
                    value: step.value || testCase.testData?.value || "",
                    source: EVIDENCE_SOURCE.CONFIRMED_FACTS,
                    proposedBy: "TESTER",
                    state: EVIDENCE_STATE.APPROVED,
                    reviewedBy: "TESTER",
                    notes: "Test data từ approved-testcases.json"
                })
            );
        } else {
            // Không có test data => ghi DRAFT (để tester điền), không tự sinh giá trị
            discovery.addEvidence(
                new AutomationEvidence({
                    testCaseId: testCase.id,
                    stepId: order,
                    kind: "testData",
                    key,
                    value: "",
                    source: EVIDENCE_SOURCE.AI_PROPOSAL,
                    proposedBy: "AI",
                    notes: "Thiếu test data — cần tester cung cấp (MISSING_DATA)"
                })
            );
        }
    }

    discoverAssertions(discovery, testCase, screen) {
        const assertions = Array.isArray(testCase.assertions) ? testCase.assertions : [];
        for (const a of assertions) {
            const target = a.target ?? testCase.feature ?? "";
            const key = slugify(target);
            // Expected text là confirmed facts (approved test design)
            discovery.addEvidence(
                new AutomationEvidence({
                    testCaseId: testCase.id,
                    kind: "assertion",
                    key: `${key}.expected`,
                    value: a.expected ?? "",
                    source: EVIDENCE_SOURCE.CONFIRMED_FACTS,
                    proposedBy: "TESTER",
                    state: EVIDENCE_STATE.APPROVED,
                    reviewedBy: "TESTER",
                    notes: "Expected result từ approved-testcases.json"
                })
            );
            // Assertion locator là automation -> Locator Repository hoặc AI DRAFT
            const repo =
                this.locatorStore?.getConfirmed(screen, key) || this.locatorStore?.getConfirmed(screen, target);
            if (repo) {
                discovery.addEvidence(
                    new AutomationEvidence({
                        testCaseId: testCase.id,
                        kind: "locator",
                        key: `${key}.assert`,
                        value: repo.value,
                        strategy: repo.strategy,
                        source: EVIDENCE_SOURCE.LOCATOR_REPOSITORY,
                        proposedBy: repo.source ?? "TESTER",
                        state: EVIDENCE_STATE.APPROVED,
                        reviewedBy: "TESTER",
                        notes: "Assertion locator từ Locator Repository"
                    })
                );
            } else {
                const proposal = this.aiProposer
                    ? this.aiProposer(screen, target)
                    : this.locatorStore?.propose?.(screen, target);
                discovery.addEvidence(
                    new AutomationEvidence({
                        testCaseId: testCase.id,
                        kind: "locator",
                        key: `${key}.assert`,
                        value: proposal?.value ?? target,
                        strategy: proposal?.strategy ?? "getByLabel",
                        source: EVIDENCE_SOURCE.AI_PROPOSAL,
                        proposedBy: "AI",
                        notes: "Assertion locator AI đề xuất — DRAFT"
                    })
                );
            }
        }
    }
}
