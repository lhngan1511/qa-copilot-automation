const STATUS_LABELS = {
    READY: "Sẵn sàng",
    MISSING_DATA: "Thiếu dữ liệu",
    GENERATED: "Đã sinh mã",
    PASSED: "Đạt",
    FAILED: "Thất bại",
    REMOVED: "Đã bỏ khỏi phiên"
};

function confidenceBadge(confidence) {
    if (confidence == null) return null;
    const pct = Math.round(confidence * 100);
    const cls = pct >= 70 ? "confidence--high" : pct >= 40 ? "confidence--mid" : "confidence--low";
    return <span className={`automation-confidence ${cls}`}>{pct}%</span>;
}

export default function AutomationTestCaseList({ testCases, searchQuery, statusFilter, selectedIds, activeId, isReady, confidenceOf, onSearch, onFilter, onSelectAll, onToggle, onOpen, onGenerate, onRun }) {
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
                    <option value="READY">Sẵn sàng</option><option value="GENERATED">Đã sinh mã</option><option value="PASSED">Đạt</option><option value="FAILED">Thất bại</option><option value="REMOVED">Đã bỏ khỏi phiên</option>
                </select>
            </div>
            <label className="automation-select-all"><input type="checkbox" checked={allSelected} onChange={() => onSelectAll(selectable.map(item => item.id), allSelected)} /> Chọn tất cả theo bộ lọc</label>
            <div className="automation-testcase-items">
                {visible.map(testCase => {
                    const ready = isReady(testCase);
                    const confidence = confidenceOf(testCase.mapping);
                    return <div className={`automation-testcase-item ${activeId === testCase.id ? "automation-testcase-item--active" : ""} ${!testCase.includedInSession ? "automation-testcase-item--removed" : ""}`} key={testCase.id}>
                        <input type="checkbox" aria-label={`Chọn ${testCase.id}`} checked={selectedIds.includes(testCase.id)} disabled={!testCase.includedInSession} onChange={() => onToggle(testCase.id)} />
                        <button type="button" className="automation-testcase-item__open" onClick={() => onOpen(testCase.id)}><strong>{testCase.id}</strong><span>{testCase.title || "Chưa có tiêu đề"}</span>{confidenceBadge(confidence)}</button>
                        <span className={`automation-status automation-status--${testCase.status.toLowerCase()}`}>{STATUS_LABELS[testCase.status] || testCase.status}</span>
                        {!ready && <span className="automation-data-required">Cần bổ sung dữ liệu</span>}
                        <div className="automation-row-actions"><button type="button" disabled={!testCase.includedInSession || !selectedIds.includes(testCase.id) || !ready} onClick={() => onGenerate([testCase.id])}>Sinh mã</button><button type="button" disabled={!testCase.includedInSession || !selectedIds.includes(testCase.id) || !ready} onClick={() => onRun([testCase.id])}>Thực thi</button></div>
                    </div>;
                })}
                {!visible.length && <p className="automation-empty">Không tìm thấy testcase phù hợp.</p>}
            </div>
        </section>
    );
}
