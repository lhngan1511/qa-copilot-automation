import { useState } from "react";
import { analyzeMapping, generateCode, runGeneratedFile } from "../api/automationApi.js";

const CONFIRMED_FACTS = [
    {
        factId: "CF-LOGIN-CAPTCHA-001",
        factType: "TEST_DATA_RULE",
        target: "Mã xác nhận",
        value: "ARBITRARY_NON_EMPTY_TEXT",
        sourceType: "TESTER_INPUT",
        status: "CONFIRMED"
    }
];

export default function AIAutomationPage() {
    const [approvedJson, setApprovedJson] = useState("");
    const [codegenText, setCodegenText] = useState("");
    const [testCases, setTestCases] = useState([]);
    const [moduleName, setModuleName] = useState("");
    const [activeTc, setActiveTc] = useState("");

    // module-level mapping: { testCaseMappings: [ {testCaseId, route, stepMappings, assertionMappings, missingData, warnings} ] }
    const [moduleMap, setModuleMap] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [mappingError, setMappingError] = useState("");

    const [code, setCode] = useState("");
    const [validation, setValidation] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState("");
    const [filePath, setFilePath] = useState("");

    // generate-all: map testCaseId -> { filePath, validation, ok }
    const [generatedFiles, setGeneratedFiles] = useState({});
    const [generatingAll, setGeneratingAll] = useState(false);

    const [runResult, setRunResult] = useState(null);
    const [running, setRunning] = useState(false);
    // run-all: map testCaseId -> { status, durationMs, error, diagnostic }
    const [batchRunResults, setBatchRunResults] = useState({});
    const [runningAll, setRunningAll] = useState(false);

    function handleLoadInputs() {
        try {
            const data = JSON.parse(approvedJson);
            const arr = Array.isArray(data)
                ? data
                : Array.isArray(data.testCases)
                  ? data.testCases.map((x) => x.originalTestCase ?? x)
                  : [];
            setTestCases(arr);
            setModuleName(arr[0]?.module ?? "");
            if (arr.length) setActiveTc(arr[0].id ?? "");
            setModuleMap(null);
            setCode("");
            setRunResult(null);
        } catch (e) {
            alert("approved-testcases.json không hợp lệ: " + e.message);
        }
    }

    async function handleAnalyze() {
        if (testCases.length === 0) return;
        setAnalyzing(true);
        setMappingError("");
        try {
            const m = await analyzeMapping({
                testCases,
                module: moduleName,
                codegenText,
                confirmedFacts: CONFIRMED_FACTS
            });
            setModuleMap(m);
            if (m.testCaseMappings?.[0]) setActiveTc(m.testCaseMappings[0].testCaseId);
            setCode("");
            setRunResult(null);
        } catch (e) {
            setMappingError(e.message || "AI Mapping thất bại (kiểm tra log backend / Gemini).");
        } finally {
            setAnalyzing(false);
        }
    }

    // helper cập nhật mapping của 1 testcase
    function updateTc(tcId, patch) {
        setModuleMap((m) => ({
            ...m,
            testCaseMappings: (m?.testCaseMappings ?? []).map((tc) =>
                tc.testCaseId === tcId ? { ...tc, ...patch } : tc
            )
        }));
    }

    function approveRoute(tcId) {
        updateTc(tcId, { route: { ...currentMapping(tcId)?.route, status: "APPROVED" } });
    }

    function approveStep(tcId, order) {
        const mapping = currentMapping(tcId);
        updateTc(tcId, {
            stepMappings: (mapping?.stepMappings ?? []).map((s) =>
                s.stepOrder === order ? { ...s, status: "APPROVED" } : s
            )
        });
    }

    function approveAssertion(tcId, index) {
        const mapping = currentMapping(tcId);
        updateTc(tcId, {
            assertionMappings: (mapping?.assertionMappings ?? []).map((a, i) =>
                i === index ? { ...a, status: "APPROVED" } : a
            )
        });
    }

    function currentMapping(tcId) {
        return moduleMap?.testCaseMappings?.find((tc) => tc.testCaseId === tcId) || null;
    }

    // ---- Shared Setup cấp module (review 1 lần, áp cho mọi testcase) ----

    // cập nhật 1 khối shared trên TẤT CẢ testcase mappings
    function updateAllShared(field, patch) {
        setModuleMap((m) => ({
            ...m,
            testCaseMappings: (m?.testCaseMappings ?? []).map((tc) => {
                const cur = tc[field];
                if (!cur) return tc;
                return { ...tc, [field]: { ...cur, ...patch } };
            })
        }));
    }

    function approveSharedEntryRoute() {
        updateAllShared("entryRoute", { status: "APPROVED" });
    }

    function approveSharedAuthStep(stepOrder) {
        setModuleMap((m) => ({
            ...m,
            testCaseMappings: (m?.testCaseMappings ?? []).map((tc) => ({
                ...tc,
                authenticationSetup: {
                    ...tc.authenticationSetup,
                    steps: (tc.authenticationSetup?.steps ?? []).map((s) =>
                        s.stepOrder === stepOrder ? { ...s, status: "APPROVED" } : s
                    )
                }
            }))
        }));
    }

    function approveSharedAuthAll() {
        setModuleMap((m) => ({
            ...m,
            testCaseMappings: (m?.testCaseMappings ?? []).map((tc) => ({
                ...tc,
                authenticationSetup: {
                    ...tc.authenticationSetup,
                    steps: (tc.authenticationSetup?.steps ?? []).map((s) => ({ ...s, status: "APPROVED" })),
                    status: "APPROVED"
                }
            }))
        }));
    }

    function approveSharedNavStep(stepOrder) {
        setModuleMap((m) => ({
            ...m,
            testCaseMappings: (m?.testCaseMappings ?? []).map((tc) => ({
                ...tc,
                navigationChain: {
                    ...tc.navigationChain,
                    steps: (tc.navigationChain?.steps ?? []).map((s) =>
                        s.stepOrder === stepOrder ? { ...s, status: "APPROVED" } : s
                    )
                }
            }))
        }));
    }

    function approveSharedNavAll() {
        setModuleMap((m) => ({
            ...m,
            testCaseMappings: (m?.testCaseMappings ?? []).map((tc) => ({
                ...tc,
                navigationChain: {
                    ...tc.navigationChain,
                    steps: (tc.navigationChain?.steps ?? []).map((s) => ({ ...s, status: "APPROVED" })),
                    status: "APPROVED"
                }
            }))
        }));
    }

    // kiểm tra shared setup của 1 testcase đã approve đủ chưa
    function sharedReady(tc) {
        const authSteps = tc?.authenticationSetup?.steps ?? [];
        const navSteps = tc?.navigationChain?.steps ?? [];
        return (
            tc?.entryRoute?.status === "APPROVED" &&
            tc?.authenticationSetup?.status === "APPROVED" &&
            authSteps.every((s) => s.status === "APPROVED") &&
            tc?.navigationChain?.status === "APPROVED" &&
            navSteps.every((s) => s.status === "APPROVED")
        );
    }

    // canGenerate cho 1 testcase: shared (entryRoute/auth/nav) + business steps + assertion APPROVED
    const activeMap = currentMapping(activeTc);
    const missingGenerate = [];
    if (activeMap) {
        if (activeMap.entryRoute?.status !== "APPROVED") missingGenerate.push("Entry Route");
        if (activeMap.authenticationSetup?.status !== "APPROVED") missingGenerate.push("Authentication Setup");
        if (activeMap.navigationChain?.status !== "APPROVED") missingGenerate.push("Navigation Chain");
        if (!(activeMap.stepMappings ?? []).every((s) => s.status === "APPROVED")) missingGenerate.push("Business Steps");
        if (!(activeMap.assertionMappings ?? []).every((a) => a.status === "APPROVED")) missingGenerate.push("Assertion");
    }
    const mappingReady = activeMap && missingGenerate.length === 0;

    // kiểm tra 1 testcase đã approve đủ (shared + business + assertion)
    function isTcApproved(tc) {
        return (
            sharedReady(tc) &&
            (tc.stepMappings ?? []).every((s) => s.status === "APPROVED") &&
            (tc.assertionMappings ?? []).every((a) => a.status === "APPROVED")
        );
    }

    // danh sách mapping đã approve đủ
    const approvedMappings = (moduleMap?.testCaseMappings ?? []).filter((tc) => isTcApproved(tc));

    // tất cả testcase đã approved
    const allApproved =
        moduleMap?.testCaseMappings?.length > 0 &&
        moduleMap.testCaseMappings.every(isTcApproved);

    async function handleGenerate() {
        if (!activeMap || !mappingReady) return;
        const tc = testCases.find((t) => t.id === activeTc);
        setGenerating(true);
        setGenerateError("");
        try {
            const r = await generateCode({
                testCase: tc,
                mapping: activeMap,
                codegenText,
                confirmedFacts: CONFIRMED_FACTS
            });
            setCode(r.code);
            setValidation(r.validation);
            setFilePath(r.filePath);
            setRunResult(null);
        } catch (e) {
            setGenerateError(e.message || "AI Codegen thất bại (kiểm tra log backend / Gemini).");
        } finally {
            setGenerating(false);
        }
    }

    async function handleGenerateAll() {
        if (approvedMappings.length === 0) return;
        setGeneratingAll(true);
        setGenerateError("");
        const results = {};
        for (const mapping of approvedMappings) {
            const tc = testCases.find((t) => t.id === mapping.testCaseId);
            try {
                const r = await generateCode({
                    testCase: tc,
                    mapping,
                    codegenText,
                    confirmedFacts: CONFIRMED_FACTS
                });
                results[mapping.testCaseId] = {
                    filePath: r.filePath,
                    validation: r.validation,
                    ok: r.validation?.ok ?? false
                };
            } catch (e) {
                results[mapping.testCaseId] = { filePath: null, validation: null, ok: false, error: e.message };
            }
        }
        setGeneratedFiles(results);
        // cập nhật state active nếu chưa có file
        setCode("");
        setRunResult(null);
        setGeneratingAll(false);
    }

    async function handleRun() {
        if (!filePath) return;
        setRunning(true);
        try {
            const r = await runGeneratedFile({ filePath });
            setRunResult(r);
        } catch (e) {
            setRunResult({ status: "ERROR", diagnostic: e.message });
        } finally {
            setRunning(false);
        }
    }

    async function handleRunAll() {
        const targets = Object.entries(generatedFiles).filter(([, v]) => v.filePath && v.ok);
        if (targets.length === 0) return;
        setRunningAll(true);
        const results = {};
        for (const [tcId, v] of targets) {
            try {
                const r = await runGeneratedFile({ filePath: v.filePath });
                results[tcId] = {
                    status: r.status,
                    durationMs: r.durationMs,
                    error: r.error,
                    diagnostic: r.diagnostic
                };
            } catch (e) {
                results[tcId] = { status: "ERROR", error: e.message, diagnostic: e.message };
            }
        }
        setBatchRunResults(results);
        setRunningAll(false);
    }

    return (
        <div style={{ padding: 24, maxWidth: 1150, margin: "0 auto" }}>
            <h2>Automation Intelligence — Đăng nhập (MVP)</h2>

            {/* BƯỚC 1: INPUT */}
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3>Bước 1 — Input (toàn bộ module)</h3>
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontWeight: 600 }}>approved-testcases.json (cả module)</label>
                        <textarea
                            rows={6}
                            style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
                            value={approvedJson}
                            onChange={(e) => setApprovedJson(e.target.value)}
                            placeholder="Paste approved-testcases.json (TC001–TC004)..."
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontWeight: 600 }}>Playwright Codegen (toàn bộ chức năng)</label>
                        <textarea
                            rows={6}
                            style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
                            value={codegenText}
                            onChange={(e) => setCodegenText(e.target.value)}
                            placeholder="Paste codegen .js..."
                        />
                    </div>
                </div>
                <button onClick={handleLoadInputs} style={{ marginTop: 8, padding: "8px 14px" }}>
                    Load Inputs
                </button>
                {testCases.length > 0 && (
                    <div style={{ marginTop: 8, color: "#333" }}>
                        Đã nạp module <strong>{moduleName}</strong>: {testCases.length} testcase (
                        {testCases.map((t) => t.id).join(", ")})
                    </div>
                )}
            </section>

            {/* BƯỚC 2: AI MAPPING toàn bộ module */}
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3>Bước 2 — AI Analyze &amp; Map (toàn bộ module)</h3>
                <button onClick={handleAnalyze} disabled={testCases.length === 0 || analyzing} style={{ padding: "8px 14px" }}>
                    {analyzing ? "Đang phân tích toàn bộ..." : "AI Analyze & Map"}
                </button>
                {mappingError && <div style={{ color: "#b00020", marginTop: 8 }}>{mappingError}</div>}

                {moduleMap?.testCaseMappings && (
                    <div style={{ marginTop: 12 }}>
                        {/* Tabs theo testcase */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                            {moduleMap.testCaseMappings.map((tc) => (
                                <button
                                    key={tc.testCaseId}
                                    onClick={() => {
                                        setActiveTc(tc.testCaseId);
                                        setCode("");
                                        setRunResult(null);
                                    }}
                                    style={{
                                        padding: "6px 12px",
                                        border: "1px solid #ccc",
                                        borderRadius: 6,
                                        background: activeTc === tc.testCaseId ? "#2563eb" : "#fff",
                                        color: activeTc === tc.testCaseId ? "#fff" : "#333",
                                        cursor: "pointer"
                                    }}
                                >
                                    {tc.testCaseId}
                                </button>
                            ))}
                        </div>

                        {/* SHARED SETUP (cấp module — review 1 lần, áp mọi testcase) */}
                        {activeMap && (
                            <div style={{ border: "1px solid #0b7285", borderRadius: 8, padding: 12, marginBottom: 16, background: "#f4fbfc" }}>
                                <h4 style={{ margin: "0 0 8px", color: "#0b7285" }}>Shared Setup (dùng chung toàn module)</h4>

                                {/* Entry Route */}
                                <div style={{ marginBottom: 10 }}>
                                    <strong>Entry Route:</strong>{" "}
                                    <code>{activeMap.entryRoute?.value || "(trống)"}</code>{" "}
                                    <span style={{ color: activeMap.entryRoute?.status === "APPROVED" ? "#1a7f37" : "#b00020" }}>
                                        ({activeMap.entryRoute?.status ?? "BLOCKED"})
                                    </span>{" "}
                                    {activeMap.entryRoute?.status !== "APPROVED" && (
                                        <button onClick={approveSharedEntryRoute}>Approve Entry Route</button>
                                    )}
                                    {activeMap.entryRoute?.sourceReference && (
                                        <div style={{ fontSize: 11, color: "#666" }}>src: {activeMap.entryRoute.sourceReference}</div>
                                    )}
                                </div>

                                {/* Authentication Setup */}
                                <div style={{ marginBottom: 10 }}>
                                    <strong>Authentication Setup:</strong>{" "}
                                    <span style={{ color: activeMap.authenticationSetup?.status === "APPROVED" ? "#1a7f37" : "#b00020" }}>
                                        ({activeMap.authenticationSetup?.status ?? "BLOCKED"})
                                    </span>
                                    {activeMap.authenticationSetup?.steps?.length > 0 && (
                                        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                                            <thead>
                                                <tr style={{ textAlign: "left", borderBottom: "1px solid #bbb" }}>
                                                    <th>Step</th><th>Action</th><th>Target</th><th>Locator</th><th>ValueRef</th><th>Status</th><th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(activeMap.authenticationSetup?.steps ?? []).map((s) => (
                                                    <tr key={s.stepOrder} style={{ borderBottom: "1px solid #eee" }}>
                                                        <td>{s.stepOrder}</td>
                                                        <td>{s.actionType}</td>
                                                        <td>{s.target}</td>
                                                        <td><code style={{ fontSize: 11 }}>{s.locator}</code></td>
                                                        <td><code style={{ fontSize: 11 }}>{s.valueRef || "-"}</code></td>
                                                        <td><span style={{ color: s.status === "APPROVED" ? "#1a7f37" : "#b00020" }}>{s.status}</span></td>
                                                        <td>
                                                            {s.status !== "APPROVED" && (
                                                                <button onClick={() => approveSharedAuthStep(s.stepOrder)}>Approve</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                    {activeMap.authenticationSetup?.status !== "APPROVED" && (
                                        <button onClick={approveSharedAuthAll} style={{ marginTop: 6 }}>
                                            Approve toàn Authentication Setup
                                        </button>
                                    )}
                                </div>

                                {/* Navigation Chain */}
                                <div>
                                    <strong>Navigation Chain:</strong>{" "}
                                    <span style={{ color: activeMap.navigationChain?.status === "APPROVED" ? "#1a7f37" : "#b00020" }}>
                                        ({activeMap.navigationChain?.status ?? "BLOCKED"})
                                    </span>
                                    {activeMap.navigationChain?.steps?.length > 0 && (
                                        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                                            <thead>
                                                <tr style={{ textAlign: "left", borderBottom: "1px solid #bbb" }}>
                                                    <th>Step</th><th>Action</th><th>Target</th><th>Locator</th><th>Status</th><th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(activeMap.navigationChain?.steps ?? []).map((s) => (
                                                    <tr key={s.stepOrder} style={{ borderBottom: "1px solid #eee" }}>
                                                        <td>{s.stepOrder}</td>
                                                        <td>{s.actionType}</td>
                                                        <td>{s.target}</td>
                                                        <td><code style={{ fontSize: 11 }}>{s.locator}</code></td>
                                                        <td><span style={{ color: s.status === "APPROVED" ? "#1a7f37" : "#b00020" }}>{s.status}</span></td>
                                                        <td>
                                                            {s.status !== "APPROVED" && (
                                                                <button onClick={() => approveSharedNavStep(s.stepOrder)}>Approve</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                    {activeMap.navigationChain?.status !== "APPROVED" && (
                                        <button onClick={approveSharedNavAll} style={{ marginTop: 6 }}>
                                            Approve toàn Navigation Chain
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeMap && (
                            <div>
                                <h4 style={{ margin: "4px 0 8px" }}>
                                    {activeMap.testCaseId}{" "}
                                    <span style={{ color: "#666", fontWeight: 400 }}>
                                        {testCases.find((t) => t.id === activeMap.testCaseId)?.title ?? ""}
                                    </span>
                                </h4>

                                {/* Route */}
                                <div style={{ marginBottom: 8 }}>
                                    <strong>Route:</strong> {activeMap.route?.value || "(trống)"} (
                                    <span style={{ color: activeMap.route?.status === "APPROVED" ? "#1a7f37" : "#b00020" }}>
                                        {activeMap.route?.status}
                                    </span>
                                    ){" "}
                                    {activeMap.route?.status !== "APPROVED" && (
                                        <button onClick={() => approveRoute(activeMap.testCaseId)} style={{ marginLeft: 8 }}>
                                            Approve Route
                                        </button>
                                    )}
                                </div>

                                {/* Steps */}
                                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                                    <thead>
                                        <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
                                            <th>Step</th>
                                            <th>Business Step</th>
                                            <th>Action</th>
                                            <th>Locator</th>
                                            <th>Confidence</th>
                                            <th>Status</th>
                                            <th>Approve</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(activeMap.stepMappings ?? []).map((s) => (
                                            <tr key={s.stepOrder} style={{ borderBottom: "1px solid #eee" }}>
                                                <td>{s.stepOrder}</td>
                                                <td>
                                                    <input
                                                        value={s.businessStep}
                                                        onChange={(e) =>
                                                            updateTc(activeMap.testCaseId, {
                                                                stepMappings: (activeMap.stepMappings ?? []).map((x) =>
                                                                    x.stepOrder === s.stepOrder ? { ...x, businessStep: e.target.value } : x
                                                                )
                                                            })
                                                        }
                                                        style={{ width: 150 }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        value={s.actionType}
                                                        onChange={(e) =>
                                                            updateTc(activeMap.testCaseId, {
                                                                stepMappings: (activeMap.stepMappings ?? []).map((x) =>
                                                                    x.stepOrder === s.stepOrder ? { ...x, actionType: e.target.value } : x
                                                                )
                                                            })
                                                        }
                                                        style={{ width: 80 }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        value={s.locator}
                                                        onChange={(e) =>
                                                            updateTc(activeMap.testCaseId, {
                                                                stepMappings: (activeMap.stepMappings ?? []).map((x) =>
                                                                    x.stepOrder === s.stepOrder ? { ...x, locator: e.target.value } : x
                                                                )
                                                            })
                                                        }
                                                        style={{ width: 260, fontFamily: "monospace", fontSize: 11 }}
                                                    />
                                                </td>
                                                <td>{s.confidence}</td>
                                                <td>
                                                    <span style={{ color: s.status === "APPROVED" ? "#1a7f37" : "#b00020" }}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => approveStep(activeMap.testCaseId, s.stepOrder)}
                                                        disabled={s.status === "APPROVED"}
                                                    >
                                                        Approve
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Assertions */}
                                <div style={{ marginTop: 8 }}>
                                    <strong>Assertions:</strong>
                                    {(activeMap.assertionMappings ?? []).map((a, i) => (
                                        <div key={i} style={{ margin: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
                                            <span>
                                                {a.playwrightAssertion || a.businessExpectation}{" "}
                                                <span style={{ color: a.status === "APPROVED" ? "#1a7f37" : "#b00020" }}>
                                                    ({a.status})
                                                </span>
                                            </span>
                                            {a.status !== "APPROVED" && (
                                                <button onClick={() => approveAssertion(activeMap.testCaseId, i)}>
                                                    Approve Assertion
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {activeMap.missingData?.length > 0 && (
                                    <div style={{ marginTop: 8, color: "#8a6d00" }}>
                                        <strong>Missing data:</strong> {activeMap.missingData.join(", ")}
                                    </div>
                                )}
                                {activeMap.warnings?.length > 0 && (
                                    <div style={{ marginTop: 8, color: "#8a6d00" }}>
                                        <strong>Warnings:</strong>
                                        <ul>{activeMap.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* BƯỚC 3: AI GENERATE CODE */}
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3>Bước 3 — AI Generate Code</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                        onClick={handleGenerate}
                        disabled={!mappingReady || generating}
                        title={mappingReady ? "" : "Chỉ bật khi mapping của testcase này đã được tester chấp nhận (route + step + assertion)"}
                        style={{ padding: "8px 14px" }}
                    >
                        {generating ? "Đang sinh code..." : `AI Generate Automation (${activeTc})`}
                    </button>
                    <button
                        onClick={handleGenerateAll}
                        disabled={approvedMappings.length === 0 || generatingAll}
                        title={approvedMappings.length === 0 ? "Cần ít nhất 1 testcase approved đủ route+step+assertion" : `Generate ${approvedMappings.length} testcase đã approve`}
                        style={{ padding: "8px 14px" }}
                    >
                        {generatingAll
                            ? "Đang sinh tất cả..."
                            : `AI Generate All Approved (${approvedMappings.length})`}
                    </button>
                </div>
                {moduleMap && !mappingReady && (
                    <div style={{ color: "#b00020", marginTop: 8 }}>
                        <strong>Chưa sẵn sàng Generate ({activeTc}):</strong> cần Approve:{" "}
                        {missingGenerate.length ? missingGenerate.join(", ") : "(xem chi tiết)"}.
                    </div>
                )}
                {generateError && <div style={{ color: "#b00020", marginTop: 8 }}>{generateError}</div>}
                {validation && (
                    <div style={{ marginTop: 8, color: validation.ok ? "#1a7f37" : "#b00020" }}>
                        Validation: {validation.ok ? "OK" : validation.errors.join(" | ")}
                    </div>
                )}
                {code && (
                    <pre
                        style={{
                            background: "#1e1e1e",
                            color: "#d4d4d4",
                            padding: 12,
                            borderRadius: 6,
                            overflow: "auto",
                            maxHeight: 400,
                            fontSize: 12
                        }}
                    >
                        {code}
                    </pre>
                )}
                {Object.keys(generatedFiles).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <strong>Kết quả Generate All:</strong>
                        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                            <thead>
                                <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
                                    <th>Testcase</th>
                                    <th>File</th>
                                    <th>Validation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(generatedFiles).map(([tcId, v]) => (
                                    <tr key={tcId} style={{ borderBottom: "1px solid #eee" }}>
                                        <td>{tcId}</td>
                                        <td>{v.filePath ? v.filePath : "(lỗi)"}</td>
                                        <td>
                                            {v.ok
                                                ? <span style={{ color: "#1a7f37" }}>OK</span>
                                                : <span style={{ color: "#b00020" }}>{v.validation?.errors?.join(" | ") || v.error || "FAIL"}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {allApproved && !code && Object.keys(generatedFiles).length === 0 && (
                    <div style={{ marginTop: 8, color: "#1a7f37" }}>
                        Tất cả testcase đã Approved. Bạn có thể Generate từng testcase hoặc Generate All Approved.
                    </div>
                )}
            </section>

            {/* BƯỚC 4: RUN */}
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
                <h3>Bước 4 — Run Automation</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                    <button onClick={handleRun} disabled={!filePath || running} style={{ padding: "8px 14px" }}>
                        {running ? "Đang chạy..." : `Run Automation (${activeTc})`}
                    </button>
                    <button
                        onClick={handleRunAll}
                        disabled={runningAll || Object.values(generatedFiles).filter((v) => v.filePath && v.ok).length === 0}
                        style={{ padding: "8px 14px" }}
                    >
                        {runningAll
                            ? "Đang chạy tất cả..."
                            : `Run All Generated (${Object.values(generatedFiles).filter((v) => v.filePath && v.ok).length})`}
                    </button>
                </div>

                {/* Run All kết quả */}
                {Object.keys(batchRunResults).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <strong>Kết quả Run All:</strong>
                        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                            <thead>
                                <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
                                    <th>Testcase</th>
                                    <th>Status</th>
                                    <th>Duration</th>
                                    <th>Error / Diagnostic</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(batchRunResults).map(([tcId, r]) => (
                                    <tr key={tcId} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                                        <td style={{ fontWeight: 600 }}>{tcId}</td>
                                        <td>
                                            <span
                                                style={{
                                                    fontWeight: 700,
                                                    color:
                                                        r.status === "PASSED"
                                                            ? "#1a7f37"
                                                            : r.status === "FAILED" || r.status === "FAILED_APP_UNREACHABLE"
                                                              ? "#b00020"
                                                              : "#8a6d00"
                                                }}
                                            >
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>{r.durationMs != null ? `${r.durationMs} ms` : "-"}</td>
                                        <td>
                                            {r.error && <div style={{ color: "#b00020" }}>{String(r.error).slice(0, 300)}</div>}
                                            {r.diagnostic && <div style={{ color: "#8a6d00" }}>{String(r.diagnostic).slice(0, 300)}</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {runResult && (
                    <div style={{ marginTop: 12 }}>
                        <div>
                            <strong>Status:</strong>{" "}
                            <span
                                style={{
                                    fontWeight: 700,
                                    color:
                                        runResult.status === "PASSED"
                                            ? "#1a7f37"
                                            : runResult.status === "FAILED" ||
                                                runResult.status === "FAILED_APP_UNREACHABLE"
                                              ? "#b00020"
                                              : "#8a6d00"
                                }}
                            >
                                {runResult.status}
                            </span>
                        </div>
                        {runResult.durationMs != null && <div><strong>Duration:</strong> {runResult.durationMs} ms</div>}
                        {runResult.diagnostic && <div style={{ color: "#8a6d00", marginTop: 8 }}>Diagnostic: {runResult.diagnostic}</div>}
                        {runResult.error && <div style={{ color: "#b00020", marginTop: 8 }}>Error: {runResult.error}</div>}
                        {runResult.log && (
                            <pre style={{ background: "#f4f4f4", padding: 10, borderRadius: 6, overflow: "auto", maxHeight: 200, fontSize: 11 }}>
                                {runResult.log}
                            </pre>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
