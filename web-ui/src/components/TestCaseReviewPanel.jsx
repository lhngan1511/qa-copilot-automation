import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    useApproveTestCaseReview,
    useResumeTestCaseWorkflow,
    useTestCaseReview,
    useUpdateTestCaseReview
} from "../hooks/useTestCaseReview.js";
import {
    buildTestCaseBatchPayload,
    canApproveTestCaseBatch,
    filterTestCases,
    reviewCompletionMessage,
    summarizeReview,
    testCaseId,
    testCaseType
} from "../utils/testCaseReview.js";
import ErrorState from "./ErrorState.jsx";
import LoadingState from "./LoadingState.jsx";
import TestCaseEditor from "./TestCaseEditor.jsx";
import TestCaseList from "./TestCaseList.jsx";

const PAGE_SIZE = 8;
const baseTabs = [
    ["ALL", "Tất cả"],
    ["POSITIVE", "Positive"],
    ["NEGATIVE", "Negative"],
    ["VALIDATION", "Validation"],
    ["BUSINESS_RULE", "Business Rule"]
];

function SummaryCard({ label, value, tone }) {
    return (
        <article className={`testcase-summary-card testcase-summary-card--${tone}`}>
            <span>{label}</span>
            <strong>{value}</strong>
        </article>
    );
}

export default function TestCaseReviewPanel({ workflow }) {
    const workflowId = workflow?.id ?? "";
    const navigate = useNavigate();
    const query = useTestCaseReview(workflowId);
    const update = useUpdateTestCaseReview(workflowId);
    const approve = useApproveTestCaseReview(workflowId);
    const resume = useResumeTestCaseWorkflow(workflowId);
    const [draft, setDraft] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [search, setSearch] = useState("");
    const [activeType, setActiveType] = useState("ALL");
    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState(false);
    const [editDraft, setEditDraft] = useState(null);
    const [notice, setNotice] = useState("");

    useEffect(() => {
        if (!query.data) return;
        setDraft(structuredClone(query.data.testCases));
        setSelectedId(current =>
            query.data.testCases.some(testCase => testCaseId(testCase) === current) ? current : ""
        );
    }, [query.data]);

    useEffect(() => {
        setPage(1);
        setSelectedIds(new Set());
    }, [search, activeType]);

    useEffect(() => {
        const warn = event => {
            if (editing) {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [editing]);

    const selected = useMemo(
        () => draft.find(testCase => testCaseId(testCase) === selectedId) ?? null,
        [draft, selectedId]
    );
    const filtered = useMemo(
        () => filterTestCases(draft, { search, type: activeType }),
        [draft, search, activeType]
    );
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const summary = useMemo(() => summarizeReview(draft), [draft]);
    const availableTypes = new Set(draft.map(testCaseType));
    const tabs = [
        ...baseTabs,
        ...(availableTypes.has("BOUNDARY") ? [["BOUNDARY", "Boundary"]] : [])
    ];
    const pending = update.isPending || approve.isPending || resume.isPending;
    const canEdit = query.data?.allowedActions?.includes("UPDATE_TEST_CASES") === true;
    const canResume = query.data?.allowedActions?.includes("RESUME_WORKFLOW") === true;
    const canApprove = canApproveTestCaseBatch({
        review: query.data,
        pending,
        testCases: draft
    });
    const allFilteredSelected =
        filtered.length > 0 && filtered.every(testCase => selectedIds.has(testCaseId(testCase)));

    if (query.isPending) return <LoadingState message="Đang tải Test Case Review..." />;
    if (query.isError) {
        return (
            <ErrorState
                title="Không thể tải Test Case Review"
                error={query.error}
                onRetry={() => query.refetch()}
            />
        );
    }

    const persistBatch = async (next, message) => {
        setNotice("");
        try {
            const result = await update.mutateAsync({
                artifactId: query.data.artifactId,
                testCases: buildTestCaseBatchPayload(next)
            });
            setDraft(structuredClone(result.testCases));
            setNotice(message);
            return true;
        } catch {
            return false;
        }
    };

    const applyDecision = async (ids, reviewStatus) => {
        if (!canEdit || pending || ids.length === 0) return;
        if (
            reviewStatus === "REMOVED" &&
            !window.confirm(`Loại bỏ ${ids.length} test case khỏi kết quả cuối cùng?`)
        ) {
            return;
        }
        const idSet = new Set(ids);
        const next = draft.map(testCase =>
            idSet.has(testCaseId(testCase)) ? { ...testCase, reviewStatus } : testCase
        );
        const labels = {
            APPROVED: "Đã lưu quyết định duyệt.",
            NEEDS_CHANGES: "Đã đánh dấu test case cần chỉnh sửa.",
            REMOVED: "Đã loại bỏ test case khỏi kết quả cuối cùng."
        };
        if (await persistBatch(next, labels[reviewStatus])) setSelectedIds(new Set());
    };

    const saveEdit = async () => {
        if (!editDraft || !selected) return;
        const next = draft.map(testCase =>
            testCaseId(testCase) === selectedId
                ? { ...editDraft, reviewStatus: "PENDING" }
                : testCase
        );
        if (await persistBatch(next, "Đã lưu chỉnh sửa test case.")) {
            setSelectedId("");
            setEditing(false);
            setEditDraft(null);
        }
    };

    const approveAllEligible = () =>
        applyDecision(
            draft
                .filter(testCase => testCase.reviewStatus !== "REMOVED")
                .map(testCase => testCaseId(testCase)),
            "APPROVED"
        );

    const confirmAndContinue = async () => {
        if ((!canApprove && !canResume) || pending) return;
        setNotice("");
        try {
            if (!canResume) {
                await approve.mutateAsync({
                    artifactId: query.data.artifactId,
                    approvedBy: "user"
                });
            }
            const result = await resume.mutateAsync();
            navigate(`/workflows/${encodeURIComponent(result.workflowId)}`, { replace: true });
        } catch {
            setNotice("");
        }
    };

    const error = update.error || approve.error || resume.error;

    return (
        <section className="testcase-review-page" aria-labelledby="testcase-review-title">
            <header className="testcase-review-page__header">
                <div>
                    <h2 id="testcase-review-title">Test Case Review</h2>
                    <p>Review, chỉnh sửa và phê duyệt test case trước khi tạo output cuối cùng.</p>
                </div>
                <button
                    className="button button--secondary"
                    type="button"
                    disabled={!canEdit || pending}
                    onClick={approveAllEligible}
                >
                    Duyệt tất cả đủ điều kiện
                </button>
            </header>

            <section className="testcase-summary-grid" aria-label="Tóm tắt review">
                <SummaryCard label="Tổng test case" value={summary.total} tone="neutral" />
                <SummaryCard label="Đã duyệt" value={summary.approved} tone="success" />
                <SummaryCard label="Cần chỉnh sửa" value={summary.needsChanges} tone="warning" />
                <SummaryCard label="Đã loại bỏ" value={summary.removed} tone="danger" />
            </section>

            <section className="testcase-review-card">
                <div className="testcase-review-toolbar">
                    <div className="testcase-review-tabs" role="tablist" aria-label="Lọc theo loại">
                        {tabs.map(([value, label]) => (
                            <button
                                className={
                                    activeType === value ? "testcase-review-tab--active" : ""
                                }
                                type="button"
                                role="tab"
                                aria-selected={activeType === value}
                                key={value}
                                onClick={() => setActiveType(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <label className="testcase-review-search">
                        <span className="visually-hidden">Tìm kiếm test case</span>
                        <input
                            type="search"
                            value={search}
                            placeholder="Tìm theo ID, scenario, module..."
                            onChange={event => setSearch(event.target.value)}
                        />
                    </label>
                </div>

                {selectedIds.size > 0 && (
                    <div className="testcase-bulk-actions">
                        <strong>{selectedIds.size} test case đã chọn</strong>
                        <div>
                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => applyDecision([...selectedIds], "APPROVED")}
                            >
                                Duyệt đã chọn
                            </button>
                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => applyDecision([...selectedIds], "NEEDS_CHANGES")}
                            >
                                Cần chỉnh sửa đã chọn
                            </button>
                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => applyDecision([...selectedIds], "REMOVED")}
                            >
                                Loại bỏ đã chọn
                            </button>
                        </div>
                    </div>
                )}

                <div
                    className={`testcase-review-main ${
                        selected ? "testcase-review-main--drawer-open" : ""
                    }`}
                >
                    <div className="testcase-review-main__table">
                        <TestCaseList
                            testCases={visible}
                            selectedId={selectedId}
                            selectedIds={selectedIds}
                            allVisibleSelected={allFilteredSelected}
                            disabled={!canEdit || pending}
                            onSelect={id => {
                                setSelectedId(id);
                                setEditing(false);
                            }}
                            onToggle={id =>
                                setSelectedIds(current => {
                                    const next = new Set(current);
                                    if (next.has(id)) next.delete(id);
                                    else next.add(id);
                                    return next;
                                })
                            }
                            onToggleAll={() =>
                                setSelectedIds(
                                    allFilteredSelected
                                        ? new Set()
                                        : new Set(filtered.map(testCase => testCaseId(testCase)))
                                )
                            }
                            onDecision={applyDecision}
                        />
                        {filtered.length === 0 && (
                            <p className="testcase-review-empty">
                                Không tìm thấy test case phù hợp.
                            </p>
                        )}
                        <nav
                            className="testcase-review-pagination"
                            aria-label="Phân trang test case"
                        >
                            <button
                                className="button button--secondary"
                                type="button"
                                disabled={page === 1}
                                onClick={() => setPage(current => current - 1)}
                            >
                                Trước
                            </button>
                            <span>
                                Trang {page} / {pageCount}
                            </span>
                            <button
                                className="button button--secondary"
                                type="button"
                                disabled={page === pageCount}
                                onClick={() => setPage(current => current + 1)}
                            >
                                Sau
                            </button>
                        </nav>
                    </div>
                    {selected && (
                        <TestCaseEditor
                            testCase={selected}
                            editing={editing}
                            editDraft={editDraft}
                            disabled={!canEdit || pending}
                            saving={update.isPending}
                            onClose={() => {
                                setSelectedId("");
                                setEditing(false);
                                setEditDraft(null);
                            }}
                            onEdit={() => {
                                setEditDraft(structuredClone(selected));
                                setEditing(true);
                            }}
                            onCancel={() => {
                                if (update.isPending) return;
                                setSelectedId("");
                                setEditing(false);
                                setEditDraft(null);
                            }}
                            onDraftChange={setEditDraft}
                            onSave={saveEdit}
                        />
                    )}
                </div>
            </section>

            {error && (
                <div className="inline-alert" role="alert">
                    <strong>{error.code || "REQUEST_FAILED"}</strong>
                    <span>{error.message}</span>
                </div>
            )}
            {notice && (
                <p className="success-notice" role="status">
                    {notice}
                </p>
            )}

            <footer className="testcase-final-action">
                <div>
                    <strong>Tester kiểm soát quyết định cuối cùng</strong>
                    <span>{reviewCompletionMessage(summary)}</span>
                </div>
                <button
                    className="button button--primary"
                    type="button"
                    disabled={(!canApprove && !canResume) || pending}
                    onClick={confirmAndContinue}
                >
                    {pending ? "Đang xử lý..." : "Xác nhận & Tiếp tục"}
                </button>
            </footer>
        </section>
    );
}
