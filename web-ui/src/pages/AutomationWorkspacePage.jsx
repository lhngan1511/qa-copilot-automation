import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AutomationHeader from "../components/automation/AutomationHeader.jsx";
import AutomationTestCaseList from "../components/automation/AutomationTestCaseList.jsx";
import AutomationInspector from "../components/automation/AutomationInspector.jsx";
import { analyzeAutomation, generateAutomation, runAutomation } from "../api/automationApi.js";

/*
 Sprint 1 (polish) — Automation Intelligence là "màn hình xử lý", không phải form.
 Flow:  Upload 2 file → AI phân tích → Review → Generate → Run.
 - Upload là bước đầu, hiển thị tóm tắt thành công (✓ testcase, ✓ Module, ✓ Feature).
 - AI Analysis là trung tâm.
 - Review mapping dùng ngôn ngữ Tester (Chuẩn bị / Thao tác chính / Kết quả / Độ tin cậy).
 - Chọn testcase MỘT LẦN, có Generate Selected / Run Selected.
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

// Sẵn sàng khi: có fields và mọi field đã có giá trị (hoặc purpose EMPTY), HOẶC
// executionReadiness = READY. Nếu có fields mà còn field trống -> DATA_REQUIRED.
function isReady(tc) {
    const fields = tc?.testData?.fields;
    if (fields && typeof fields === "object" && !Array.isArray(fields)) {
        const entries = Object.entries(fields);
        if (entries.length > 0) {
            return entries.every(([, f]) => {
                if (!f || typeof f !== "object") return true;
                if (f.requiresTesterInput === true) return false;
                if (String(f.purpose ?? "").toUpperCase() === "EMPTY") return true;
                return String(f.value ?? "").trim() !== "";
            });
        }
    }
    const r = String(tc?.executionReadiness ?? "").toUpperCase();
    if (!r) return true;
    return r === "READY";
}

// Chuẩn hóa confidence một lần: <=1 => *100; >1 => giữ nguyên; clamp 0..100.
function normalizeConfidence(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    let pct = n <= 1 ? n * 100 : n;
    pct = Math.min(100, Math.max(0, pct));
    return Math.round(pct);
}

function confidenceOf(mapping) {
    const steps = Array.isArray(mapping?.stepMappings) ? mapping.stepMappings : [];
    const values = steps.map(s => normalizeConfidence(s?.confidence)).filter(n => n != null);
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg);
}

export default function AutomationWorkspacePage() {
    const [sourceFileName, setSourceFileName] = useState("");
    const [testCases, setTestCases] = useState([]);
    const [selectedTestCaseIds, setSelectedTestCaseIds] = useState([]);
    const [activeTestCaseId, setActiveTestCaseId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [codeGenFile, setCodeGenFile] = useState(null);
    const [activeTab, setActiveTab] = useState("REVIEW");
    const [environment, setEnvironment] = useState(import.meta.env.VITE_ENV || "");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [analyzed, setAnalyzed] = useState(false);
    const [analyzeStatus, setAnalyzeStatus] = useState("idle"); // idle | loading | success | error
    const [analyzeCount, setAnalyzeCount] = useState(0); // số testcase đã phân tích
    const analyzingRef = useRef(false); // in-flight guard đồng bộ
    const reviewRef = useRef(null); // cuộn tới bước review khi thành công

    const selectedCount = useMemo(() => selectedTestCaseIds.length, [selectedTestCaseIds]);

    const moduleName = useMemo(() => testCases.find(tc => tc.module && String(tc.module).trim())?.module ?? "", [testCases]);
    const functionName = useMemo(() => testCases.find(tc => (tc.feature || tc.function) && String(tc.feature || tc.function).trim())?.feature || testCases.find(tc => tc.function)?.function || "", [testCases]);

    // Cả 2 file đã tải?
    const bothUploaded = Boolean(sourceFileName && codeGenFile?.content);

    const handleApprovedTestCases = (items, fileName) => {
        const normalized = items.map(normalizeTestCase);
        setTestCases(normalized);
        setSelectedTestCaseIds([]);
        setActiveTestCaseId(normalized[0]?.id || null);
        setSourceFileName(fileName);
        setAnalyzed(false);
        setNotice("");
    };
    const handleToggle = id => setSelectedTestCaseIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
    // Click "Cần bổ sung dữ liệu" -> chọn testcase + mở Inspector + chuyển tab Dữ liệu kiểm thử.
    const handleOpenData = id => {
        setSelectedTestCaseIds(ids => ids.includes(id) ? ids : [...ids, id]);
        setActiveTestCaseId(id);
        setActiveTab("DATA");
    };
    const handleSelectAll = (ids, allSelected) => setSelectedTestCaseIds(current => allSelected ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]);
    const updateEnvironment = value => setEnvironment(value);
    const activeTestCase = testCases.find(item => item.id === activeTestCaseId) || null;
    const updateTestCase = (id, patch) => setTestCases(current => current.map(item => {
        if (item.id !== id) return item;
        const changedKeys = Object.keys(patch);
        const contentChanged = changedKeys.some(key => ["title", "objective", "description", "module", "function", "testData", "mapping", "mappingStatus"].includes(key));
        return { ...item, ...patch, status: contentChanged ? (item.generatedCode ? "REGENERATE_REQUIRED" : "EDITED") : patch.status || item.status };
    }));
    const removeTestCase = id => { setTestCases(current => current.map(item => item.id === id ? { ...item, includedInSession: false, status: "REMOVED" } : item)); setSelectedTestCaseIds(current => current.filter(item => item !== id)); };
    const runRequest = async ids => {
        const items = testCases.filter(item => ids.includes(item.id) && item.includedInSession).filter(isReady);
        for (const item of items) { if (!item.generatedFile) continue; const result = await runAutomation({ filePath: item.generatedFile, env: { BASE_URL: environment } }); setTestCases(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, execution: result, status: result?.status === "PASSED" ? "PASSED" : "FAILED" } : currentItem)); }
    };
    const generateRequest = async ids => {
        const items = testCases.filter(item => ids.includes(item.id) && item.includedInSession).filter(isReady);
        if (!codeGenFile?.content) return; setBusy(true); setNotice("");
        try { for (const item of items) { const result = await generateAutomation({ testCase: item, mapping: item.mapping, codegenText: codeGenFile.content }); setTestCases(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, generatedCode: result?.code || "", generatedFile: result?.filePath || "", validation: result?.validation, status: result?.filePath ? "GENERATED" : "REGENERATE_REQUIRED" } : currentItem)); } } catch (error) { setNotice(error.message || "Sinh mã kiểm thử không thành công."); } finally { setBusy(false); }
    };
    const analyzeRequest = async () => {
        // In-flight guard đồng bộ: một lần bấm = một phiên Analyze; chặn lần bấm thứ hai.
        if (analyzingRef.current) {
            console.warn("[ANALYZE] bỏ qua lần bấm trùng — đang phân tích.");
            return;
        }
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
            setAnalyzed(true);
            setAnalyzeStatus("success");
            setAnalyzeCount(mappings.length);
            setNotice(`Đã phân tích ${mappings.length} testcase. Hãy review rồi Sinh mã.`);
            // Tự cuộn xuống bước review (không tự Generate).
            requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        } catch (error) {
            setAnalyzeStatus("error");
            setAnalyzed(false);
            setNotice(`Phân tích thất bại: ${error.message || "Không thể phân tích dữ liệu bằng AI."}`);
        } finally {
            analyzingRef.current = false;
            setBusy(false);
        }
    };
    const restoreTestCase = id => setTestCases(current => current.map(item => item.id === id ? { ...item, includedInSession: true, status: item.generatedCode ? "GENERATED" : "EDITED" } : item));

    return <section className="page automation-page">
        <Link className="back-link" to="/">← Về Dashboard</Link>
        <header className="automation-page__heading"><div><p className="workflow-id">AUTOMATION INTELLIGENCE</p><h2>Automation Workspace</h2><p>Đưa hai file vào, AI sẽ làm phần còn lại. Bạn chỉ cần review.</p></div></header>
        {notice && <div className="automation-notice" role="status">{notice}</div>}
        {busy && <div className="automation-notice" role="status">Đang xử lý...</div>}

        {/* BƯỚC 1: Upload */}
        <div className="automation-step">
            <div className="automation-step__num">①</div>
            <div className="automation-step__body">
                <h3>Upload hai file</h3>
                <p>approved-testcases.json + CodeGen.js</p>
                <AutomationHeader sourceFileName={sourceFileName} codeGenFile={codeGenFile} moduleName={moduleName} functionName={functionName} environment={environment} onApprovedTestCases={handleApprovedTestCases} onCodeGenFile={setCodeGenFile} onEnvironmentChange={updateEnvironment} />
                {bothUploaded && <div className="automation-upload-success">
                    <p>✓ Đọc thành công</p>
                    <span>✓ {testCases.length} testcase</span>
                    {moduleName && <span>✓ Module: {moduleName}</span>}
                    {functionName && <span>✓ Feature: {functionName}</span>}
                </div>}
            </div>
        </div>

        {/* BƯỚC 2: AI Analysis */}
        <div className="automation-step">
            <div className="automation-step__num">②</div>
            <div className="automation-step__body">
                <h3>AI phân tích</h3>
                <p>AI đọc module, feature, test data và hiểu CodeGen, rồi lập ánh xạ cho từng testcase.</p>
                {analyzeStatus === "loading" ? (
                    <div className="automation-analyze-loading" role="status">
                        <span className="automation-spinner" aria-hidden="true"></span>
                        <span>AI đang phân tích CodeGen và {testCases.filter(tc => tc.includedInSession).length} testcase…</span>
                    </div>
                ) : (
                    <button className="button button--primary" type="button" disabled={!bothUploaded || busy} onClick={analyzeRequest}>
                        {busy ? "Đang phân tích…" : "Phân tích bằng AI"}
                    </button>
                )}
                {analyzeStatus === "success" && <div className="automation-analyze-success">✓ Đã phân tích {analyzeCount} testcase</div>}
                {analyzeStatus === "error" && <div className="automation-analyze-error">✗ Phân tích thất bại. Vui lòng thử lại.</div>}
            </div>
        </div>

        {/* BƯỚC 3+4+5: Chọn testcase + Review + Generate + Run */}
        {testCases.length > 0 && (
            <div className="automation-step" ref={reviewRef}>
                <div className="automation-step__num">③</div>
                <div className="automation-step__body">
                    <div className="automation-step__head">
                        <h3>Chọn testcase, review và sinh automation</h3>
                    </div>
                    <AutomationTestCaseList testCases={testCases} searchQuery={searchQuery} statusFilter={statusFilter} selectedIds={selectedTestCaseIds} activeId={activeTestCaseId} isReady={isReady} confidenceOf={confidenceOf} onSearch={setSearchQuery} onFilter={setStatusFilter} onSelectAll={handleSelectAll} onToggle={handleToggle} onOpen={setActiveTestCaseId} onOpenData={handleOpenData} onGenerate={generateRequest} onRun={runRequest} />
                </div>
            </div>
        )}

        {/* Drawer Inspector: mở bên phải, không inline; danh sách giữ nguyên */}
        {activeTestCase && (
            <div className="automation-drawer">
                <AutomationInspector testCase={activeTestCase} moduleName={moduleName} functionName={functionName} activeTab={activeTab} isReady={isReady} onTabChange={setActiveTab} onUpdate={updateTestCase} onRemove={removeTestCase} onRestore={restoreTestCase} onClose={() => setActiveTestCaseId(null)} />
            </div>
        )}
    </section>;
}
