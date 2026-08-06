import { useEffect, useRef, useState } from "react";
import {
    normalizeConfidence,
    confidenceOf,
    isReady,
    dataRows,
    allMappingSteps,
    mappingStatus,
    runLabel
} from "../../utils/automationDerived.js";

const TABS = [
    ["INFO", "Thông tin chung"],
    ["MAPPING", "Mapping"],
    ["DATA", "Dữ liệu kiểm thử"],
    ["EXPECTED", "Kết quả mong đợi"],
    ["CODE", "Mã kiểm thử"],
    ["RUN", "Chạy thử"]
];

function Masked({ value }) {
    if (!String(value ?? "").trim()) return null;
    return <span className="automation-masked" title={value}>{"•".repeat(8)}</span>;
}

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
    const run = runLabel(testCase);
    const status = mappingStatus(testCase);
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

    // Chỉ hiện tab Mã kiểm thử khi đã generate.
    const visibleTabs = TABS.filter(([id]) => id !== "CODE" || testCase.generatedCode);

    return <section className="automation-inspector">
        <div className="automation-inspector__heading">
            <div><p className="workflow-id">{testCase.id}</p><h3>Chi tiết testcase</h3></div>
            <div className="automation-inspector__heading-actions">{onClose && <button className="button button--secondary" type="button" onClick={onClose}>Đóng cửa sổ</button>}</div>
        </div>
        <div className="automation-tabs" role="tablist">
            {visibleTabs.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "automation-tab automation-tab--active" : "automation-tab"} onClick={() => onTabChange(id)} key={id}>{label}</button>)}
        </div>
        <div className="automation-inspector__body">
            {activeTab === "INFO" && <InfoTab testCase={testCase} moduleName={moduleName} update={update} />}
            {activeTab === "MAPPING" && <MappingTab testCase={testCase} status={status} />}
            {activeTab === "DATA" && <DataTab testCase={testCase} rows={rows} ready={ready} firstMissingRef={firstMissingRef} updateDataField={updateDataField} />}
            {activeTab === "EXPECTED" && <ExpectedTab testCase={testCase} />}
            {activeTab === "CODE" && <div className="automation-empty-state automation-empty-state--large">{testCase.generatedCode ? <pre className="automation-code-preview">{testCase.generatedCode}</pre> : <><strong>Chưa có mã kiểm thử</strong><span>Hãy sinh automation sau khi mapping và dữ liệu sẵn sàng.</span></>}</div>}
            {activeTab === "RUN" && <RunTab testCase={testCase} environment={environment} onRunOne={() => onRunOne(testCase.id)} />}
        </div>
    </section>;
}

/* ---------- Thông tin chung ---------- */
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

/* ---------- Mapping: locator → nghiệp vụ ---------- */
function MappingTab({ testCase, status }) {
    const m = testCase.mapping;
    if (!m || !Object.keys(m).length) {
        return <div className="automation-empty-state automation-empty-state--large"><><strong>Chưa có ánh xạ</strong><span>Chạy 'AI Mapping' ở bước ② để đối chiếu testcase với CodeGen.</span></></div>;
    }
    const steps = allMappingSteps(m);
    const confidence = confidenceOf(m);
    const pct = normalizeConfidence(confidence);
    const kindLabel = { auth: "Đăng nhập", nav: "Điều hướng", business: "Thao tác" };
    return <div className="automation-review">
        <div className="automation-review__title">Mapping: từng bước của testcase nối tới locator trong CodeGen</div>
        {steps.length === 0 && <p className="automation-empty">Chưa có bước nào được map.</p>}
        {steps.map((step, i) => (
            <div className="automation-mapping-step" key={`${step.kind}-${i}`}>
                <div className="automation-mapping-step__locator">
                    <span className="automation-mapping-step__kind">{kindLabel[step.kind] ?? "Bước"}</span>
                    <code>{step.locator || "—"}</code>
                    <span className={`automation-src-badge ${String(step.codegenSource).toUpperCase() === "PLAYWRIGHT_CODEGEN" ? "automation-src-badge--ok" : "automation-src-badge--warn"}`}>{step.codegenSource === "PLAYWRIGHT_CODEGEN" ? "✓ CodeGen" : step.codegenSource === "NOT_IN_CODEGEN" ? "⚠ Không có trong CodeGen" : "?"}</span>
                </div>
                <div className="automation-mapping-step__arrow">↓</div>
                <div className="automation-mapping-step__business">
                    <strong>{step.businessStep}</strong>
                    {step.actionType && <span className="automation-mapping-step__action">{step.actionType}</span>}
                    {pct != null && <span className={`automation-confidence ${pct >= 70 ? "confidence--high" : pct >= 40 ? "confidence--mid" : "confidence--low"}`}>{pct}%</span>}
                </div>
            </div>
        ))}
        <MappingStatusGrid status={status} />
    </div>;
}

/* ---------- Dữ liệu kiểm thử ---------- */
function DataTab({ testCase, rows, ready, firstMissingRef, updateDataField }) {
    const isSecret = name => /mật khẩu|password|mk\b|secret/i.test(String(name));
    const missing = rows.filter(row => !String(row.value).trim() || row.requiresTesterInput);
    return <div className="automation-data-editor">
        <div className="automation-subheading"><div><h4>Dữ liệu kiểm thử</h4><p>Đọc từ approved-testcases.json. {!ready ? "Chỉ cần bổ sung dữ liệu còn thiếu." : "Đã đủ dữ liệu."}</p></div></div>
        {!ready && <p className="automation-data-required">Cần bổ sung dữ liệu trước khi chạy.</p>}
        {rows.length === 0 ? (
            <div className="automation-empty-state"><strong>Không có field chi tiết</strong><span>approved-testcases.json không cung cấp field riêng cho testcase này.</span></div>
        ) : (
            rows.map((row, index) => {
                const isMissing = !String(row.value).trim() || row.requiresTesterInput;
                const secret = isSecret(row.name);
                return <div className="automation-data-row" key={`${testCase.id}-data-${index}`} ref={isMissing && !firstMissingRef.current ? firstMissingRef : null}>
                    <label className="automation-data-field-label">{row.name} {isMissing && <span className="automation-data-warn-badge">⚠ Thiếu</span>}</label>
                    <div className="automation-data-input-row">
                        <input aria-label="Giá trị" type={secret && String(row.value).trim() ? "password" : "text"} value={row.value} onChange={event => updateDataField(row.name, event.target.value)} placeholder={row.requiresTesterInput ? (row.instruction || "Cần dữ liệu") : "Nhập giá trị"} />
                        {row.value && secret && <Masked value={row.value} />}
                    </div>
                    {row.requiresTesterInput && <span className="automation-data-hint">Cần dữ liệu</span>}
                </div>;
            })
        )}
        {rows.length > 0 && !ready && <p className="automation-hint-text">Các field đánh dấu <b>⚠ Thiếu</b> cần được nhập trước khi chạy.</p>}
    </div>;
}

/* ---------- Kết quả mong đợi + đối chiếu CodeGen ---------- */
function ExpectedTab({ testCase }) {
    const m = testCase.mapping;
    const assertions = (Array.isArray(m?.assertionMappings) ? m.assertionMappings : []);
    const codeMatches = assertions.length > 0 && Boolean(testCase.generatedCode && /expect\s*\(/.test(testCase.generatedCode));
    const expected = testCase.expectedResult || (Array.isArray(testCase.expectedResults) && testCase.expectedResults[0]) || (Array.isArray(testCase.assertions) && testCase.assertions.map(a => a.expected).filter(Boolean)[0]) || "";
    return <div className="automation-review">
        <div className="automation-review__block"><strong>Kết quả mong đợi</strong><p className="automation-readonly-value">{expected || "—"}</p></div>
        <div className="automation-review__block"><strong>Assertion (mapping AI)</strong>
            {assertions.length === 0 ? <p className="automation-empty">Chưa có assertion được map.</p> : <ul>{assertions.map((a, i) => <li key={i}>✓ {a.businessExpectation || "Kết quả mong đợi"}{a.playwrightAssertion ? <code> → {a.playwrightAssertion}</code> : null}</li>)}</ul>}
        </div>
        <div className="automation-review__block"><strong>Đối chiếu với CodeGen</strong>
            <p className={`automation-match ${codeMatches ? "automation-match--ok" : "automation-match--warn"}`}>{codeMatches ? "✓ AI khớp — mã kiểm thử có expect() tương ứng." : testCase.generatedCode ? "⚠ Chưa khớp — kiểm tra lại assertion." : "Chưa sinh mã — chưa thể đối chiếu."}</p>
        </div>
    </div>;
}

/* ---------- Mapping status ---------- */
function MappingStatusGrid({ status }) {
    const items = [
        ["Locator", status.locator],
        ["Data", status.data],
        ["Expected", status.expected],
        ["Assertion", status.assertion]
    ];
    return <div className="automation-status-grid">
        <div className="automation-subheading"><h4>Trạng thái mapping</h4></div>
        <div className="automation-status-grid__row">
            {items.map(([label, ok]) => (
                <div className={`automation-status-chip ${ok ? "automation-status-chip--ok" : "automation-status-chip--warn"}`} key={label}>
                    <span>{label}</span><strong>{ok ? "✓" : "⚠"}</strong>
                </div>
            ))}
        </div>
    </div>;
}

/* ---------- Chạy thử ---------- */
function RunTab({ testCase, environment, onRunOne }) {
    const run = runLabel(testCase);
    const exec = testCase.execution || {};
    const hasFile = Boolean(testCase.generatedFile);
    return <div className="automation-run-panel">
        <div className="automation-subheading"><div><h4>Chạy testcase này</h4><p>Chạy ngay trong cửa sổ, không cần quay lại màn hình chính.</p></div></div>
        <div className="automation-run-meta">
            <span>Môi trường: <strong>{environment || "Tự nhận diện"}</strong></span>
            <span>File: <code>{testCase.generatedFile || "—"}</code></span>
        </div>
        <button className="button button--primary" type="button" disabled={!hasFile} onClick={onRunOne}>{run.done ? "Chạy lại" : "Run testcase"}</button>
        {!hasFile && <p className="automation-hint-text">Testcase này chưa sinh mã. Hãy 'Sinh automation' ở bước ④ trước.</p>}

        <div className={`automation-run-result automation-run-result--${run.tone}`}>
            <span className="automation-run-result__status">{run.done ? (run.tone === "pass" ? "✓ PASS" : "✗ FAIL") : "Chưa chạy"}</span>
            {exec.durationMs != null && <span className="automation-run-result__dur">{Math.round(exec.durationMs)} ms</span>}
            {exec.errorMessage && <p className="automation-run-result__error">{exec.errorMessage}</p>}
        </div>
        {exec.technicalLog && <details className="automation-run-log"><summary>Log kỹ thuật</summary><pre>{exec.technicalLog}</pre></details>}
        <div className="automation-run-assets">
            <span className="automation-asset"><strong>Log</strong> {exec.technicalLog ? "✓" : "—"}</span>
            <span className="automation-asset"><strong>Screenshot</strong> {exec.screenshotPath ? "✓" : "—"}</span>
            <span className="automation-asset"><strong>Video</strong> {exec.videoPath ? "✓" : "—"}</span>
        </div>
    </div>;
}
