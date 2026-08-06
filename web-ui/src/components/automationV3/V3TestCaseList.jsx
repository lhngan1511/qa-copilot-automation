import V3TestCaseCard from "./V3TestCaseCard.jsx";

/*
 V3TestCaseList — Danh sách card testcase (bước ② Chọn testcase).
 Chỉ hiển thị các testcase approved (đã lọc ở tầng util / page).
*/

export default function V3TestCaseList({ testCases, selectedIds = [], onToggle }) {
    if (!Array.isArray(testCases) || testCases.length === 0) {
        return (
            <div className="v3-empty">
                <strong>Chưa có testcase để chọn</strong>
                <span>Hãy tải approved-testcases.json ở bước Workspace.</span>
            </div>
        );
    }
    return (
        <div className="v3-list">
            {testCases.map(testCase => (
                <V3TestCaseCard
                    key={testCase.testCaseId}
                    testCase={testCase}
                    selected={selectedIds.includes(testCase.testCaseId)}
                    onToggle={onToggle}
                />
            ))}
        </div>
    );
}
