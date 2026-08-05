import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AutomationHeader from "../components/automation/AutomationHeader.jsx";
import AutomationTestCaseList from "../components/automation/AutomationTestCaseList.jsx";
import AutomationInspector from "../components/automation/AutomationInspector.jsx";
import { analyzeAutomation, generateAutomation, runAutomation } from "../api/automationApi.js";

/*
 Sprint 1 (refine) — Automation Intelligence
 - Giữ nguyên testData object từ approved-testcases.json (Single Source of Truth).
 - Module/Feature/Môi trường tự đọc; không bắt nhập lại.
 - Sửa bug testCaseMappings: UI đọc result.testCaseMappings.
 - executionReadiness: disable Generate/Run khi DATA_REQUIRED.
 - Hiển thị confidence từ AI analysis nếu có.
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

// Testcase sẵn sàng chạy khi executionReadiness = READY (hoặc không xác định -> cho phép).
function isReady(tc) {
    const r = String(tc?.executionReadiness ?? "").toUpperCase();
    if (!r) return true;
    return r === "READY";
}

function confidenceOf(mapping) {
    const steps = Array.isArray(mapping?.stepMappings) ? mapping.stepMappings : [];
    const values = steps.map(s => Number(s?.confidence)).filter(n => Number.isFinite(n));
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg * 100);
}

export default function AutomationWorkspacePage() {
    const [sourceFileName, setSourceFileName] = useState("");
    const [testCases, setTestCases] = useState([]);
    const [selectedTestCaseIds, setSelectedTestCaseIds] = useState([]);
    const [activeTestCaseId, setActiveTestCaseId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [codeGenFile, setCodeGenFile] = useState(null);
    const [activeTab, setActiveTab] = useState("INFO");
    const [environment, setEnvironment] = useState(import.meta.env.VITE_ENV || "");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [analysisSummary, setAnalysisSummary] = useState(null); // {total, ready, dataRequired}

    const selectedCount = useMemo(() => selectedTestCaseIds.length, [selectedTestCaseIds]);

    const moduleName = useMemo(() => {
        const value = testCases.find(tc => tc.module && String(tc.module).trim())?.module ?? "";
        return String(value ?? "");
    }, [testCases]);
    const functionName = useMemo(() => {
        const value = testCases.find(tc => (tc.feature || tc.function) && String(tc.feature || tc.function).trim())?.feature || testCases.find(tc => tc.function)?.function || "";
        return String(value ?? "");
    }, [testCases]);

    const handleApprovedTestCases = (items, fileName) => {
        const normalized = items.map(normalizeTestCase);
        setTestCases(normalized);
        setSelectedTestCaseIds([]);
        setActiveTestCaseId(normalized[0]?.id || null);
        setSourceFileName(fileName);
        setAnalysisSummary(null);
    };
    const handleToggle = id => setSelectedTestCaseIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
    const handleSelectAll = (ids, allSelected) => setSelectedTestCaseIds(current => allSelected ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]);
    const updateEnvironment = value => setEnvironment(value);
    const selectedTestCases = ids => testCases.filter(item => ids.includes(item.id) && item.includedInSession);
    const activeTestCase = testCases.find(item => item.id === activeTestCaseId) || null;
    const updateTestCase = (id, patch) => setTestCases(current => current.map(item => {
        if (item.id !== id) return item;
        const changedKeys = Object.keys(patch);
        const contentChanged = changedKeys.some(key => ["title", "objective", "description", "module", "function", "testData", "mapping", "mappingStatus"].includes(key));
        return { ...item, ...patch, status: contentChanged ? (item.generatedCode ? "REGENERATE_REQUIRED" : "EDITED") : patch.status || item.status };
    }));
    const removeTestCase = id => { setTestCases(current => current.map(item => item.id === id ? { ...item, includedInSession: false, status: "REMOVED" } : item)); setSelectedTestCaseIds(current => current.filter(item => item !== id)); };
    const runRequest = async ids => {
        const items = selectedTestCases(ids).filter(isReady);
        for (const item of items) { if (!item.generatedFile) continue; const result = await runAutomation({ filePath: item.generatedFile, env: { BASE_URL: environment } }); setTestCases(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, execution: result, status: result?.status === "PASSED" ? "PASSED" : "FAILED" } : currentItem)); }
    };
    const generateRequest = async ids => {
        const items = selectedTestCases(ids).filter(isReady);
        if (!codeGenFile?.content) return; setBusy(true); setNotice("");
        try { for (const item of items) { const result = await generateAutomation({ testCase: item, mapping: item.mapping, codegenText: codeGenFile.content }); setTestCases(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, generatedCode: result?.code || "", generatedFile: result?.filePath || "", validation: result?.validation, status: result?.filePath ? "GENERATED" : "REGENERATE_REQUIRED" } : currentItem)); } } catch (error) { setNotice(error.message || "Sinh mã kiểm thử không thành công."); } finally { setBusy(false); }
    };
    const analyzeRequest = async () => {
        const items = testCases.filter(item => item.includedInSession);
        if (!codeGenFile?.content || !items.length) return;
        setBusy(true); setNotice("");
        try {
            const result = await analyzeAutomation({ module: moduleName, testCases: items, codegenText: codeGenFile.content });
            const mappings = Array.isArray(result?.testCaseMappings) ? result.testCaseMappings : Array.isArray(result?.mappings) ? result.mappings : [];
            setTestCases(current => current.map(item => {
                const mapping = mappings.find(value => String(value.testCaseId || value.id) === item.id);
                return mapping ? { ...item, mapping: mapping.mapping || mapping, status: item.status === "READY" ? "READY" : item.status } : item;
            }));
            const ready = items.filter(isReady).length;
            setAnalysisSummary({ total: items.length, ready, dataRequired: items.length - ready });
            setNotice(`Phân tích bằng AI đã hoàn tất (${mappings.length} testcase).`);
        } catch (error) { setNotice(error.message || "Không thể phân tích dữ liệu bằng AI."); } finally { setBusy(false); }
    };
    const restoreTestCase = id => setTestCases(current => current.map(item => item.id === id ? { ...item, includedInSession: true, status: item.generatedCode ? "GENERATED" : "EDITED" } : item));

    return <section className="page automation-page">
        <Link className="back-link" to="/">← Về Dashboard</Link>
        <header className="automation-page__heading"><div><p className="workflow-id">AUTOMATION INTELLIGENCE</p><h2>Automation Workspace</h2><p>Phân tích, sinh mã và thực thi testcase.</p></div><span className="status-badge status-badge--neutral">{selectedCount} testcase được chọn</span></header>
        {notice && <div className="automation-notice" role="status">{notice}</div>}
        {busy && <div className="automation-notice" role="status">Đang xử lý...</div>}
        {analysisSummary && analysisSummary.dataRequired > 0 && (
            <div className="automation-notice automation-notice--warn" role="status">
                {analysisSummary.dataRequired} testcase cần bổ sung dữ liệu (đã tạm ẩn khỏi Sinh mã / Thực thi). Hãy mở từng testcase để thêm dữ liệu còn thiếu.
            </div>
        )}
        <AutomationHeader sourceFileName={sourceFileName} codeGenFile={codeGenFile} moduleName={moduleName} functionName={functionName} environment={environment} onApprovedTestCases={handleApprovedTestCases} onCodeGenFile={setCodeGenFile} onAnalyze={analyzeRequest} onEnvironmentChange={updateEnvironment} />
        <div className="automation-main-grid"><AutomationTestCaseList testCases={testCases} searchQuery={searchQuery} statusFilter={statusFilter} selectedIds={selectedTestCaseIds} activeId={activeTestCaseId} isReady={isReady} confidenceOf={confidenceOf} onSearch={setSearchQuery} onFilter={setStatusFilter} onSelectAll={handleSelectAll} onToggle={handleToggle} onOpen={setActiveTestCaseId} onGenerate={generateRequest} onRun={runRequest} /><AutomationInspector testCase={activeTestCase} moduleName={moduleName} functionName={functionName} activeTab={activeTab} isReady={isReady} onTabChange={setActiveTab} onUpdate={updateTestCase} onRemove={removeTestCase} onRestore={restoreTestCase} /></div>
    </section>;
}
