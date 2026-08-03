import { useCallback, useEffect, useState } from "react";
import { listAutomationModules, getAutomationMapping, runAutomation } from "../api/automationApi.js";

export default function AutomationPage() {
    const [modules, setModules] = useState([]);
    const [module, setModule] = useState("");
    const [mapping, setMapping] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);

    useEffect(() => {
        let active = true;
        listAutomationModules()
            .then((data) => {
                if (!active) return;
                setModules(data.modules || []);
                const first = data.modules?.[0]?.name;
                if (first) setModule(first);
            })
            .catch((e) => active && setError(e.message));
        return () => {
            active = false;
        };
    }, []);

    const loadMapping = useCallback((mod) => {
        if (!mod) return;
        setLoading(true);
        setError("");
        setRunResult(null);
        getAutomationMapping(mod)
            .then((data) => setMapping(data))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadMapping(module);
    }, [module, loadMapping]);

    const handleRun = async () => {
        setRunning(true);
        setError("");
        try {
            const data = await runAutomation(module);
            setRunResult(data);
            // refresh mapping after run
            loadMapping(module);
        } catch (e) {
            setError(e.message);
        } finally {
            setRunning(false);
        }
    };

    const summary = runResult?.executionReport?.summary;

    return (
        <div style={{ padding: "24px" }}>
            <h2>Automation Intelligence — Playwright CodeGen</h2>
            <p style={{ color: "#666" }}>
                Tự động tạo Automation Mapping và sinh code Playwright từ testcase đã duyệt.
            </p>

            <div style={{ margin: "16px 0", display: "flex", gap: "12px", alignItems: "center" }}>
                <label htmlFor="module">Module:</label>
                <select
                    id="module"
                    value={module}
                    onChange={(e) => setModule(e.target.value)}
                    style={{ padding: "6px" }}
                >
                    {modules.map((m) => (
                        <option key={m.name} value={m.name}>
                            {m.name} ({m.count})
                        </option>
                    ))}
                </select>
                <button onClick={handleRun} disabled={running || !module} style={{ padding: "8px 14px" }}>
                    {running ? "Đang chạy..." : "Generate & Run Playwright"}
                </button>
            </div>

            {error && (
                <div style={{ color: "#b00020", margin: "8px 0" }}>Lỗi: {error}</div>
            )}

            {loading && <div>Đang tải mapping...</div>}

            {mapping && (
                <div>
                    <div style={{ display: "flex", gap: "16px", margin: "12px 0" }}>
                        <Card label="Testcase" value={mapping.count} />
                        <Card label="Mapping READY" value={mapping.readyCount} />
                        <Card label="Blocked" value={mapping.count - mapping.readyCount} />
                    </div>

                    {runResult && summary && (
                        <div
                            style={{
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                padding: "12px",
                                margin: "12px 0",
                                background: "#f8f9fa"
                            }}
                        >
                            <strong>Kết quả chạy:</strong>
                            <ul style={{ margin: "8px 0" }}>
                                <li>Passed: {summary.passed}</li>
                                <li>Failed: {summary.failed}</li>
                                <li>Error: {summary.error}</li>
                                <li>Pass rate: {summary.passRate}%</li>
                            </ul>
                            {runResult.runDiagnostic && (
                                <div style={{ color: "#8a6d00" }}>
                                    {runResult.runDiagnostic}
                                </div>
                            )}
                            {runResult.playwrightProjectDir && (
                                <div style={{ fontSize: "12px", color: "#555" }}>
                                    Project: {runResult.playwrightProjectDir} (
                                    {runResult.generatedFiles.length} files)
                                </div>
                            )}
                        </div>
                    )}

                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
                        <thead>
                            <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
                                <th>ID</th>
                                <th>Feature</th>
                                <th>Route</th>
                                <th>Actions</th>
                                <th>Assertions</th>
                                <th>Readiness</th>
                                <th>Blockers</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mapping.mappings.map((m) => (
                                <tr key={m.testCaseId} style={{ borderBottom: "1px solid #eee" }}>
                                    <td>{m.testCaseId}</td>
                                    <td>{m.feature}</td>
                                    <td><code>{m.route}</code></td>
                                    <td>{m.actions.length}</td>
                                    <td>{m.assertions.length}</td>
                                    <td>
                                        <span
                                            style={{
                                                color:
                                                    m.readiness === "READY"
                                                        ? "#1a7f37"
                                                        : "#b00020"
                                            }}
                                        >
                                            {m.readiness}
                                        </span>
                                    </td>
                                    <td>
                                        {m.blockers.length
                                            ? m.blockers.join(", ")
                                            : <span style={{ color: "#1a7f37" }}>—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Card({ label, value }) {
    return (
        <div
            style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "12px 18px",
                minWidth: "120px",
                textAlign: "center",
                background: "#fff"
            }}
        >
            <div style={{ fontSize: "26px", fontWeight: "bold" }}>{value}</div>
            <div style={{ color: "#666", fontSize: "12px" }}>{label}</div>
        </div>
    );
}
