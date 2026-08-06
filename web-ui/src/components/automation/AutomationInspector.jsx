import { useEffect, useRef, useState } from "react";
import {
    isReady,
    dataRows,
    dataRowState,
    allMappingSteps
} from "../../utils/automationDerived.js";
import {
    interpretAssertion,
    analyzeExpectedCoverage,
    codegenStatus,
    automationStatus
} from "../../utils/assertionIntelligence.js";

/*
 P0 — Drawer "Chi tiết testcase" là TRUNG TÂM REVIEW KỸ THUẬT, không phải nơi
 hiển thị code Playwright. AI giải thích cho tester:
   - Testcase yêu cầu điều gì?
   - AI đã map được bước nào với CodeGen?
   - Assertion có thực sự chứng minh Expected Result hay chưa?
   - Thiếu kiểm tra nào, gợi ý bổ sung gì?
   - Có thể sinh Automation hay cần chỉnh sửa trước?
*/

const TABS = [
    ["INFO", "Thông tin"],
    ["SCENARIO", "Đối chiếu kịch bản"],
    ["DATA", "Dữ liệu kiểm thử"],
    ["EXPECTED", "Kết quả mong đợi"],
    ["RUN", "Chạy thử"]
];

const ACTION_LABEL = {
    FILL: "Nhập dữ liệu",
    CLICK: "Bấm",
    SELECT: "Chọn",
    GOTO: "Mở trang",
    CHECK: "Đánh dấu",
    PRESS: "Nhấn phím"
};

const KIND_LABEL = { auth: "Đăng nhập", nav: "Điều hướng", business: "Thao tác" };

export default function AutomationInspector({
    testCase,
    moduleName,
    activeTab,
    environment,
    onTabChange,
    onUpdate,
    onRunOne,
    onClose
}) {
    if (!testCase) return <section className="automation-inspector automation-inspector--empty"><h3>Chi tiết testcase</h3><p>Chọn một testcase để xem.</p></section>;
    const update = patch => onUpdate(testCase.id, patch);
    const rows = dataRows(testCase);
    const ready = isReady(testCase);
    const cg = codegenStatus(testCase.mapping);
    const auto = automationStatus(testCase);
    const updateDataField = (name, value) => {
        const fields = { ...(testCase.testData?.fields ?? {}) };
        if (fields[name] && typeof fields[name] === "object") {
            fields[name] = { ...fields[name], value, requiresTesterInput: false };
        } else {
            fields[name] = { value, purpose: "VALID", requiresTesterInput: false };
        }
        update({ testData: { ...(testCase.testData ?? {}), fields } });
    };
    const firstMissingRef = useRef(null);
    useEffect(() => {
        if (activeTab === "DATA" && !ready && firstMissingRef.current) {
            firstMissingRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [activeTab, ready, testCase?.id]);

    return <section className="automation-inspector">
        <div className="automation-inspector__heading">
            <div className="automation-inspector__id">{testCase.id}</div>
            <h3 className="automation-inspector__title">Chi tiết testcase</h3>
            <button className="automation-inspector__close" type="button" onClick={onClose} aria-label="Đóng cửa sổ" title="Đóng">✕</button>
        </div>
        <div className="automation-tabs" role="tablist">
            {TABS.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "automation-tab automation-tab--active" : "automation-tab"} onClick={() => onTabChange(id)} key={id}>{label}</button>)}
        </div>
        <div className="automation-inspector__body">
            {activeTab === "INFO" && <InfoTab testCase={testCase} moduleName={moduleName} update={update} />}
            {activeTab === "SCENARIO" && <ScenarioTab testCase={testCase} />}
            {activeTab === "DATA" && <DataTab testCase={testCase} rows={rows} ready={ready} firstMissingRef={firstMissingRef} updateDataField={updateDataField} />}
            {activeTab === "EXPECTED" && <ExpectedTab testCase={testCase} />}
            {activeTab === "RUN" && <RunTab testCase={testCase} environment={environment} auto={auto} onRunOne={() => onRunOne(testCase.id)} />}
        </div>
        {/* Chỉnh sửa mapping — chưa làm, hiển thị Coming Soon (disable). */}
        <div className="automation-inspector__footer">
            <button className="button button--secondary" type="button" disabled title="Sắp ra mắt">Chỉnh sửa kịch bản (Coming soon)</button>
            <CodeGenAutomationStatus cg={cg} auto={auto} />
        </div>
    </section>;
}

/* ---------- Thanh trạng thái CodeGen vs Automation (tách rõ 2 khái niệm) ---------- */
function CodeGenAutomationStatus({ cg, auto }) {
    return <div className="automation-cg-auto">
        <div className="automation-cg-auto__block">
            <span className="automation-cg-auto__label">CodeGen</span>
            <ul>
                <li className={cg.mapped ? "ok" : "warn"}>{cg.mapped ? "✓ Đã Mapping" : "Chưa Mapping"}</li>
                <li className={cg.locatorFound ? "ok" : "warn"}>{cg.locatorFound ? "✓ Đã tìm thấy Locator" : "Chưa tìm thấy Locator"}</li>
                <li className={cg.assertionFound ? "ok" : "warn"}>{cg.assertionFound ? "✓ Đã tìm thấy Assertion" : "Chưa tìm thấy Assertion"}</li>
            </ul>
        </div>
        <div className="automation-cg-auto__block">
            <span className="automation-cg-auto__label">Automation</span>
            <ul>
                <li className={auto.generated ? "ok" : "warn"}>{auto.generated ? `✓ Đã sinh ${auto.filePath || "spec.js"}` : "Chưa sinh spec.js"}</li>
            </ul>
        </div>
    </div>;
}

/* ---------- Thông tin ---------- */
function InfoTab({ testCase, moduleName, update }) {
    return <div className="automation-form-grid">
        <label>ID<input value={testCase.id} readOnly /></label>
        <label>Loại testcase<input value={testCase.type || "Chưa xác định"} readOnly /></label>
        <label className="automation-form-grid__wide">Tiêu đề<input value={testCase.title || ""} onChange={event => update({ title: event.target.value })} /></label>
        <div className="automation-form-grid__wide"><h4>Module</h4><p className="automation-readonly-value">{testCase.module || moduleName || "—"}</p></div>
        <div className="automation-form-grid__wide"><h4>Feature</h4><p className="automation-readonly-value">{testCase.feature || testCase.function || "—"}</p></div>
        <label className="automation-form-grid__wide">Mục tiêu / nội dung<textarea value={testCase.objective || testCase.description || ""} onChange={event => update({ objective: event.target.value, description: event.target.value })} rows="4" /></label>
    </div>;
}

/* ---------- Đối chiếu kịch bản: Bước → CodeGen → Locator → Action → Assertion ---------- */
function ScenarioTab({ testCase }) {
    const m = testCase.mapping;
    if (!m || !Object.keys(m).length) {
        return <div className="automation-empty-state automation-empty-state--large"><><strong>Chưa có đối chiếu</strong><span>Chạy 'AI Mapping' ở bước ② để đối chiếu testcase với CodeGen.</span></></div>;
    }
    const steps = allMappingSteps(m);
    const assertions = Array.isArray(m.assertionMappings) ? m.assertionMappings : [];
    return <div className="automation-scenario">
        <div className="automation-subheading"><div><h4>Đối chiếu từng bước kịch bản</h4><p>AI nối bước testcase tới đoạn CodeGen tương ứng.</p></div></div>
        {steps.length === 0 && <p className="automation-empty">Chưa có bước nào được đối chiếu.</p>}
        {steps.map((step, i) => {
            const inCodegen = String(step.codegenSource).toUpperCase() === "PLAYWRIGHT_CODEGEN";
            return <div className="automation-scenario-step" key={`${step.kind}-${i}`}>
                <div className="automation-scenario-step__head">
                    <span className="automation-mapping-step__kind">{KIND_LABEL[step.kind] ?? "Bước"}</span>
                    <strong>{step.businessStep}</strong>
                </div>
                <div className="automation-scenario-step__flow">
                    <div className={`automation-scenario-node ${inCodegen ? "ok" : "warn"}`}>
                        <span className="automation-scenario-node__tag">CodeGen</span>
                        <code>{step.locator || "—"}</code>
                        {inCodegen ? <span className="automation-src-badge automation-src-badge--ok">✓ khớp</span> : <span className="automation-src-badge automation-src-badge--warn">⚠ không khớp</span>}
                    </div>
                    <div className="automation-scenario-node">
                        <span className="automation-scenario-node__tag">Thao tác</span>
                        <span>{ACTION_LABEL[step.actionType] || step.actionType || "Thao tác"}</span>
                        {step.confidence != null && <span className={`automation-confidence ${step.confidence >= 70 ? "confidence--high" : step.confidence >= 40 ? "confidence--mid" : "confidence--low"}`}>{step.confidence}%</span>}
                    </div>
                </div>
                {!inCodegen && <p className="automation-scenario-warn">⚠ Không tìm thấy đoạn CodeGen phù hợp cho bước này.</p>}
            </div>;
        })}

        {assertions.length > 0 && (
            <div className="automation-scenario-assertions">
                <div className="automation-subheading"><h4>Kết quả — Assertion</h4></div>
                {assertions.map((a, i) => <ScenarioAssertionRow key={i} assertion={a} />)}
            </div>
        )}
    </div>;
}

function ScenarioAssertionRow({ assertion }) {
    const it = interpretAssertion(assertion);
    return <div className="automation-scenario-assertion">
        <div className="automation-scenario-assertion__expect"><strong>{assertion.businessExpectation || "Kết quả mong đợi"}</strong></div>
        <div className="automation-scenario-assertion__arrow">↓</div>
        <div className="automation-scenario-assertion__code"><code>{assertion.playwrightAssertion || "—"}</code></div>
        <div className="automation-scenario-assertion__meaning"><span className="automation-src-badge automation-src-badge--ok">✓</span> {it.meaning}</div>
    </div>;
}

/* ---------- Dữ liệu kiểm thử ---------- */
function DataTab({ testCase, rows, ready, firstMissingRef, updateDataField }) {
    const isSecret = name => /mật khẩu|password|mk\b|secret/i.test(String(name));
    const [showSecrets, setShowSecrets] = useState({});
    const [saved, setSaved] = useState(false);
    const hasAnyMissing = rows.some(row => {
        if (String(row.purpose ?? "").toUpperCase() === "EMPTY") return false;
        return !String(row.value).trim() || row.requiresTesterInput;
    });
    const isEmptyField = row => String(row.purpose ?? "").toUpperCase() === "EMPTY";

    const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

    return <div className="automation-data-editor">
        <div className="automation-subheading"><div><h4>Dữ liệu kiểm thử</h4><p>Đọc từ approved-testcases.json. {hasAnyMissing ? "Còn field cần bổ sung." : "Đã đủ dữ liệu."}</p></div></div>
        {hasAnyMissing && <p className="automation-data-required">Cần bổ sung dữ liệu trước khi chạy.</p>}
        {rows.length === 0 ? (
            <div className="automation-empty-state"><strong>Không có field chi tiết</strong><span>approved-testcases.json không cung cấp field riêng cho testcase này.</span></div>
        ) : (
            rows.map((row, index) => {
                const st = dataRowState(row);
                const secret = isSecret(row.name);
                const show = showSecrets[row.name];
                return <div className={`automation-data-row ${st.empty ? "automation-data-row--empty" : ""}`} key={`${testCase.id}-data-${index}`} ref={st.missing && !firstMissingRef.current ? firstMissingRef : null}>
                    <label className="automation-data-field-label">{row.name}
                        {st.empty && <span className="automation-data-empty-badge">Để trống</span>}
                        {st.missing && <span className="automation-data-warn-badge">⚠ Thiếu</span>}
                    </label>
                    <div className="automation-data-input-row">
                        <input aria-label="Giá trị"
                            type={secret && !show ? "password" : "text"}
                            value={row.value}
                            onChange={event => { updateDataField(row.name, event.target.value); }}
                            placeholder={st.empty ? "Để trống" : row.requiresTesterInput ? (row.instruction || "Cần dữ liệu") : "Nhập giá trị"}
                            readOnly={st.empty} />
                        {secret && row.value && (
                            <button className="text-button" type="button" onClick={() => setShowSecrets(s => ({ ...s, [row.name]: !s[row.name] }))}>
                                {show ? "Ẩn" : "Hiện"}
                            </button>
                        )}
                    </div>
                    {st.note && <span className="automation-data-hint">{st.note}</span>}
                </div>;
            })
        )}
        <div className="automation-data-actions">
            <button className="button button--primary" type="button" onClick={save}>Lưu dữ liệu</button>
            {saved && <span className="automation-data-saved">✓ Đã lưu</span>}
        </div>
    </div>;
}

/* ---------- Kết quả mong đợi: AI diễn giải assertion + độ bao phủ ---------- */
function ExpectedTab({ testCase }) {
    const m = testCase.mapping;
    const assertions = Array.isArray(m?.assertionMappings) ? m.assertionMappings : [];
    const expected = testCase.expectedResult || (Array.isArray(testCase.expectedResults) && testCase.expectedResults[0]) || (Array.isArray(testCase.assertions) && testCase.assertions.map(a => a.expected).filter(Boolean)[0]) || "";
    const analysis = analyzeExpectedCoverage({ expectedResult: expected, assertionMappings: assertions });
    const covCls = analysis.coverage >= 100 ? "ok" : analysis.coverage >= 50 ? "mid" : "low";

    return <div className="automation-expected">
        <div className="automation-expected__block">
            <h4>Kết quả mong đợi</h4>
            <p className="automation-readonly-value">{analysis.expected || "—"}</p>
        </div>

        <div className="automation-expected__block">
            <h4>AI diễn giải Assertion</h4>
            {analysis.assertions.length === 0
                ? <p className="automation-empty">Chưa có assertion được map.</p>
                : analysis.assertions.map((it, i) => (
                    <div className="automation-ai-assertion" key={i}>
                        <div className="automation-ai-assertion__row"><span className="automation-ai-assertion__label">Loại Assertion</span><span>{it.kind}</span></div>
                        <div className="automation-ai-assertion__row"><span className="automation-ai-assertion__label">Đối tượng</span><span>{it.object}</span></div>
                        <div className="automation-ai-assertion__row"><span className="automation-ai-assertion__label">Ý nghĩa</span><span>{it.meaning}</span></div>
                    </div>
                ))}
        </div>

        <div className="automation-expected__block">
            <h4>AI đối chiếu với Expected</h4>
            <div className="automation-coverage">
                <div className="automation-coverage__bar"><span className={`automation-coverage__fill coverage--${covCls}`} style={{ width: `${analysis.coverage}%` }}></span></div>
                <span className="automation-coverage__value">Độ bao phủ: <strong>{analysis.coverage}%</strong></span>
            </div>
            {analysis.proved && analysis.assertions.map((it, i) => (
                <p className="automation-match automation-match--ok" key={i}>✓ {it.kind}: {it.meaning}</p>
            ))}
            {analysis.missingChecks.map((c, i) => (
                <p className="automation-match automation-match--warn" key={i}>⚠ {c.label}</p>
            ))}
        </div>

        {analysis.missingChecks.length > 0 && (
            <div className="automation-expected__block">
                <h4>Kết luận &amp; khuyến nghị</h4>
                <p className="automation-verdict">{analysis.verdict}</p>
                <div className="automation-recommend">
                    <strong>Khuyến nghị bổ sung:</strong>
                    <ul>{analysis.missingChecks.map((c, i) => <li key={i}><code>{c.recommendation}</code></li>)}</ul>
                </div>
            </div>
        )}
    </div>;
}

/* ---------- Chạy thử ---------- */
function RunTab({ testCase, environment, auto, onRunOne }) {
    const exec = testCase.execution || {};
    const hasFile = auto.generated;
    const pass = String(exec.status ?? "").toUpperCase() === "PASSED";
    const fail = String(exec.status ?? "").toUpperCase() === "FAILED";
    return <div className="automation-run-panel">
        <div className="automation-subheading"><div><h4>Chạy testcase này</h4><p>Chạy ngay trong cửa sổ.</p></div></div>

        {!hasFile && (
            <div className="automation-run-blocked">
                <strong>Không thể chạy.</strong>
                <span>Lý do: Chưa có spec.js — hãy 'Sinh automation' ở bước ④ trước.</span>
            </div>
        )}

        <div className="automation-run-grid">
            <div className="automation-run-cell"><span>Environment</span><strong>{environment || "Tự nhận diện"}</strong></div>
            <div className="automation-run-cell"><span>Base URL</span><strong>từ cấu hình server (.env)</strong></div>
            <div className="automation-run-cell"><span>Spec</span><strong>{auto.filePath || "—"}</strong></div>
            <div className="automation-run-cell"><span>Browser</span><strong>Chromium / Chrome</strong></div>
        </div>

        <button className="button button--primary" type="button" disabled={!hasFile} onClick={onRunOne}>{fail || pass ? "Chạy lại" : "Run testcase"}</button>

        <div className={`automation-run-result ${pass ? "automation-run-result--pass" : fail ? "automation-run-result--fail" : "automation-run-result--idle"}`}>
            <span className="automation-run-result__status">{pass ? "✓ PASS" : fail ? "✗ FAIL" : "Chưa chạy"}</span>
            {exec.durationMs != null && <span className="automation-run-result__dur">{Math.round(exec.durationMs)} ms</span>}
            {exec.errorMessage && <p className="automation-run-result__error">{exec.errorMessage}</p>}
        </div>

        <div className="automation-run-assets">
            <span className={`automation-asset ${exec.technicalLog ? "ok" : ""}`}><strong>Log</strong> {exec.technicalLog ? "✓" : "—"}</span>
            <span className={`automation-asset ${exec.screenshotPath ? "ok" : ""}`}><strong>Screenshot</strong> {exec.screenshotPath ? "✓" : "—"}</span>
            <span className={`automation-asset ${exec.videoPath ? "ok" : ""}`}><strong>Video</strong> {exec.videoPath ? "✓" : "—"}</span>
        </div>
        {exec.technicalLog && <details className="automation-run-log"><summary>Log kỹ thuật</summary><pre>{exec.technicalLog}</pre></details>}
    </div>;
}
