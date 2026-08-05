const TABS = [["INFO", "Thông tin"], ["DATA", "Dữ liệu kiểm thử"], ["MAPPING", "Ánh xạ tự động"], ["CODE", "Mã kiểm thử"]];

/*
 Sprint 1 — giữ nguyên testData object từ approved-testcases.json (không chuyển
 thành mảng). Hiển thị fields nếu có; nếu không có thì hiện requirement/value.
 Chỉ mở Edit value khi field thiếu giá trị.
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
    // fallback: không có fields -> chỉ hiện requirement/value
    return [];
}

export default function AutomationInspector({ testCase, moduleName, functionName, activeTab, onTabChange, onUpdate, onRemove, onRestore }) {
    if (!testCase) return <section className="automation-inspector automation-inspector--empty"><h3>Chi tiết testcase</h3><p>Chọn một testcase để xem và chỉnh sửa.</p></section>;
    const update = patch => onUpdate(testCase.id, patch);
    const rows = dataFieldRows(testCase.testData);
    const updateDataField = (name, value) => {
        const fields = { ...(testCase.testData?.fields ?? {}) };
        fields[name] = { ...(fields[name] ?? {}), value, requiresTesterInput: false };
        update({ testData: { ...(testCase.testData ?? {}), fields } });
    };

    return <section className="automation-inspector">
        <div className="automation-inspector__heading"><div><p className="workflow-id">{testCase.id}</p><h3>Chi tiết testcase</h3></div><button className="button button--danger" type="button" onClick={() => testCase.includedInSession ? onRemove(testCase.id) : onRestore(testCase.id)}>{testCase.includedInSession ? "Bỏ khỏi phiên" : "Khôi phục"}</button></div>
        <div className="automation-tabs" role="tablist">{TABS.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "automation-tab automation-tab--active" : "automation-tab"} onClick={() => onTabChange(id)} key={id}>{label}</button>)}</div>
        <div className="automation-inspector__body">
            {activeTab === "INFO" && <div className="automation-form-grid">
                <label>ID<input value={testCase.id} readOnly /></label>
                <label>Loại testcase<input value={testCase.type || "Chưa xác định"} readOnly /></label>
                <label className="automation-form-grid__wide">Tiêu đề<input value={testCase.title || ""} onChange={event => update({ title: event.target.value })} /></label>
                <label>Module<input value={testCase.module || moduleName || ""} onChange={event => update({ module: event.target.value })} /></label>
                <label>Chức năng<input value={testCase.function || testCase.feature || functionName || ""} onChange={event => update({ function: event.target.value, feature: event.target.value })} /></label>
                <label className="automation-form-grid__wide">Mục tiêu / nội dung<textarea value={testCase.objective || testCase.description || ""} onChange={event => update({ objective: event.target.value, description: event.target.value })} rows="4" /></label>
            </div>}
            {activeTab === "DATA" && <div className="automation-data-editor">
                <div className="automation-subheading"><div><h4>Dữ liệu kiểm thử</h4><p>Dùng dữ liệu từ approved-testcases.json. Chỉ nhập khi thiếu giá trị.</p></div></div>
                {testCase.testData?.requirement && <p className="automation-data-requirement">Yêu cầu: {testCase.testData.requirement}</p>}
                {rows.length ? rows.map((row, index) => <div className="automation-data-row" key={`${testCase.id}-data-${index}`}>
                    <input aria-label="Tên trường" value={row.name} readOnly />
                    <input aria-label="Giá trị" value={row.value} onChange={event => updateDataField(row.name, event.target.value)} placeholder={row.requiresTesterInput ? (row.instruction || "Cần dữ liệu") : row.value} />
                    {row.requiresTesterInput && <span className="automation-data-hint">Cần dữ liệu</span>}
                </div>) : <div className="automation-empty-state"><strong>{testCase.testData?.value ? "Đã có dữ liệu" : "Không có field chi tiết"}</strong><span>{testCase.testData?.value || "approved-testcases.json không cung cấp field chi tiết; hiển thị value thô."}</span></div>}
            </div>}
            {activeTab === "MAPPING" && <div className="automation-empty-state automation-empty-state--large">{testCase.mapping && Object.keys(testCase.mapping).length ? <><h4>Ánh xạ tự động</h4><pre>{JSON.stringify(testCase.mapping, null, 2)}</pre><div><button className="button button--secondary" type="button" onClick={() => update({ mappingStatus: "ACCEPTED" })}>Chấp nhận</button><button className="button button--secondary" type="button" onClick={() => update({ mappingStatus: "EDITED", status: "EDITED" })}>Chỉnh sửa</button></div></> : <><strong>Chưa có ánh xạ</strong><span>Phân tích bằng AI sẽ hiển thị mapping tại đây.</span></>}</div>}
            {activeTab === "CODE" && <div className="automation-empty-state automation-empty-state--large">{testCase.generatedCode ? <pre className="automation-code-preview">{testCase.generatedCode}</pre> : <><strong>Chưa có mã kiểm thử</strong><span>Hãy sinh mã kiểm thử sau khi dữ liệu và ánh xạ đã sẵn sàng.</span></>}</div>}
        </div>
    </section>;
}
