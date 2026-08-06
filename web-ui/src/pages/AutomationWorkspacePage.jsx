import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AutomationHeader from "../components/automation/AutomationHeader.jsx";
import AutomationTestCaseList from "../components/automation/AutomationTestCaseList.jsx";
import AutomationInspector from "../components/automation/AutomationInspector.jsx";
import { analyzeAutomation, generateAutomation, runAutomation, exportAutomation, fetchServerConfig } from "../api/automationApi.js";
import { isReady } from "../utils/automationDerived.js";
import { extractBaseUrls, resolveBaseUrl, sourceLabel, workspaceKey, isValidUrl } from "../utils/baseUrl.js";

/*
 Giai đoạn 2 (Sprint 2) — Automation Intelligence là "màn hình xử lý".
 Workflow 6 bước: ① Upload ② AI Mapping ③ Review ④ Generate ⑤ Run ⑥ Export.

 - ① Upload đọc CẢ HAI file, chỉ báo "đọc thành công" + số lượng (testcase,
   locator/action/page), CHƯA sinh gì. Xong thì "Đã sẵn sàng phân tích".
 - ② AI Mapping đối chiếu từng testcase ↔ codegen (locator/action/assertion).
 - ③ Review: card testcase hiển thị JSON / CODEGEN / Mapping % / Run.
 - ④ Generate sinh Playwright cho testcase đã chọn.
 - ⑤ Run chạy file đã sinh (PASS / FAIL).
 - ⑥ Export xuất selected-testcases.json để dùng lại / chia sẻ / CI-CD.
 */

function normalizeTestCase(item, index) {
    return {
        ...item,
        id: String(item.id ?? item.testcaseId ?? `TC-${index + 1}`),
        title: item.title || item.name || item.testScenario || `Testcase ${index + 1}`,
        status: "READY",
        includedInSession: true,
        generatedCode: item.generatedCode || "",
        execution: { status: "NOT_RUN", durationMs: null, errorMessage: "", technicalLog: "" }
    };
}

// Trạng thái execution rỗng (xóa diagnostic cũ trước mỗi lần Run mới).
const emptyExecution = () => ({
    status: "NOT_RUN",
    durationMs: null,
    errorCode: null,
    errorMessage: "",
    failedStep: null,
    failedLocator: null,
    expectedValue: null,
    actualValue: null,
    output: "",
    screenshotPath: null,
    tracePath: null,
    reportPath: null
});

const STEPS = [
    ["① Upload", "testcase + CodeGen"],
    ["② AI Mapping", "testcase ↔ code"],
    ["③ Review", "kiểm tra AI"],
    ["④ Sinh automation", "tạo spec.js"],
    ["⑤ Chạy", "PASS / FAIL"],
    ["⑥ Export", "selected-testcases.json"]
];

export default function AutomationWorkspacePage() {
    const [sourceFileName, setSourceFileName] = useState("");
    const [testCases, setTestCases] = useState([]);
    const [codeGenFile, setCodeGenFile] = useState(null);
    const [codeGenStats, setCodeGenStats] = useState({ locators: 0, actions: 0, pages: [], pageCount: 0 });
    const [selectedTestCaseIds, setSelectedTestCaseIds] = useState([]);
    const [activeTestCaseId, setActiveTestCaseId] = useState(null);
    const [activeTab, setActiveTab] = useState("REVIEW");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [codeGenBaseUrls, setCodeGenBaseUrls] = useState([]);
    const [baseUrlEdited, setBaseUrlEdited] = useState("");
    const [envFallback, setEnvFallback] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [analyzeStatus, setAnalyzeStatus] = useState("idle"); // idle | loading | success | error
    const [analyzeCount, setAnalyzeCount] = useState(0);
    const [exportInfo, setExportInfo] = useState(null);
    const analyzingRef = useRef(false);
    const reviewRef = useRef(null);

    const selectedCount = useMemo(() => selectedTestCaseIds.length, [selectedTestCaseIds]);
    const moduleName = useMemo(() => testCases.find(tc => tc.module && String(tc.module).trim())?.module ?? "", [testCases]);
    const bothUploaded = Boolean(sourceFileName && codeGenFile?.content);

    // Giải quyết BASE_URL theo thứ tự nguồn: user edit > CodeGen > .env fallback.
    const baseUrlResolved = useMemo(
        () => resolveBaseUrl({ edited: baseUrlEdited, detected: codeGenBaseUrls, envFallback }),
        [baseUrlEdited, codeGenBaseUrls, envFallback]
    );
    const baseUrl = baseUrlResolved.baseUrl;
    const baseUrlSource = sourceLabel(baseUrlResolved.source);
    // environmentValid chỉ true khi có URL hợp lệ thật (không dựa vào nhãn UAT/TEST/DEV).
    const environmentValid = Boolean(baseUrl) && isValidUrl(baseUrl);

    // Lấy BASE_URL fallback từ server (.env) qua /health khi mở trang.
    useEffect(() => {
        let alive = true;
        fetchServerConfig().then(cfg => { if (alive) setEnvFallback(cfg.baseUrl || ""); }).catch(() => {});
        return () => { alive = false; };
    }, []);

    // Nạp BASE_URL đã lưu theo workspace (module) khi có module.
    useEffect(() => {
        if (!moduleName) return;
        try {
            const saved = localStorage.getItem(workspaceKey(moduleName));
            if (saved) setBaseUrlEdited(saved);
        } catch { /* localStorage có thể bị chặn */ }
    }, [moduleName]);

    const handleBaseUrlChange = url => {
        setBaseUrlEdited(url || "");
        if (moduleName) {
            try { localStorage.setItem(workspaceKey(moduleName), url || ""); } catch { /* ignore */ }
        }
    };

    const handleApprovedTestCases = (items, fileName) => {
        setTestCases(items.map(normalizeTestCase));
        setSelectedTestCaseIds([]);
        setActiveTestCaseId(null);
        setSourceFileName(fileName);
        setAnalyzeStatus("idle");
        setExportInfo(null);
        setNotice("");
    };
    const handleCodeGenFile = file => {
        setCodeGenFile(file);
        // Tự nhận diện Base URL từ page.goto(...) trong CodeGen.
        setCodeGenBaseUrls(extractBaseUrls(file?.content));
        setNotice("");
    };
    const handleCodeGenStats = stats => {
        setCodeGenStats(stats);
        setNotice("");
    };

    const handleToggle = id => setSelectedTestCaseIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
    const handleSelectAll = (ids, allSelected) => setSelectedTestCaseIds(current => allSelected ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]);
    const handleOpenDetail = id => { setActiveTestCaseId(id); setActiveTab("REVIEW"); };
    const handleOpenData = id => {
        setSelectedTestCaseIds(ids => ids.includes(id) ? ids : [...ids, id]);
        setActiveTestCaseId(id);
        setActiveTab("DATA");
    };
    const handleClose = () => setActiveTestCaseId(null);

    const activeTestCase = testCases.find(item => item.id === activeTestCaseId) || null;

    const updateTestCase = (id, patch) => setTestCases(current => current.map(item => {
        if (item.id !== id) return item;
        const changedKeys = Object.keys(patch);
        const contentChanged = changedKeys.some(key => ["title", "objective", "description", "module", "function", "testData", "mapping", "mappingStatus"].includes(key));
        return { ...item, ...patch, status: contentChanged ? (item.generatedCode ? "REGENERATE_REQUIRED" : "EDITED") : patch.status || item.status };
    }));
    const restoreTestCase = id => setTestCases(current => current.map(item => item.id === id ? { ...item, includedInSession: true, status: item.generatedCode ? "GENERATED" : "EDITED" } : item));

    const analyzeRequest = async () => {
        if (analyzingRef.current) { console.warn("[ANALYZE] bỏ qua lần bấm trùng"); return; }
        const items = testCases.filter(item => item.includedInSession);
        if (!codeGenFile?.content || !items.length) return;
        analyzingRef.current = true;
        setBusy(true);
        setAnalyzeStatus("loading");
        setNotice("");
        try {
            const result = await analyzeAutomation({ module: moduleName, testCases: items, codegenText: codeGenFile.content });
            const mappings = Array.isArray(result?.testCaseMappings) ? result.testCaseMappings : Array.isArray(result?.mappings) ? result.mappings : [];
            setTestCases(current => current.map(item => {
                const mapping = mappings.find(value => String(value.testCaseId || value.id) === item.id);
                return mapping ? { ...item, mapping: mapping.mapping || mapping, status: item.status === "READY" ? "READY" : item.status } : item;
            }));
            setAnalyzeStatus("success");
            setAnalyzeCount(mappings.length);
            setNotice(`AI đã đối chiếu ${mappings.length} testcase với CodeGen. Hãy review mapping ở bước ③.`);
            requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        } catch (error) {
            setAnalyzeStatus("error");
            setNotice(`AI Mapping thất bại: ${error.message || "Không thể đối chiếu dữ liệu."}`);
        } finally {
            analyzingRef.current = false;
            setBusy(false);
        }
    };

    // Ghi kết quả Generate vào testcase: giữ nguyên filePath backend trả về (không lấy basename, không tự ghép).
    const applyGenerate = (id, result) => setTestCases(current => current.map(item => item.id === id
        ? {
            ...item,
            generatedCode: result?.code || "",
            generatedFile: result?.filePath || "",
            generatedFileExists: result?.exists === true,
            validation: result?.validation,
            status: result?.filePath ? "GENERATED" : "REGENERATE_REQUIRED"
        }
        : item));

    const generateRequest = async ids => {
        const items = testCases.filter(item => ids.includes(item.id) && item.includedInSession && item.mapping && Object.keys(item.mapping).length > 0);
        if (!items.length) { setNotice("Chưa có mapping để sinh automation. Hãy chạy 'AI Mapping' trước."); return; }
        if (!codeGenFile?.content) return;
        setBusy(true);
        setNotice("");
        try {
            for (const item of items) {
                const result = await generateAutomation({ testCase: item, mapping: item.mapping, codegenText: codeGenFile.content, baseUrl });
                applyGenerate(item.id, result);
            }
            setNotice(`Đã sinh automation cho ${items.length} testcase. Chuyển sang bước ⑤ để chạy.`);
        } catch (error) {
            setNotice(error.message || "Sinh mã kiểm thử không thành công.");
        } finally {
            setBusy(false);
        }
    };

    // Sinh automation cho MỘT testcase ngay trong Drawer (không phụ thuộc checkbox ngoài danh sách).
    const generateOne = async id => {
        const item = testCases.find(t => t.id === id);
        if (!item) return null;
        if (!item.mapping || !Object.keys(item.mapping).length) { setNotice("Testcase này chưa có mapping — hãy chạy AI Mapping."); return null; }
        if (!codeGenFile?.content) { setNotice("Chưa có CodeGen để sinh automation."); return null; }
        setBusy(true);
        setNotice("");
        try {
            const result = await generateAutomation({ testCase: item, mapping: item.mapping, codegenText: codeGenFile.content, baseUrl });
            applyGenerate(id, result);
            if (result?.filePath) setNotice(`✓ Đã sinh ${result.filePath}`);
            return result;
        } catch (error) {
            setNotice(error.message || "Sinh mã kiểm thử không thành công.");
            return null;
        } finally {
            setBusy(false);
        }
    };

    // Áp dụng kết quả Run vào testcase + cập nhật generatedFileExists (SPEC_NOT_FOUND -> file mất).
    const applyRun = (id, result) => setTestCases(current => current.map(item => item.id === id
        ? {
            ...item,
            execution: result,
            status: result?.passed === true || result?.status === "PASSED" ? "PASSED" : "FAILED",
            generatedFileExists: item.generatedFileExists && result?.fileExists !== false
        }
        : item));

    const runRequest = async ids => {
        const items = testCases.filter(item => ids.includes(item.id) && item.includedInSession && item.generatedFile && isReady(item) && environmentValid);
        if (!items.length) {
            if (!environmentValid) { setNotice("Chưa có Base URL hợp lệ — hãy chọn/nhập ở bước ① trước khi Run."); return; }
            setNotice("Không có testcase nào sẵn dữ liệu và đã sinh mã để chạy."); return;
        }
        setBusy(true);
        setNotice("");
        try {
            for (const item of items) {
                // Xóa diagnostic cũ trước mỗi lần chạy mới.
                setTestCases(current => current.map(t => t.id === item.id ? { ...t, execution: { ...emptyExecution(), status: "RUNNING" } } : t));
                const result = await runAutomation({ filePath: item.generatedFile, env: { BASE_URL: baseUrl }, testCaseId: item.id });
                applyRun(item.id, result);
            }
        } catch (error) {
            setNotice(`Chạy testcase thất bại: ${error.message || ""}`);
        } finally {
            setBusy(false);
        }
    };

    // Chạy 1 testcase ngay trong Drawer (tab Chạy thử / nút Chạy trong Drawer).
    const runOne = async id => {
        const item = testCases.find(t => t.id === id);
        if (!item?.generatedFile) { setNotice("Testcase này chưa sinh mã — hãy sinh automation."); return; }
        if (!isReady(item)) { setNotice("Testcase này còn thiếu dữ liệu — hãy bổ sung ở tab 'Dữ liệu kiểm thử'."); return; }
        if (!environmentValid) { setNotice("Chưa có Base URL hợp lệ — hãy chọn/nhập ở bước ① trước khi Run."); return; }
        // Xóa diagnostic cũ (failedStep/failedLocator/expected/received/output/artefact) trước lần chạy mới.
        setTestCases(current => current.map(t => t.id === id ? { ...t, execution: { ...emptyExecution(), status: "RUNNING" }, status: "RUNNING" } : t));
        setBusy(true);
        setNotice("");
        try {
            const result = await runAutomation({ filePath: item.generatedFile, env: { BASE_URL: baseUrl }, testCaseId: id });
            applyRun(id, result);
            return result;
        } catch (error) {
            setNotice(`Chạy thất bại: ${error.message || ""}`);
            return null;
        } finally {
            setBusy(false);
        }
    };

    const exportRequest = async ids => {
        const items = testCases.filter(item => ids.includes(item.id) && item.includedInSession);
        if (!items.length) { setNotice("Hãy chọn ít nhất một testcase để xuất."); return; }
        setBusy(true);
        setNotice("");
        try {
            const result = await exportAutomation({ module: moduleName, testCases: items });
            setExportInfo(result);
            setNotice(`Đã xuất ${result?.count ?? items.length} testcase vào ${result?.filePath ?? "selected-testcases.json"}.`);
        } catch (error) {
            setNotice(`Xuất thất bại: ${error.message || "Không thể xuất testcase."}`);
        } finally {
            setBusy(false);
        }
    };

    const generateableCount = testCases.filter(item => selectedTestCaseIds.includes(item.id) && item.includedInSession && item.mapping && Object.keys(item.mapping).length > 0).length;
    // Step ⑤ chỉ enable khi có mapping + spec + đủ dữ liệu + môi trường hợp lệ.
    const runnableCount = testCases.filter(item => selectedTestCaseIds.includes(item.id) && item.includedInSession && item.mapping && Object.keys(item.mapping).length > 0 && item.generatedFile && isReady(item) && environmentValid).length;

    return <section className="page automation-page">
        <Link className="back-link" to="/">← Về Dashboard</Link>
        <header className="automation-page__heading">
            <div><p className="workflow-id">AUTOMATION INTELLIGENCE</p><h2>Automation Workspace</h2><p>Upload testcase + CodeGen, AI đối chiếu, bạn review và quyết định cuối cùng.</p></div>
        </header>

        {/* Stepper 6 bước định hướng */}
        <div className="automation-stepper">
            {STEPS.map(([label, sub], i) => (
                <div className={`automation-stepper__item ${i === 0 ? "automation-stepper__item--active" : ""}`} key={label}>
                    <span className="automation-stepper__label">{label}</span>
                    <span className="automation-stepper__sub">{sub}</span>
                </div>
            ))}
        </div>
        {notice && <div className="automation-notice" role="status">{notice}</div>}
        {busy && <div className="automation-notice" role="status">Đang xử lý…</div>}

        {/* ① Upload */}
        <div className="automation-step">
            <div className="automation-step__num">①</div>
            <div className="automation-step__body">
                <h3>Upload dữ liệu</h3>
                <p>Đưa approved-testcases.json và CodeGen.js vào. Hệ thống chỉ đọc — chưa sinh gì.</p>
                <AutomationHeader
                    sourceFileName={sourceFileName}
                    codeGenFile={codeGenFile}
                    moduleName={moduleName}
                    functionName={testCases.find(tc => (tc.feature || tc.function))?.feature || ""}
                    baseUrl={baseUrl}
                    baseUrlSource={baseUrlSource}
                    baseUrlMultiple={baseUrlResolved.multiple}
                    baseUrlOptions={baseUrlResolved.options}
                    environmentValid={environmentValid}
                    onApprovedTestCases={handleApprovedTestCases}
                    onCodeGenFile={handleCodeGenFile}
                    onCodeGenStats={handleCodeGenStats}
                    onBaseUrlChange={handleBaseUrlChange}
                />
                {bothUploaded && (
                    <div className="automation-upload-success">
                        <p><strong>Đã sẵn sàng phân tích.</strong></p>
                        <span>✓ Đọc testcase thành công ({testCases.length} testcase)</span>
                        {moduleName && <span>✓ Module: {moduleName}</span>}
                        <span>✓ Đọc CodeGen thành công ({codeGenStats.locators} locator · {codeGenStats.actions} action · {codeGenStats.pageCount} page)</span>
                    </div>
                )}
            </div>
        </div>

        {/* ② AI Mapping */}
        <div className="automation-step">
            <div className="automation-step__num">②</div>
            <div className="automation-step__body">
                <h3>AI Mapping</h3>
                <p>AI đối chiếu từng testcase với CodeGen: locator, action, assertion cho mỗi testcase.</p>
                {analyzeStatus === "loading" ? (
                    <div className="automation-analyze-loading" role="status">
                        <span className="automation-spinner" aria-hidden="true"></span>
                        <span>AI đang đối chiếu {testCases.filter(tc => tc.includedInSession).length} testcase với CodeGen…</span>
                    </div>
                ) : (
                    <button className="button button--primary" type="button" disabled={!bothUploaded || busy} onClick={analyzeRequest}>
                        {busy ? "Đang phân tích…" : "Chạy AI Mapping"}
                    </button>
                )}
                {analyzeStatus === "success" && <div className="automation-analyze-success">✓ Đã đối chiếu {analyzeCount} testcase</div>}
                {analyzeStatus === "error" && <div className="automation-analyze-error">✗ AI Mapping thất bại. Vui lòng thử lại.</div>}
            </div>
        </div>

        {/* ③ Review */}
        {testCases.length > 0 && (
            <div className="automation-step" ref={reviewRef}>
                <div className="automation-step__num">③</div>
                <div className="automation-step__body">
                    <h3>Review mapping</h3>
                    <p>Chọn testcase cần xử lý. Bấm "Xem chi tiết AI" để kiểm tra mapping, bổ sung dữ liệu nếu cần.</p>
                    <AutomationTestCaseList
                        testCases={testCases}
                        searchQuery={searchQuery}
                        statusFilter={statusFilter}
                        selectedIds={selectedTestCaseIds}
                        activeId={activeTestCaseId}
                        analyzed={analyzeStatus === "success"}
                        onSearch={setSearchQuery}
                        onFilter={setStatusFilter}
                        onSelectAll={handleSelectAll}
                        onToggle={handleToggle}
                        onOpen={handleOpenDetail}
                        onOpenData={handleOpenData}
                    />
                </div>
            </div>
        )}

        {/* ④ Generate */}
        {testCases.length > 0 && (
            <div className="automation-step">
                <div className="automation-step__num">④</div>
                <div className="automation-step__body">
                    <h3>Sinh automation</h3>
                    <p>Tạo file Playwright cho testcase đã chọn (cần đã có mapping từ bước ②).</p>
                    <div className="automation-step__tools">
                        <button className="button button--secondary" type="button" disabled={selectedCount === 0 || generateableCount === 0 || busy} onClick={() => generateRequest([...selectedTestCaseIds])}>
                            Sinh automation đã chọn ({generateableCount})
                        </button>
                        <span className="automation-hint-text">{selectedCount === 0 ? "Chưa chọn testcase nào ở bước ③." : `Đã chọn ${selectedCount} testcase, trong đó ${generateableCount} có mapping.`}</span>
                    </div>
                </div>
            </div>
        )}

        {/* ⑤ Run */}
        {testCases.length > 0 && (
            <div className="automation-step">
                <div className="automation-step__num">⑤</div>
                <div className="automation-step__body">
                    <h3>Chạy kiểm thử</h3>
                    <p>Chạy file đã sinh bằng Playwright. Kết quả PASS / FAIL hiển thị trên card và trong cửa sổ chi tiết.</p>
                    <div className="automation-step__tools">
                        <button className="button button--secondary" type="button" disabled={selectedCount === 0 || runnableCount === 0 || busy} onClick={() => runRequest([...selectedTestCaseIds])}>
                            Chạy testcase đã chọn ({runnableCount})
                        </button>
                        <span className="automation-hint-text">{!environmentValid ? "Chưa có Base URL hợp lệ — chọn/nhập ở bước ① để mở khóa Run." : selectedCount === 0 ? "Chưa chọn testcase nào." : `${runnableCount} testcase có mapping + spec + đủ dữ liệu.`}</span>
                    </div>
                </div>
            </div>
        )}

        {/* ⑥ Export */}
        {testCases.length > 0 && (
            <div className="automation-step">
                <div className="automation-step__num">⑥</div>
                <div className="automation-step__body">
                    <h3>Export testcase</h3>
                    <p>Xuất testcase đã chọn ra selected-testcases.json để dùng lại, chia cho tester khác hoặc chạy CI/CD.</p>
                    <div className="automation-step__tools">
                        <button className="button button--primary" type="button" disabled={selectedCount === 0 || busy} onClick={() => exportRequest([...selectedTestCaseIds])}>
                            Xuất testcase JSON ({selectedCount})
                        </button>
                        {exportInfo && <span className="automation-hint-text">✓ Đã xuất {exportInfo.count} testcase → {exportInfo.filePath}</span>}
                    </div>
                </div>
            </div>
        )}

        {/* Drawer Inspector: overlay, không tự mở; giữ selection/scroll. */}
        {activeTestCase && (
            <>
                <div className="automation-drawer-backdrop" onClick={handleClose}></div>
                <div className="automation-drawer">
                    <AutomationInspector
                        testCase={activeTestCase}
                        moduleName={moduleName}
                        activeTab={activeTab}
                        baseUrl={baseUrl}
                        baseUrlSource={baseUrlSource}
                        environmentValid={environmentValid}
                        onTabChange={setActiveTab}
                        onUpdate={updateTestCase}
                        onRestore={restoreTestCase}
                        onGenerateOne={generateOne}
                        onRunOne={runOne}
                        onClose={handleClose}
                    />
                </div>
            </>
        )}
    </section>;
}
