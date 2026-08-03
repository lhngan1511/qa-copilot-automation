#!/usr/bin/env node
/**
 * CLI Phase 2 — Automation
 *
 *   node src/automation/cli.js [--module "Thiết bị"] [--no-run]
 *
 * - Đọc outputs/production/json/approved-testcases.json
 * - Tạo Automation Mapping -> sinh Playwright -> (tùy chọn) chạy -> báo cáo
 */
import AutomationPipelineService from "../services/AutomationPipelineService.js";

function parseArgs(argv) {
    const args = { module: "", run: true, autoApprove: true };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--module") args.module = argv[++i] ?? "";
        else if (a === "--no-run") args.run = false;
        else if (a === "--no-approve") args.autoApprove = false;
    }
    return args;
}

const args = parseArgs(process.argv.slice(2));

async function main() {
    const service = new AutomationPipelineService();
    console.log("[QA Copilot Phase 2] Starting automation pipeline...");
    console.log(
        `  module=${args.module || "(tất cả)"} run=${args.run} autoApprove=${args.autoApprove}`
    );
    const result = await service.run(args);
    console.log("=== KẾT QUẢ ===");
    console.log(`Module          : ${result.module}`);
    console.log(`TestCase        : ${result.testCaseCount}`);
    console.log(`Mapping ready   : ${result.readyCount}`);
    console.log(`Mapping blocked : ${result.blockedCount}`);
    console.log(`Mapping file    : ${result.mappingFile}`);
    console.log(`Playwright dir  : ${result.playwrightProjectDir}`);
    console.log(`Sinh            : ${result.generatedFiles.length} files`);
    if (result.ran) {
        console.log(`Run ok          : ${result.runOk}`);
        if (result.runDiagnostic) console.log(`  diagnostic    : ${result.runDiagnostic}`);
        const s = result.executionReport?.summary;
        if (s) {
            console.log(
                `Execution       : passed=${s.passed} failed=${s.failed} error=${s.error} notExecuted=${s.notExecuted} passRate=${s.passRate}%`
            );
        }
        console.log(`Execution file  : ${result.resultsFile}`);
        console.log(`Report file     : ${result.reportFile}`);
    } else {
        console.log("Run             : bỏ qua (--no-run)");
    }
}

main().catch((err) => {
    console.error("LỖI:", err.message ?? err);
    process.exit(1);
});
