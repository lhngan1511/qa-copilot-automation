#!/usr/bin/env node
/**
 * CLI Mapping Layer (Sprint: Automation Mapping)
 *
 *   node src/automation/cli-mapping.js [--module "Thiết bị"] [--testcase TC001] [--decisions decisions.json]
 *
 * Luồng:
 *   Discovery -> Draft mapping -> Review (từ decisions.json, nếu có) -> Approved mapping -> Readiness
 *
 * Generator / Runner KHÔNG nằm trong CLI này.
 */
import fs from "node:fs";
import path from "node:path";
import slugify from "../utils/Slug.js";
import ReviewWorkflow from "./ReviewWorkflow.js";
import AutomationPipelineService from "../services/AutomationPipelineService.js";

function parseArgs(argv) {
    const args = { module: "", testcase: "", decisions: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--module") args.module = argv[++i] ?? "";
        else if (a === "--testcase") args.testcase = argv[++i] ?? "";
        else if (a === "--decisions") args.decisions = argv[++i] ?? null;
    }
    return args;
}

function findEvidence(discovery, kind, key) {
    return discovery.evidence.find((e) => e.kind === kind && e.key === key);
}

/**
 * Giải quyết evidenceId từ file decisions.
 * Hỗ trợ dạng `<kind>-<key>` (tượng trưng, dễ đọc) hoặc id thật.
 */
function resolveDecisions(discovery, decisions) {
    const byId = new Map(discovery.evidence.map((e) => [e.id, e]));
    return decisions
        .map((d) => {
            let ev = byId.get(d.evidenceId);
            if (!ev) {
                const idx = d.evidenceId.indexOf("-");
                const kind = idx > 0 ? d.evidenceId.slice(0, idx) : null;
                const key = idx > 0 ? d.evidenceId.slice(idx + 1) : null;
                ev = kind ? findEvidence(discovery, kind, key) : null;
            }
            if (!ev) return null;
            return { ...d, evidenceId: ev.id };
        })
        .filter(Boolean);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const service = new AutomationPipelineService();
    const testCases = service.filterByModule(service.loadApproved(), args.module);
    const tc = args.testcase
        ? testCases.find((t) => String(t.id).toLowerCase() === args.testcase.toLowerCase())
        : testCases[0];
    if (!tc) throw new Error("Không tìm thấy testcase.");

    const wf = new ReviewWorkflow();
    const { discovery, draftMapping } = wf.discover(tc);

    console.log("=== AUTOMATION DISCOVERY ===");
    console.log(`testCaseId: ${tc.id} | module: ${tc.module} | feature: ${tc.feature}`);
    const bySource = discovery.evidenceBySource();
    for (const [source, items] of Object.entries(bySource)) {
        console.log(`\n[${source}] (${items.length})`);
        for (const e of items) {
            console.log(`  - ${e.kind} ${e.key} = ${e.value} [state=${e.state} proposedBy=${e.proposedBy}]`);
        }
    }

    console.log("\n=== DRAFT MAPPING (chỉ evidence APPROVED) ===");
    console.log(`readiness: ${draftMapping.readiness}`);
    console.log(`missingEvidence: ${JSON.stringify(draftMapping.missingEvidence)}`);

    let approvedMapping = null;
    let readiness = null;
    if (args.decisions) {
        const rawDecisions = JSON.parse(fs.readFileSync(path.resolve(args.decisions), "utf8"));
        const decisions = resolveDecisions(discovery, rawDecisions);
        const review = wf.review(discovery, decisions);
        const res = wf.approve({ testCase: tc, discovery });
        approvedMapping = res.approvedMapping;
        readiness = res.readiness;

        console.log("\n=== REVIEW ===");
        console.log(`reviewId: ${review.review.reviewId}`);
        console.log(`approved: ${review.approved.length} | rejected: ${review.rejected.length} | edits: ${review.edits.length}`);

        console.log("\n=== APPROVED AUTOMATION MAPPING ===");
        console.log(`state: ${approvedMapping.state} | readiness: ${readiness.level}`);
        console.log(`route: ${approvedMapping.route}`);
        console.log(`actions: ${JSON.stringify(approvedMapping.actions)}`);
        console.log(`assertions: ${JSON.stringify(approvedMapping.assertions)}`);
        console.log(`locatorReferences: ${JSON.stringify(approvedMapping.locatorReferences)}`);
        console.log(`dataReferences: ${JSON.stringify(approvedMapping.dataReferences)}`);
        console.log(`missingEvidence: ${JSON.stringify(approvedMapping.missingEvidence)}`);
        if (readiness.blockers.length) console.log(`blockers: ${JSON.stringify(readiness.blockers)}`);
        if (readiness.missingData.length) console.log(`missingData: ${JSON.stringify(readiness.missingData)}`);
    } else {
        console.log("\n(Chưa có file decisions — dùng --decisions để review rồi dựng Approved mapping.)");
    }
}

main().catch((err) => {
    console.error("LỖI:", err.message ?? err);
    process.exit(1);
});
