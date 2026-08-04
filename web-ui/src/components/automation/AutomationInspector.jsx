const TABS = [["INFO", "Thông tin"], ["DATA", "Dữ liệu kiểm thử"], ["MAPPING", "Ánh xạ tự động"], ["CODE", "Mã kiểm thử"]];

export default function AutomationInspector({ testCase, context, activeTab, onTabChange, onUpdate, onRemove, onRestore }) {
    if (!testCase) return <section className="automation-inspector automation-inspector--empty"><h3>Chi tiết testcase</h3><p>Chọn một testcase để xem và chỉnh sửa.</p></section>;
    const update = patch => onUpdate(testCase.id, patch);
    const updateData = (index, patch) => update({ testData: testCase.testData.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
    const addData = () => update({ testData: [...testCase.testData, { name: "", value: "", isIntentionalEmpty: false, description: "" }] });
    const removeData = index => update({ testData: testCase.testData.filter((_, itemIndex) => itemIndex !== index) });

    return <section className="automation-inspector">
        <div className="automation-inspector__heading"><div><p className="workflow-id">{testCase.id}</p><h3>Chi tiết testcase</h3></div><button className="button button--danger" type="button" onClick={() => testCase.includedInSession ? onRemove(testCase.id) : onRestore(testCase.id)}>{testCase.includedInSession ? "Bỏ khỏi phiên" : "Khôi phục"}</button></div>
        <div className="automation-tabs" role="tablist">{TABS.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "automation-tab automation-tab--active" : "automation-tab"} onClick={() => onTabChange(id)} key={id}>{label}</button>)}</div>
        <div className="automation-inspector__body">
            {activeTab === "INFO" && <div className="automation-form-grid">
                <label>ID<input value={testCase.id} readOnly /></label>
                <label>Loại testcase<input value={testCase.type || "Chưa xác định"} readOnly /></label>
                <label className="automation-form-grid__wide">Tiêu đề<input value={testCase.title || ""} onChange={event => update({ title: event.target.value })} /></label>
                <label>Module<input value={testCase.module || context.moduleName || ""} onChange={event => update({ module: event.target.value })} /></label>
                <label>Chức năng<input value={testCase.function || context.functionName || ""} onChange={event => update({ function: event.target.value })} /></label>
                <label className="automation-form-grid__wide">Mục tiêu / nội dung<textarea value={testCase.objective || testCase.description || ""} onChange={event => update({ objective: event.target.value, description: event.target.value })} rows="4" /></label>
            </div>}
            {activeTab === "DATA" && <div className="automation-data-editor"><div className="automation-subheading"><div><h4>Dữ liệu kiểm thử</h4><p>Tester tự nhập dữ liệu. Hệ thống không tự sinh dữ liệu mẫu.</p></div><button className="button button--secondary" type="button" onClick={addData}>Thêm dòng</button></div>{testCase.testData.length ? testCase.testData.map((item, index) => <div className="automation-data-row" key={`${testCase.id}-data-${index}`}><input aria-label="Tên trường" value={item.name || ""} onChange={event => updateData(index, { name: event.target.value })} placeholder="Tên trường" /><input aria-label="Giá trị" value={item.value || ""} onChange={event => updateData(index, { value: event.target.value, isIntentionalEmpty: event.target.value === "" ? item.isIntentionalEmpty : false })} placeholder="Giá trị" /><label className="automation-empty-checkbox"><input type="checkbox" checked={item.isIntentionalEmpty === true} onChange={event => updateData(index, { isIntentionalEmpty: event.target.checked, value: event.target.checked ? "" : item.value })} /> Để trống có chủ đích</label><button className="text-button" type="button" onClick={() => removeData(index)}>Xóa</button></div>) : <div className="automation-empty-state"><strong>Chưa có dữ liệu kiểm thử</strong><span>Bấm “Thêm dòng” để nhập dữ liệu cho testcase này.</span></div>}</div>}
            {activeTab === "MAPPING" && <div className="automation-empty-state automation-empty-state--large">{testCase.mapping && Object.keys(testCase.mapping).length ? <><h4>Ánh xạ tự động</h4><pre>{JSON.stringify(testCase.mapping, null, 2)}</pre><div><button className="button button--secondary" type="button" onClick={() => update({ mappingStatus: "ACCEPTED" })}>Chấp nhận</button><button className="button button--secondary" type="button" onClick={() => update({ mappingStatus: "EDITED", status: "EDITED" })}>Chỉnh sửa</button></div></> : <><strong>Chưa có ánh xạ</strong><span>Phân tích bằng AI sẽ hiển thị mapping tại đây.</span></>}</div>}
            {activeTab === "CODE" && <div className="automation-empty-state automation-empty-state--large">{testCase.generatedCode ? <pre className="automation-code-preview">{testCase.generatedCode}</pre> : <><strong>Chưa có mã kiểm thử</strong><span>Hãy sinh mã kiểm thử sau khi dữ liệu và ánh xạ đã sẵn sàng.</span></>}</div>}
        </div>
    </section>;
}
