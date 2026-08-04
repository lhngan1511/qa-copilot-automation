import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AutomationHeader from "../components/automation/AutomationHeader.jsx";
import AutomationTestCaseList from "../components/automation/AutomationTestCaseList.jsx";
import AutomationInspector from "../components/automation/AutomationInspector.jsx";
import { analyzeAutomation, generateAutomation, runAutomation } from "../api/automationApi.js";

const STORAGE_KEY = "qa-copilot-automation-codegen-library";

function normalizeTestCase(item, index) {
    return {
        ...item,
        id: String(item.id),
        title: item.title || item.name || `Testcase ${index + 1}`,
        status: "READY",
        includedInSession: true,
        testData: Array.isArray(item.testData) ? item.testData : [],
        generatedCode: item.generatedCode || "",
        execution: { status: "NOT_RUN", durationMs: null, errorMessage: "", technicalLog: "" }
    };
}

function loadCodeGen() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

export default function AutomationWorkspacePage() {
    const [sourceFileName, setSourceFileName] = useState("");
    const [testCases, setTestCases] = useState([]);
    const [selectedTestCaseIds, setSelectedTestCaseIds] = useState([]);
    const [activeTestCaseId, setActiveTestCaseId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [codeGenFile, setCodeGenFile] = useState(null);
    const [codeGenRecords, setCodeGenRecords] = useState(loadCodeGen);
    const [selectedCodeGenId, setSelectedCodeGenId] = useState("");
    const [activeTab, setActiveTab] = useState("INFO");
    const [context, setContext] = useState({ moduleName: "", functionName: "", environment: "" });
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    const selectedCount = useMemo(() => selectedTestCaseIds.length, [selectedTestCaseIds]);
    const handleApprovedTestCases = (items, fileName) => {
        const normalized = items.map(normalizeTestCase);
        setTestCases(normalized);
        setSelectedTestCaseIds([]);
        setActiveTestCaseId(normalized[0]?.id || null);
        setSourceFileName(fileName);
    };
    const handleToggle = id => setSelectedTestCaseIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
    const handleSelectAll = (ids, allSelected) => setSelectedTestCaseIds(current => allSelected ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]);
    const handleSaveCodeGen = record => {
        const saved = { ...record, id: `${Date.now()}-${record.name}` };
        const next = [...codeGenRecords, saved];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setCodeGenRecords(next);
        setSelectedCodeGenId(saved.id);
    };
    const updateContext = (key, value) => setContext(current => ({ ...current, [key]: value }));
    const selectedTestCases = ids => testCases.filter(item => ids.includes(item.id) && item.includedInSession);
    const activeTestCase = testCases.find(item => item.id === activeTestCaseId) || null;
    const updateTestCase = (id, patch) => setTestCases(current => current.map(item => {
        if (item.id !== id) return item;
        const changedKeys = Object.keys(patch);
        const contentChanged = changedKeys.some(key => ["title", "objective", "description", "module", "function", "testData", "mapping", "mappingStatus"].includes(key));
        return { ...item, ...patch, status: contentChanged ? (item.generatedCode ? "REGENERATE_REQUIRED" : "EDITED") : patch.status || item.status };
    }));
    const removeTestCase = id => { setTestCases(current => current.map(item => item.id === id ? { ...item, includedInSession: false, status: "REMOVED" } : item)); setSelectedTestCaseIds(current => current.filter(item => item !== id)); };
    const selectCodeGen = id => { setSelectedCodeGenId(id); const record = codeGenRecords.find(item => item.id === id); if (record) setCodeGenFile({ fileName: record.fileName, content: record.content }); };
    const runRequest = async ids => {
        const items = selectedTestCases(ids);
        for (const item of items) { if (!item.generatedFile) continue; const result = await runAutomation({ filePath: item.generatedFile, env: { BASE_URL: context.environment } }); setTestCases(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, execution: result, status: result?.status === "PASSED" ? "PASSED" : "FAILED" } : currentItem)); }
    };
    const generateRequest = async ids => {
        const items = selectedTestCases(ids); if (!codeGenFile?.content) return; setBusy(true); setNotice("");
        try { for (const item of items) { const result = await generateAutomation({ testCase: item, mapping: item.mapping, codegenText: codeGenFile.content }); setTestCases(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, generatedCode: result?.code || "", generatedFile: result?.filePath || "", validation: result?.validation, status: result?.filePath ? "GENERATED" : "REGENERATE_REQUIRED" } : currentItem)); } } catch (error) { setNotice(error.message || "Sinh mã kiểm thử không thành công."); } finally { setBusy(false); }
    };
    const analyzeRequest = async () => { const items = testCases.filter(item => item.includedInSession); if (!codeGenFile?.content || !items.length) return; setBusy(true); setNotice(""); try { const result = await analyzeAutomation({ module: context.moduleName, testCases: items, codegenText: codeGenFile.content }); const mappings = Array.isArray(result?.mappings) ? result.mappings : Array.isArray(result) ? result : []; setTestCases(current => current.map(item => { const mapping = mappings.find(value => String(value.testCaseId || value.id) === item.id); return mapping ? { ...item, mapping: mapping.mapping || mapping, status: item.status === "READY" ? "READY" : item.status } : item; })); setNotice("Phân tích bằng AI đã hoàn tất."); } catch (error) { setNotice(error.message || "Không thể phân tích dữ liệu bằng AI."); } finally { setBusy(false); } };
    const restoreTestCase = id => setTestCases(current => current.map(item => item.id === id ? { ...item, includedInSession: true, status: item.generatedCode ? "GENERATED" : "EDITED" } : item));

    return <section className="page automation-page">
        <Link className="back-link" to="/">← Về Dashboard</Link>
        <header className="automation-page__heading"><div><p className="workflow-id">AUTOMATION INTELLIGENCE</p><h2>Automation Workspace</h2><p>Phân tích, sinh mã và thực thi testcase trong một workspace liên tục.</p></div><span className="status-badge status-badge--neutral">{selectedCount} testcase được chọn</span></header>
        {notice && <div className="automation-notice" role="status">{notice}</div>}
        {busy && <div className="automation-notice" role="status">Đang xử lý...</div>}
        <AutomationHeader sourceFileName={sourceFileName} codeGenFile={codeGenFile} codeGenRecords={codeGenRecords} selectedCodeGenId={selectedCodeGenId} {...context} onApprovedTestCases={handleApprovedTestCases} onCodeGenFile={setCodeGenFile} onSaveCodeGen={handleSaveCodeGen} onSelectCodeGen={selectCodeGen} onAnalyze={analyzeRequest} onContextChange={updateContext} />
        <div className="automation-main-grid"><AutomationTestCaseList testCases={testCases} searchQuery={searchQuery} statusFilter={statusFilter} selectedIds={selectedTestCaseIds} activeId={activeTestCaseId} onSearch={setSearchQuery} onFilter={setStatusFilter} onSelectAll={handleSelectAll} onToggle={handleToggle} onOpen={setActiveTestCaseId} onGenerate={generateRequest} onRun={runRequest} /><AutomationInspector testCase={activeTestCase} context={context} activeTab={activeTab} onTabChange={setActiveTab} onUpdate={updateTestCase} onRemove={removeTestCase} onRestore={restoreTestCase} /></div>
    </section>;
}
