import assert from "node:assert";
import ReviewWorkflow from "../src/automation/ReviewWorkflow.js";
import ReadinessEvaluator from "../src/automation/mapping/ReadinessEvaluator.js";
import ApprovedAutomationMapping from "../src/automation/mapping/ApprovedAutomationMapping.js";
import { EVIDENCE_SOURCE } from "../src/automation/evidence/EvidenceSource.js";
import { EVIDENCE_STATE } from "../src/automation/evidence/EvidenceState.js";
import { REVIEW_DECISION } from "../src/automation/review/AutomationReview.js";

let failures = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✔ ${name}`);
    } catch (e) {
        failures++;
        console.error(`  ✘ ${name}`);
        console.error(`    ${e.message}`);
    }
}

// ---- Testcase mẫu (cấu trúc giống approved-testcases.json) ----
function fixtureTC() {
    return {
        id: "TC001",
        module: "Thiết bị",
        feature: "Thêm thiết bị",
        automationHints: { screen: "Device", operation: "CREATE", route: "", navigation: [], controls: {} },
        steps: [
            { order: 1, action: "Thiết lập điều kiện trước", target: "Device", value: "", expected: "Điều kiện trước được đáp ứng" },
            { order: 2, action: "Mở màn hình hoặc chức năng", target: "Device", value: "", expected: "Màn hình hiển thị" },
            { order: 3, action: "Nhập dữ liệu", target: "Mã thiết bị", value: "", expected: "nhận giá trị" },
            { order: 4, action: "Nhập dữ liệu", target: "Tên thiết bị", value: "", expected: "nhận giá trị" },
            { order: 5, action: "Lưu dữ liệu", target: "Device", value: "", expected: "gửi yêu cầu" },
            { order: 6, action: "Kiểm tra kết quả nghiệp vụ", target: "Device", value: "", expected: "Thiết bị được tạo thành công." }
        ],
        assertions: [{ type: "SUCCESS", target: "Thêm thiết bị", expected: "Thiết bị được tạo thành công." }],
        testData: { requirement: "dữ liệu hợp lệ", value: "" }
    };
}

function ev(discovery, kind, key) {
    return discovery.evidence.find((e) => e.kind === kind && e.key === key);
}
function evidenceByKind(discovery, kind) {
    return discovery.evidence.filter((e) => e.kind === kind);
}

console.log("\n==================================================");
console.log(" AUTOMATION MAPPING LAYER TEST");
console.log("==================================================\n");

const wf = new ReviewWorkflow();

// 1. Discovery: mọi AI Proposal đều DRAFT
test("Discovery: AI proposal locator/route là DRAFT, không APPROVED", () => {
    const { discovery } = wf.discover(fixtureTC());
    const proposals = discovery.evidence.filter((e) => e.isProposal);
    assert.ok(proposals.length > 0, "có AI proposal");
    for (const p of proposals) {
        assert.strictEqual(p.state, EVIDENCE_STATE.DRAFT, `AI proposal phải DRAFT: ${p.key}`);
    }
});

test("Discovery: không có bất kỳ AI proposal nào tự APPROVED", () => {
    const { discovery } = wf.discover(fixtureTC());
    const autoApproved = discovery.evidence.filter(
        (e) => e.source === EVIDENCE_SOURCE.AI_PROPOSAL && e.state === EVIDENCE_STATE.APPROVED
    );
    assert.strictEqual(autoApproved.length, 0, "không được auto-approve AI proposal");
});

// 2. Draft mapping (chỉ evidence APPROVED) -> route thiếu -> BLOCKED
test("Draft mapping từ approved evidence (không có route/locator) là BLOCKED", () => {
    const { draftMapping } = wf.discover(fixtureTC());
    assert.strictEqual(draftMapping.readiness, "BLOCKED");
    assert.ok(draftMapping.missingEvidence.some((m) => m.kind === "route"));
    assert.ok(draftMapping.missingEvidence.some((m) => m.kind === "locator"));
});

// 3. Review đầy đủ -> Approved mapping READY
test("Review approve route + locator + data -> Approved mapping READY", () => {
    const tc = fixtureTC();
    const { discovery } = wf.discover(tc);
    const decisions = [
        // route (AI draft) -> tester EDIT thành route thật
        { evidenceId: ev(discovery, "route", "route").id, decision: REVIEW_DECISION.EDIT, editedValue: "/devices/create", comment: "route chính thức" },
        // locators -> approve
        { evidenceId: ev(discovery, "locator", "ma-thiet-bi").id, decision: REVIEW_DECISION.APPROVE, comment: "ok" },
        { evidenceId: ev(discovery, "locator", "ten-thiet-bi").id, decision: REVIEW_DECISION.APPROVE, comment: "ok" },
        { evidenceId: ev(discovery, "locator", "device").id, decision: REVIEW_DECISION.APPROVE, comment: "ok" },
        // assertion locator
        { evidenceId: ev(discovery, "locator", "them-thiet-bi.assert").id, decision: REVIEW_DECISION.APPROVE, comment: "ok" },
        // data
        { evidenceId: ev(discovery, "testData", "ma-thiet-bi").id, decision: REVIEW_DECISION.EDIT, editedValue: "MA-001", comment: "data thật" },
        { evidenceId: ev(discovery, "testData", "ten-thiet-bi").id, decision: REVIEW_DECISION.EDIT, editedValue: "Thiết bị A", comment: "data thật" }
    ];
    const review = wf.review(discovery, decisions);
    assert.strictEqual(review.approved.length, 7, "7 evidence được duyệt");

    const { approvedMapping, readiness } = wf.approve({ testCase: tc, discovery });
    assert.ok(approvedMapping instanceof ApprovedAutomationMapping, "là ApprovedAutomationMapping");
    assert.strictEqual(approvedMapping.isApproved, true);
    assert.strictEqual(readiness.level, "READY");
    assert.strictEqual(approvedMapping.route, "/devices/create");
    assert.strictEqual(approvedMapping.dataReferences["ma-thiet-bi"], "MA-001");
    // assertion
    assert.ok(approvedMapping.assertions[0].locatorKey, "assertion có locator");
});

// 4. Thiếu data -> PARTIAL
test("Review đủ route+locator nhưng thiếu data -> PARTIAL", () => {
    const tc = fixtureTC();
    const { discovery } = wf.discover(tc);
    const decisions = [
        { evidenceId: ev(discovery, "route", "route").id, decision: REVIEW_DECISION.EDIT, editedValue: "/devices/create" },
        { evidenceId: ev(discovery, "locator", "ma-thiet-bi").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "ten-thiet-bi").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "device").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "them-thiet-bi.assert").id, decision: REVIEW_DECISION.APPROVE }
        // KHÔNG approve data
    ];
    wf.review(discovery, decisions);
    const { readiness } = wf.approve({ testCase: tc, discovery });
    assert.strictEqual(readiness.level, "PARTIAL");
    assert.ok(readiness.missingData.length >= 2, "thiếu data 2 field");
});

// 5. Thiếu locator -> BLOCKED
test("Review thiếu locator chính -> BLOCKED", () => {
    const tc = fixtureTC();
    const { discovery } = wf.discover(tc);
    const decisions = [
        { evidenceId: ev(discovery, "route", "route").id, decision: REVIEW_DECISION.EDIT, editedValue: "/devices/create" },
        // chỉ approve 1 locator, bỏ các locator khác
        { evidenceId: ev(discovery, "locator", "ma-thiet-bi").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "them-thiet-bi.assert").id, decision: REVIEW_DECISION.APPROVE }
    ];
    wf.review(discovery, decisions);
    const { readiness } = wf.approve({ testCase: tc, discovery });
    assert.strictEqual(readiness.level, "BLOCKED");
    assert.ok(readiness.blockers.some((b) => b.startsWith("LOCATOR_MISSING")), "thiếu locator action");
});

// 6. Reject evidence -> không được dùng
test("Reject locator -> mapping không dùng evidence bị từ chối", () => {
    const tc = fixtureTC();
    const { discovery } = wf.discover(tc);
    const decisions = [
        { evidenceId: ev(discovery, "route", "route").id, decision: REVIEW_DECISION.EDIT, editedValue: "/devices/create" },
        { evidenceId: ev(discovery, "locator", "ma-thiet-bi").id, decision: REVIEW_DECISION.REJECT, comment: "sai locator" },
        { evidenceId: ev(discovery, "locator", "ten-thiet-bi").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "device").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "them-thiet-bi.assert").id, decision: REVIEW_DECISION.APPROVE }
    ];
    wf.review(discovery, decisions);
    const { approvedMapping } = wf.approve({ testCase: tc, discovery });
    // "Mã thiết bị" bị reject -> action thiếu locator -> BLOCKED
    assert.strictEqual(approvedMapping.readiness, "BLOCKED");
});

// 7. Traceability: mỗi evidence biết nguồn/proposer/reviewer
test("Evidence traceability (source/proposedBy/reviewedBy)", () => {
    const tc = fixtureTC();
    const { discovery } = wf.discover(tc);
    const loc = ev(discovery, "locator", "ma-thiet-bi");
    assert.strictEqual(loc.source, EVIDENCE_SOURCE.AI_PROPOSAL);
    assert.strictEqual(loc.proposedBy, "AI");
    assert.strictEqual(loc.isDraft, true);
});

// 8. Shape tương thích Generator
test("Approved mapping shape tương thích PlaywrightGenerator", () => {
    const tc = fixtureTC();
    const { discovery } = wf.discover(tc);
    const decisions = [
        { evidenceId: ev(discovery, "route", "route").id, decision: REVIEW_DECISION.EDIT, editedValue: "/devices/create" },
        { evidenceId: ev(discovery, "locator", "ma-thiet-bi").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "ten-thiet-bi").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "device").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "locator", "them-thiet-bi.assert").id, decision: REVIEW_DECISION.APPROVE },
        { evidenceId: ev(discovery, "testData", "ma-thiet-bi").id, decision: REVIEW_DECISION.EDIT, editedValue: "MA-001" },
        { evidenceId: ev(discovery, "testData", "ten-thiet-bi").id, decision: REVIEW_DECISION.EDIT, editedValue: "Thiết bị A" }
    ];
    wf.review(discovery, decisions);
    const { approvedMapping } = wf.approve({ testCase: tc, discovery });
    const j = approvedMapping.toJSON();
    for (const k of ["route", "pageObject", "actions", "assertions", "locatorReferences", "dataReferences", "setup", "testCaseId"]) {
        assert.ok(k in j, `thiếu key ${k}`);
    }
    assert.strictEqual(j.state, "APPROVED");
});

// 9. ReadinessEvaluator nghiêm ngặt: thiếu assertion evidence -> BLOCKED
test("Thiếu assertion locator -> không READY (BLOCKED)", () => {
    const evl = new ReadinessEvaluator();
    const mapping = {
        route: "/devices/create",
        actions: [{ action: "goto", target: "/", locatorKey: null }],
        assertions: [{ target: "Thêm thiết bị", locatorKey: null }],
        missingEvidence: []
    };
    const r = evl.evaluate(mapping);
    assert.strictEqual(r.level, "BLOCKED");
    assert.ok(r.blockers.some((b) => b.startsWith("ASSERTION_LOCATOR_MISSING")));
});

console.log(`\n==================================================`);
if (failures === 0) {
    console.log(" ALL MAPPING LAYER TESTS PASSED ✔");
} else {
    console.log(` ${failures} FAILURE(S) ✘`);
}
console.log("==================================================\n");
process.exit(failures === 0 ? 0 : 1);
