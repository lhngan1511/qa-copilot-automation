function normalizeConfidence(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    let pct = n <= 1 ? n * 100 : n;
    pct = Math.min(100, Math.max(0, pct));
    return Math.round(pct);
}

// Tóm tắt mapping tối đa 1-2 dòng để hiện trên card (không bung toàn bộ).
function mappingSummary(mapping) {
    if (!mapping || !Object.keys(mapping).length) return null;
    const setup = [
        ...(Array.isArray(mapping.authenticationSetup?.steps) ? mapping.authenticationSetup.steps.map(s => s.target || "Đăng nhập") : []),
        ...(Array.isArray(mapping.navigationChain?.steps) ? mapping.navigationChain.steps.map(s => s.target || "Mở menu") : [])
    ].filter(Boolean);
    const actions = (Array.isArray(mapping.stepMappings) ? mapping.stepMappings : []).map(s => s.businessStep || s.target || s.locator).filter(Boolean);
    const results = (Array.isArray(mapping.assertionMappings) ? mapping.assertionMappings : []).map(a => a.businessExpectation || "Kết quả mong đợi").filter(Boolean);
    const lines = [];
    if (setup.length) lines.push(`Chuẩn bị: ${setup.slice(0, 2).join(", ")}`);
    if (actions.length) lines.push(`Thao tác chính: ${actions.slice(0, 2).join(", ")}`);
    if (results.length) lines.push(`Kết quả: ${results[0]}`);
    return lines.slice(0, 2);
}

export default function AutomationTestCaseList({
    testCases,
    searchQuery,
    statusFilter,
    selectedIds,
    activeId,
    isReady,
    confidenceOf,
    analyzed,
    onSearch,
    onFilter,
    onSelectAll,
    onToggle,
    onOpen,
    onOpenData,
    onGenerate,
    onRun
}) {
    const visible = testCases.filter(testCase => {
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch = !query || [testCase.id, testCase.title, testCase.function].some(value => String(value ?? "").toLowerCase().includes(query));
        const matchesFilter = statusFilter === "ALL" || testCase.status === statusFilter;
        return matchesSearch && matchesFilter;
    });
    const selectable = visible.filter(testCase => testCase.includedInSession);
    const allSelected = selectable.length > 0 && selectable.every(testCase => selectedIds.includes(testCase.id));

    return (
        <section className="automation-list-panel">
            <div className="automation-panel-heading"><div><h3>Danh sách testcase</h3><span>{visible.length}/{testCases.length} testcase</span></div></div>
            <div className="automation-list-tools">
                <input aria-label="Tìm testcase" value={searchQuery} onChange={event => onSearch(event.target.value)} placeholder="Tìm theo ID hoặc tiêu đề" />
                <select aria-label="Lọc trạng thái" value={statusFilter} onChange={event => onFilter(event.target.value)}>
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="READY">Sẵn sàng</option>
                    <option value="GENERATED">Đã sinh mã</option>
                    <option value="PASSED">Đạt</option>
                    <option value="FAILED">Thất bại</option>
                    <option value="REMOVED">Đã bỏ khỏi phiên</option>
                </select>
            </div>
            <div className="automation-action-bar">
                <label className="automation-select-all"><input type="checkbox" checked={allSelected} onChange={() => onSelectAll(selectable.map(item => item.id), allSelected)} /> Chọn tất cả</label>
                <span className="automation-action-bar__buttons">
                    <button className="button button--secondary" type="button" disabled={selectedIds.length === 0 || !analyzed} onClick={() => onGenerate([...selectedIds])}>Sinh automation đã chọn</button>
                    <button className="button button--secondary" type="button" disabled={selectedIds.length === 0 || !analyzed} onClick={() => onRun([...selectedIds])}>Chạy testcase đã chọn</button>
                </span>
            </div>
            <div className="automation-testcase-items">
                {visible.map(testCase => {
                    const ready = isReady(testCase);
                    const confidence = confidenceOf(testCase.mapping);
                    const pct = normalizeConfidence(confidence);
                    const confCls = pct == null ? "" : pct >= 70 ? "confidence--high" : pct >= 40 ? "confidence--mid" : "confidence--low";
                    const hasAnalysis = Boolean(testCase.mapping && Object.keys(testCase.mapping).length);
                    const summary = mappingSummary(testCase.mapping);
                    return <div className={`automation-testcase-card ${activeId === testCase.id ? "automation-testcase-card--active" : ""} ${!testCase.includedInSession ? "automation-testcase-card--removed" : ""}`} key={testCase.id}>
                        <div className="automation-testcase-card__top">
                            <input type="checkbox" aria-label={`Chọn ${testCase.id}`} checked={selectedIds.includes(testCase.id)} disabled={!testCase.includedInSession} onChange={() => onToggle(testCase.id)} />
                            <div className="automation-testcase-card__title">
                                <strong>{testCase.id}</strong>
                                <span>{testCase.title || "Chưa có tiêu đề"}</span>
                            </div>
                            {ready
                                ? <span className="automation-status automation-status--ready">🟢 Sẵn sàng</span>
                                : <button type="button" className="automation-status automation-status--warn automation-status--action" onClick={() => onOpenData(testCase.id)}>🟡 Cần bổ sung dữ liệu</button>}
                        </div>
                        {analyzed ? (
                            <div className="automation-testcase-card__meta">
                                {summary ? (
                                    <div className="automation-summary">
                                        <span className="automation-summary__title">✓ AI đã hiểu</span>
                                        {summary.map((line, i) => <span key={i} className="automation-summary__line">{line}</span>)}
                                    </div>
                                ) : <span>AI chưa xác định được</span>}
                            </div>
                        ) : (
                            <div className="automation-testcase-card__meta"><span>Chưa phân tích</span></div>
                        )}
                        <div className="automation-testcase-card__actions">
                            {analyzed && <button className="button button--secondary" type="button" onClick={() => onOpen(testCase.id)}>Xem chi tiết AI</button>}
                            {!ready && <button className="button button--secondary" type="button" onClick={() => onOpenData(testCase.id)}>Bổ sung dữ liệu</button>}
                        </div>
                    </div>;
                })}
                {!visible.length && <p className="automation-empty">Không tìm thấy testcase phù hợp.</p>}
            </div>
        </section>
    );
}
