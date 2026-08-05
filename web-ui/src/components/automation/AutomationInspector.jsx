import { useEffect, useRef } from "react";

const TABS = [["REVIEW", "AI hiểu gì"], ["INFO", "Thông tin"], ["DATA", "Dữ liệu kiểm thử"], ["CODE", "Mã kiểm thử"]];

function normalizeConfidence(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    let pct = n <= 1 ? n * 100 : n;
    pct = Math.min(100, Math.max(0, pct));
    return Math.round(pct);
}

/*
 Sprint 1 (refine) — giữ nguyên testData object từ approved-testcases.json.
 Module / Feature chỉ hiển thị (không phải form nhập).
 Chỉ mở Edit field còn thiếu khi executionReadiness != READY (DATA_REQUIRED).
 Hiển thị confidence và mô tả review dễ hiểu thay vì JSON.
*/
function dataFieldRows(testData) {
    if (!testData || typeof testData !== "object") return [];
    if (testData.fields && typeof testData.fields === "object" && !Array.isArray(testData.fields)) {
        return Object.entries(testData.fields).map(([name, field]) => ({
            name,
            value: field?.value ?? "",
            requiresTesterInput: field?.requiresTesterInput === true,
            instruction: field?.instruction ?? "",
            purpose: field?.purpose ?? "VALID"
        }));
    }
    return [];
}

export default function AutomationInspector({ testCase, moduleName, functionName, activeTab, isReady, onTabChange, onUpdate, onRemove, onRestore }) {
    if (!testCase) return <section className="automation-inspector automation-inspector--empty"><h3>Chi tiết testcase</h3><p>Chọn một testcase để xem.</p></section>;
    const update = patch => onUpdate(testCase.id, patch);
    const rows = dataFieldRows(testCase.testData);
    const ready = isReady ? isReady(testCase) : true;
    const updateDataField = (name, value) => {
        const fields = { ...(testCase.testData?.fields ?? {}) };
        fields[name] = { ...(fields[name] ?? {}), value, requiresTesterInput: false };
        update({ testData: { ...(testCase.testData ?? {}), fields } });
    };
    // Chỉ field còn thiếu (rỗng / cần nhập) mới được Edit khi chưa READY.
    const firstMissingRef = useRef(null);
    useEffect(() => {
        if (activeTab === "DATA" && !ready && firstMissingRef.current) {
            firstMissingRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [activeTab, ready, testCase?.id]);

    return <section className="automation-inspector">
        <div className="automation-inspector__heading"><div><p className="workflow-id">{testCase.id}</p><h3>Chi tiết testcase</h3></div><button className="button button--danger" type="button" onClick={() => testCase.includedInSession ? onRemove(testCase.id) : onRestore(testCase.id)}>{testCase.includedInSession ? "Bỏ khỏi phiên" : "Khôi phục"}</button></div>
        <div className="automation-tabs" role="tablist">{TABS.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "automation-tab automation-tab--active" : "automation-tab"} onClick={() => onTabChange(id)} key={id}>{label}</button>)}</div>
        <div className="automation-inspector__body">
            {activeTab === "INFO" && <div className="automation-form-grid">
                <label>ID<input value={testCase.id} readOnly /></label>
                <label>Loại testcase<input value={testCase.type || "Chưa xác định"} readOnly /></label>
                <label className="automation-form-grid__wide">Tiêu đề<input value={testCase.title || ""} onChange={event => update({ title: event.target.value })} /></label>
                <div className="automation-form-grid__wide"><h4>Module</h4><p className="automation-readonly-value">{testCase.module || moduleName || "—"}</p></div>
                <div className="automation-form-grid__wide"><h4>Feature</h4><p className="automation-readonly-value">{testCase.function || testCase.feature || functionName || "—"}</p></div>
                <label className="automation-form-grid__wide">Mục tiêu / nội dung<textarea value={testCase.objective || testCase.description || ""} onChange={event => update({ objective: event.target.value, description: event.target.value })} rows="4" /></label>
            </div>}
            {activeTab === "DATA" && <div className="automation-data-editor">
                <div className="automation-subheading"><div><h4>Dữ liệu kiểm thử</h4><p>Dùng dữ liệu từ approved-testcases.json. {!ready ? "Chỉ cần bổ sung dữ liệu còn thiếu." : "Đã đủ dữ liệu."}</p></div></div>
                {testCase.testData?.requirement && <p className="automation-data-requirement">Yêu cầu: {testCase.testData.requirement}</p>}
                {!ready && <p className="automation-data-required">Cần bổ sung dữ liệu.</p>}
                {(() => {
                    // Khi chưa READY chỉ hiển thị field còn thiếu; field đã đủ -> không cho sửa.
                    const shownRows = ready ? rows : rows.filter(row => !String(row.value).trim() || row.requiresTesterInput);
                    if (!shownRows.length) {
                        return rows.length ? <div className="automation-empty-state"><strong>Đã đủ dữ liệu</strong><span>Tất cả field đều có giá trị.</span></div>
                            : <div className="automation-empty-state"><strong>{testCase.testData?.value ? "Đã có dữ liệu" : "Không có field chi tiết"}</strong><span>{testCase.testData?.value || "approved-testcases.json không cung cấp field chi tiết."}</span></div>;
                    }
                    return shownRows.map((row, index) => <div className="automation-data-row" key={`${testCase.id}-data-${index}`} ref={index === 0 ? firstMissingRef : null}>
                        <label className="automation-data-field-label">{row.name}</label>
                        <input aria-label="Giá trị" value={row.value} onChange={event => updateDataField(row.name, event.target.value)} placeholder={row.requiresTesterInput ? (row.instruction || "Cần dữ liệu") : "Nhập giá trị"} />
                        {row.requiresTesterInput && <span className="automation-data-hint">Cần dữ liệu</span>}
                    </div>);
                })()}
            </div>}
            {activeTab === "REVIEW" && <ReviewMapping testCase={testCase} onAccept={() => update({ mappingStatus: "ACCEPTED" })} onEdit={() => update({ mappingStatus: "EDITED", status: "EDITED" })} />}
            {activeTab === "CODE" && <div className="automation-empty-state automation-empty-state--large">{testCase.generatedCode ? <pre className="automation-code-preview">{testCase.generatedCode}</pre> : <><strong>Chưa có mã kiểm thử</strong><span>Hãy sinh mã kiểm thử sau khi dữ liệu và ánh xạ đã sẵn sàng.</span></>}</div>}
        </div>
    </section>;
}

/* Review mapping dễ hiểu: không hiện JSON — "AI đã hiểu testcase này như sau". */
function ReviewMapping({ testCase, onAccept, onEdit }) {
    const m = testCase.mapping;
    if (!m || !Object.keys(m).length) return <div className="automation-empty-state automation-empty-state--large"><><strong>Chưa có ánh xạ</strong><span>Phân tích bằng AI sẽ hiển thị tại đây.</span></></div>;
    const confidence = (() => {
        const steps = Array.isArray(m.stepMappings) ? m.stepMappings : [];
        const vals = steps.map(s => normalizeConfidence(s?.confidence)).filter(n => n != null);
        if (!vals.length) return null;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    })();
    const setup = [
        ...(Array.isArray(m.authenticationSetup?.steps) ? m.authenticationSetup.steps.map(s => s.target || "Đăng nhập") : []),
        ...(Array.isArray(m.navigationChain?.steps) ? m.navigationChain.steps.map(s => s.target || "Mở menu") : [])
    ].filter(Boolean);
    const actions = (Array.isArray(m.stepMappings) ? m.stepMappings : []).map(s => s.businessStep || s.target || s.locator || "Bước");
    const expectations = (Array.isArray(m.assertionMappings) ? m.assertionMappings : []).map(a => a.businessExpectation || "Kết quả mong đợi");
    return <div className="automation-review">
        <div className="automation-review__title">AI đã hiểu testcase này như sau</div>
        {setup.length > 0 && <div className="automation-review__block"><strong>Chuẩn bị</strong><ul>{setup.map((x, i) => <li key={i}>✓ {x}</li>)}</ul></div>}
        {actions.length > 0 && <div className="automation-review__block"><strong>Thao tác chính</strong><ul>{actions.map((x, i) => <li key={i}>✓ {x}</li>)}</ul></div>}
        {expectations.length > 0 && <div className="automation-review__block"><strong>Kết quả mong đợi</strong><ul>{expectations.map((x, i) => <li key={i}>✓ {x}</li>)}</ul></div>}
        <div className="automation-review__confidence">Độ tin cậy: {confidence == null ? "—" : `${confidence}%`}</div>
        <div className="automation-review__actions"><button className="button button--primary" type="button" onClick={onAccept}>Chấp nhận</button><button className="button button--secondary" type="button" onClick={onEdit}>Chỉnh sửa</button></div>
    </div>;
}
