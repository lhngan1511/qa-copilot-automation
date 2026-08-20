import V3TestCaseCard from "./V3TestCaseCard.jsx";

/*
 V3TestCaseList — Danh sách card testcase (workspace).
 Chỉ hiển thị các testcase approved (đã lọc ở tầng page/backend).
*/

export default function V3TestCaseList({
    testCases = [],
    selectedIds = [],
    activeTestCaseId = null,
    onToggle,
    recordingActive = false,
    onPrimaryAction,
    onMenuAction,
    openMenuId = null
}) {
    if (!Array.isArray(testCases) || testCases.length === 0) {
        return (
            <div className="v3-empty">
                <strong>Chưa có testcase để chọn</strong>
                <span>Hãy tạo workspace để hiển thị testcase đã duyệt.</span>
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
                    active={activeTestCaseId === testCase.testCaseId}
                    onToggle={onToggle}
                    recordingActive={recordingActive}
                    onPrimaryAction={onPrimaryAction}
                    onMenuAction={onMenuAction}
                    menuOpen={openMenuId === testCase.testCaseId}
                />
            ))}
        </div>
    );
}
