function normalizeConfidence(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    let pct = n <= 1 ? n * 100 : n;
    pct = Math.min(100, Math.max(0, pct));
    return Math.round(pct);
}

export default function AutomationTestCaseList({
    testCases,
    searchQuery,
    statusFilter,
    selectedIds,
    activeId,
    isReady,
    confidenceOf,
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
                    <button className="button button--secondary" type="button" disabled={selectedIds.length === 0} onClick={() => onGenerate([...selectedIds])}>Sinh automation đã chọn</button>
                    <button className="button button--secondary" type="button" disabled={selectedIds.length === 0} onClick={() => onRun([...selectedIds])}>Chạy testcase đã chọn</button>
                </span>
            </div>
            <div className="automation-testcase-items">
                {visible.map(testCase => {
                    const ready = isReady(testCase);
                    const confidence = confidenceOf(testCase.mapping);
                    const pct = normalizeConfidence(confidence);
                    const confCls = pct == null ? "" : pct >= 70 ? "confidence--high" : pct >= 40 ? "confidence--mid" : "confidence--low";
                    return <div className={`automation-testcase-card ${activeId === testCase.id ? "automation-testcase-card--active" : ""} ${!testCase.includedInSession ? "automation-testcase-card--removed" : ""}`} key={testCase.id}>
                        <div className="automation-testcase-card__top">
                            <input type="checkbox" aria-label={`Chọn ${testCase.id}`} checked={selectedIds.includes(testCase.id)} disabled={!testCase.includedInSession} onChange={() => onToggle(testCase.id)} />
                            <button type="button" className="automation-testcase-card__title" onClick={() => onOpen(testCase.id)}>
                                <strong>{testCase.id}</strong>
                                <span>{testCase.title || "Chưa có tiêu đề"}</span>
                            </button>
                            {ready
                                ? <span className="automation-status automation-status--ready">🟢 Sẵn sàng</span>
                                : <button type="button" className="automation-status automation-status--warn automation-status--action" onClick={() => onOpenData(testCase.id)}>🟡 Cần bổ sung dữ liệu</button>}
                        </div>
                        <div className="automation-testcase-card__meta">
                            <span>Confidence: {pct == null ? "—" : <span className={`automation-confidence ${confCls}`}>{pct}%</span>}</span>
                        </div>
                        <div className="automation-testcase-card__actions">
                            <button className="button button--secondary" type="button" onClick={() => onOpen(testCase.id)}>Xem AI hiểu gì</button>
                            {!ready && <button className="button button--secondary" type="button" onClick={() => onOpenData(testCase.id)}>Bổ sung dữ liệu</button>}
                        </div>
                    </div>;
                })}
                {!visible.length && <p className="automation-empty">Không tìm thấy testcase phù hợp.</p>}
            </div>
        </section>
    );
}
