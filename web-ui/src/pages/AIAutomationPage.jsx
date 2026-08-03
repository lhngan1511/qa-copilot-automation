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
    const [selectedId, setSelectedId] = useState("");
    const [testCases, setTestCases] = useState([]);

    const [mapping, setMapping] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [mappingError, setMappingError] = useState("");

    const [code, setCode] = useState("");
    const [validation, setValidation] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState("");
    const [filePath, setFilePath] = useState("");

    const [runResult, setRunResult] = useState(null);
    const [running, setRunning] = useState(false);

    function handleLoadInputs() {
        try {
            const data = JSON.parse(approvedJson);
            const arr = Array.isArray(data)
                ? data
                : Array.isArray(data.testCases)
                  ? data.testCases.map((x) => x.originalTestCase ?? x)
                  : [];
            setTestCases(arr);
            if (arr.length) setSelectedId(arr[0].id ?? "");
            setMapping(null);
            setCode("");
            setRunResult(null);
        } catch (e) {
            alert("approved-testcases.json không hợp lệ: " + e.message);
        }
    }

    const selectedTC = testCases.find((t) => t.id === selectedId) || null;

    async function handleAnalyze() {
        if (!selectedTC) return;
        setAnalyzing(true);
        setMappingError("");
        try {
            const m = await analyzeMapping({
                testCase: selectedTC,
                codegenText,
                confirmedFacts: CONFIRMED_FACTS
            });
            setMapping(m);
            setCode("");
            setRunResult(null);
        } catch (e) {
            setMappingError(e.message || "AI Mapping thất bại (kiểm tra log backend / Gemini).");
        } finally {
            setAnalyzing(false);
        }
    }

    function updateStep(order, patch) {
        setMapping((m) => ({
            ...m,
            stepMappings: m.stepMappings.map((s) => (s.stepOrder === order ? { ...s, ...patch } : s))
        }));
    }

    function approveStep(order) {
        updateStep(order, { status: "APPROVED" });
    }

    const mappingReady = mapping?.stepMappings?.every((s) => s.status === "APPROVED") && mapping?.route?.status === "APPROVED";

    async function handleGenerate() {
        if (!selectedTC || !mapping) return;
        setGenerating(true);
        setGenerateError("");
        try {
            const r = await generateCode({
                testCase: selectedTC,
                mapping,
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

    return (
        <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
            <h2>Automation AI — TC001 Đăng nhập (MVP)</h2>

            {/* BƯỚC 1: INPUT */}
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3>Bước 1 — Input</h3>
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontWeight: 600 }}>approved-testcases.json</label>
                        <textarea
                            rows={6}
                            style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
                            value={approvedJson}
                            onChange={(e) => setApprovedJson(e.target.value)}
                            placeholder='Paste approved-testcases.json...'
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontWeight: 600 }}>Playwright Codegen</label>
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
                    <div style={{ marginTop: 8 }}>
                        <label style={{ marginRight: 8 }}>Chọn testcase:</label>
                        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                            {testCases.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.id} — {t.title}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </section>

            {/* BƯỚC 2: AI MAPPING */}
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3>Bước 2 — AI Mapping</h3>
                <button onClick={handleAnalyze} disabled={!selectedTC || analyzing} style={{ padding: "8px 14px" }}>
                    {analyzing ? "Đang phân tích..." : "AI Analyze & Map"}
                </button>
                {mappingError && <div style={{ color: "#b00020", marginTop: 8 }}>{mappingError}</div>}

                {mapping && (
                    <div style={{ marginTop: 12 }}>
                        <div>
                            <strong>Route:</strong> {mapping.route?.value} ({mapping.route?.status})
                        </div>
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
                                {mapping.stepMappings?.map((s) => (
                                    <tr key={s.stepOrder} style={{ borderBottom: "1px solid #eee" }}>
                                        <td>{s.stepOrder}</td>
                                        <td>
                                            <input
                                                value={s.businessStep}
                                                onChange={(e) => updateStep(s.stepOrder, { businessStep: e.target.value })}
                                                style={{ width: 140 }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                value={s.actionType}
                                                onChange={(e) => updateStep(s.stepOrder, { actionType: e.target.value })}
                                                style={{ width: 80 }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                value={s.locator}
                                                onChange={(e) => updateStep(s.stepOrder, { locator: e.target.value })}
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
                                            <button onClick={() => approveStep(s.stepOrder)} disabled={s.status === "APPROVED"}>
                                                Approve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ marginTop: 8, color: "#666" }}>
                            <strong>Assertions:</strong>{" "}
                            {mapping.assertionMappings?.map((a, i) => (
                                <span key={i}>
                                    {a.playwrightAssertion}
                                    {i < mapping.assertionMappings.length - 1 ? "; " : ""}
                                </span>
                            ))}
                        </div>
                        {mapping.warnings?.length > 0 && (
                            <div style={{ marginTop: 8, color: "#8a6d00" }}>
                                <strong>Warnings:</strong>
                                <ul>{mapping.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* BƯỚC 3: AI GENERATE CODE */}
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3>Bước 3 — AI Generate Code</h3>
                <button
                    onClick={handleGenerate}
                    disabled={!mappingReady || generating}
                    title={mappingReady ? "" : "Chỉ bật khi mapping đã được tester chấp nhận"}
                    style={{ padding: "8px 14px" }}
                >
                    {generating ? "Đang sinh code..." : "AI Generate Automation"}
                </button>
                {!mappingReady && mapping && (
                    <div style={{ color: "#666", marginTop: 8 }}>Bạn cần Approve tất cả step + route trước.</div>
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
            </section>

            {/* BƯỚC 4: RUN */}
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
                <h3>Bước 4 — Run Automation</h3>
                <button onClick={handleRun} disabled={!filePath || running} style={{ padding: "8px 14px" }}>
                    {running ? "Đang chạy..." : "Run Automation"}
                </button>
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
