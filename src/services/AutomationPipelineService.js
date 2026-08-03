import fs from "node:fs";
import path from "node:path";
import LocatorReferenceStore from "../automation/LocatorReferenceStore.js";
import AutomationMappingGenerator from "../automation/AutomationMappingGenerator.js";
import PlaywrightGenerator from "../automation/PlaywrightGenerator.js";
import PlaywrightRunner from "../automation/PlaywrightRunner.js";
import ExecutionReport from "../automation/ExecutionReport.js";

/**
 * AutomationPipelineService
 * Điều phối Phase 2: đọc approved testcase JSON -> mapping -> sinh Playwright -> chạy -> báo cáo.
 * Output:
 *   outputs/automation-mapping/<module>.json
 *   outputs/playwright/<module>/...
 *   outputs/execution/<module>/results.json + report.json
 */
export default class AutomationPipelineService {
    constructor({
        rootDir = process.cwd(),
        approvedFile = "",
        locatorStore = null,
        mappingGenerator = null,
        playwrightGenerator = null,
        runner = null
    } = {}) {
        this.rootDir = rootDir;
        this.approvedFile =
            approvedFile ||
            path.join(rootDir, "outputs", "production", "json", "approved-testcases.json");
        this.locatorStore = locatorStore ?? new LocatorReferenceStore({ rootDir });
        this.mappingGenerator =
            mappingGenerator ?? new AutomationMappingGenerator({ locatorStore: this.locatorStore });
        this.playwrightGenerator =
            playwrightGenerator ??
            new PlaywrightGenerator({ outputDir: path.join(this.outputRoot(), "playwright") });
        this.runner = runner ?? new PlaywrightRunner({ rootDir });
    }

    outputRoot() {
        return path.join(this.rootDir, "outputs");
    }

    loadApproved() {
        if (!fs.existsSync(this.approvedFile)) {
            throw new Error(`Không tìm thấy ${this.approvedFile}`);
        }
        const data = JSON.parse(fs.readFileSync(this.approvedFile, "utf8"));
        return Array.isArray(data) ? data : [];
    }

    filterByModule(testCases, module) {
        if (!module) return testCases;
        const q = String(module).trim().toLowerCase();
        return testCases.filter(
            (tc) =>
                String(tc.module ?? "").toLowerCase().includes(q) ||
                String(tc.feature ?? "").toLowerCase().includes(q)
        );
    }

    /**
     * Chạy toàn bộ pipeline (mapping -> sinh -> chạy -> báo cáo).
     * @param {object} opts
     * @param {string} [opts.module]
     * @param {boolean} [opts.autoApprove] chế độ demo (locator/route/data draft coi như duyệt)
     * @param {boolean} [opts.run] có chạy playwright không
     */
    async run({ module = "", autoApprove = true, run = true } = {}) {
        const testCases = this.filterByModule(this.loadApproved(), module);
        const modName = module || (testCases[0]?.module ?? "Module");

        // 1. Mapping (mọi mapping draft -> WAITING_FOR_REVIEW hoặc APPROVED)
        const mappings = testCases.map((tc) =>
            this.mappingGenerator.generate(tc, { autoApprove })
        );
        if (autoApprove) mappings.forEach((m) => (m.status = "APPROVED"));
        const readyCount = mappings.filter((m) => m.blockers.length === 0).length;

        // 2. Lưu mapping
        const mappingDir = path.join(this.outputRoot(), "automation-mapping");
        fs.mkdirSync(mappingDir, { recursive: true });
        const mappingFile = path.join(mappingDir, `${this.slugify(modName)}.json`);
        fs.writeFileSync(
            mappingFile,
            JSON.stringify(
                { module: modName, generatedAt: new Date().toISOString(), mappings: mappings.map((m) => m.toJSON()) },
                null,
                2
            )
        );

        // 3. Sinh Playwright project
        const generated = this.playwrightGenerator.generate(mappings, { module: modName });

        // 4. Chạy + báo cáo
        const runResult = run ? await this.runner.runProject(generated.projectDir) : null;
        const executionResults = runResult
            ? this.runner.buildExecutionResults(generated.projectDir, generated.manifest, runResult)
            : [];
        const report = new ExecutionReport().build(executionResults);

        // Lưu execution
        const execDir = path.join(this.outputRoot(), "execution", this.slugify(modName));
        fs.mkdirSync(execDir, { recursive: true });
        const resultsFile = path.join(execDir, "results.json");
        const reportFile = path.join(execDir, "report.json");
        fs.writeFileSync(resultsFile, JSON.stringify(executionResults.map((r) => r.toJSON()), null, 2));
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        return {
            module: modName,
            testCaseCount: testCases.length,
            readyCount,
            blockedCount: mappings.length - readyCount,
            mappingFile,
            playwrightProjectDir: generated.projectDir,
            generatedFiles: generated.manifest.files,
            ran: runResult !== null,
            runOk: runResult?.ok ?? null,
            runDiagnostic: runResult?.error ?? null,
            executionReport: report,
            resultsFile,
            reportFile
        };
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
