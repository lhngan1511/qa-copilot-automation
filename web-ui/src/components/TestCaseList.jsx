import { formatTestData, testCaseDisplayId, testCaseId } from "../utils/testCaseReview.js";

const statusLabels = {
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    NEEDS_CHANGES: "Cần chỉnh sửa",
    REMOVED: "Đã loại bỏ"
};

function compact(value, fallback = "—") {
    const text = String(value ?? "").trim();
    return text || fallback;
}

export default function TestCaseList({
    testCases,
    selectedId,
    selectedIds,
    allVisibleSelected,
    disabled,
    reviewDisabled = disabled,
    onSelect,
    onToggle,
    onToggleAll,
    onDecision
}) {
    return (
        <div className="testcase-table-wrap">
            <table className="testcase-review-table">
                <caption className="visually-hidden">Danh sách test case cần review</caption>
                <thead>
                    <tr>
                        <th className="testcase-review-table__checkbox">
                            <input
                                type="checkbox"
                                aria-label="Chọn tất cả test case đang hiển thị"
                                checked={allVisibleSelected && testCases.length > 0}
                                disabled={reviewDisabled || testCases.length === 0}
                                onChange={onToggleAll}
                            />
                        </th>
                        <th>ID</th>
                        <th>Tình huống kiểm tra</th>
                        <th>Loại</th>
                        <th>Dữ liệu đầu vào</th>
                        <th>Kết quả mong đợi</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {testCases.map(testCase => {
                        const id = testCaseId(testCase);
                        const displayId = testCaseDisplayId(testCase);
                        const active = id === selectedId;
                        return (
                            <tr
                                className={`${active ? "testcase-review-table__row--active" : ""} ${
                                    testCase.reviewStatus === "REMOVED"
                                        ? "testcase-review-table__row--removed"
                                        : ""
                                }`}
                                key={id}
                                tabIndex="0"
                                onClick={() => onSelect(id)}
                                onKeyDown={event => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        onSelect(id);
                                    }
                                }}
                            >
                                <td data-label="Chọn" className="testcase-review-table__checkbox">
                                    <input
                                        type="checkbox"
                                        aria-label={`Chọn test case ${displayId}`}
                                        checked={selectedIds.has(id)}
                                        disabled={reviewDisabled}
                                        onClick={event => event.stopPropagation()}
                                        onChange={() => onToggle(id)}
                                    />
                                </td>
                                <td data-label="ID">
                                    <button
                                        className="testcase-table-link"
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation();
                                            onSelect(id);
                                        }}
                                    >
                                        {displayId}
                                    </button>
                                </td>
                                <td data-label="Tình huống kiểm tra">
                                    <button
                                        className="testcase-table-scenario"
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation();
                                            onSelect(id);
                                        }}
                                    >
                                        {compact(testCase.scenario ?? testCase.title)}
                                    </button>
                                </td>
                                <td data-label="Loại">
                                    <span className="testcase-type-badge">
                                        {compact(testCase.type)}
                                    </span>
                                </td>
                                <td
                                    data-label="Dữ liệu đầu vào"
                                    title={formatTestData(testCase.testData)}
                                >
                                    <span className="testcase-table-truncate">
                                        {compact(formatTestData(testCase.testData))}
                                    </span>
                                </td>
                                <td data-label="Kết quả mong đợi" title={testCase.expectedResult}>
                                    <span className="testcase-table-truncate">
                                        {compact(testCase.expectedResult)}
                                    </span>
                                </td>
                                <td data-label="Trạng thái">
                                    <span
                                        className={`testcase-review-status testcase-review-status--${testCase.reviewStatus.toLowerCase()}`}
                                    >
                                        {statusLabels[testCase.reviewStatus]}
                                    </span>
                                </td>
                                <td data-label="Thao tác">
                                    <div className="testcase-row-actions">
                                        <button
                                            type="button"
                                            disabled={reviewDisabled}
                                            onClick={event => {
                                                event.stopPropagation();
                                                onDecision([id], "APPROVED");
                                            }}
                                        >
                                            Duyệt
                                        </button>
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={event => {
                                                event.stopPropagation();
                                                onSelect(id);
                                            }}
                                        >
                                            Chi tiết
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
