import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    useApproveTestCaseReview,
    useResumeTestCaseWorkflow,
    useTestCaseReview,
    useUpdateTestCaseReview
} from "../hooks/useTestCaseReview.js";
import { getWorkflowOutputUrl } from "../api/workflowApi.js";
import {
    buildTestCaseBatchPayload,
    canApproveTestCaseBatch,
    testCaseId
} from "../utils/testCaseReview.js";
import ErrorState from "./ErrorState.jsx";
import LoadingState from "./LoadingState.jsx";
import TestCaseEditor from "./TestCaseEditor.jsx";
import TestCaseList from "./TestCaseList.jsx";

export default function TestCaseReviewPanel({ workflow }) {
    const workflowId = workflow?.id ?? "";
    const navigate = useNavigate();
    const query = useTestCaseReview(workflowId);
    const update = useUpdateTestCaseReview(workflowId);
    const approve = useApproveTestCaseReview(workflowId);
    const resume = useResumeTestCaseWorkflow(workflowId);
    const [draft, setDraft] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [dirtyIds, setDirtyIds] = useState(() => new Set());
    const [notice, setNotice] = useState("");

    useEffect(() => {
        if (!query.data || dirtyIds.size > 0) return;
        setDraft(structuredClone(query.data.testCases));
        setSelectedId(current =>
            query.data.testCases.some(testCase => testCaseId(testCase) === current)
                ? current
                : testCaseId(query.data.testCases[0])
        );
    }, [query.data, dirtyIds.size]);

    useEffect(() => {
        const warn = event => {
            if (dirtyIds.size > 0) {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirtyIds.size]);

    const selected = useMemo(
        () => draft.find(testCase => testCaseId(testCase) === selectedId) ?? null,
        [draft, selectedId]
    );
    const pending = update.isPending || approve.isPending || resume.isPending;
    const canEdit = query.data?.allowedActions?.includes("UPDATE_TEST_CASES") === true;
    const canApprove = canApproveTestCaseBatch({
        review: query.data,
        dirty: dirtyIds.size > 0,
        pending,
        testCases: draft
    });
    const canResume = query.data?.allowedActions?.includes("RESUME_WORKFLOW") === true;
    const exports = query.data?.exports ?? [];

    if (query.isPending) return <LoadingState message="Đang tải TestCase Review..." />;
    if (query.isError) {
        return (
            <ErrorState
                title="Không thể tải TestCase Review"
                error={query.error}
                onRetry={() => query.refetch()}
            />
        );
    }

    const updateSelected = value => {
        setDraft(items => items.map(item => (testCaseId(item) === selectedId ? value : item)));
        setDirtyIds(ids => new Set(ids).add(selectedId));
        setNotice("");
    };

    const removeSelected = () => {
        if (
            !selected ||
            !window.confirm(
                "Loại testcase này khỏi danh sách review? Đây không phải thao tác reject."
            )
        )
            return;
        const next = draft.filter(item => testCaseId(item) !== selectedId);
        setDraft(next);
        setDirtyIds(ids => new Set(ids).add(selectedId));
        setSelectedId(testCaseId(next[0]));
        setNotice("Testcase đã được loại khỏi draft. Bấm Lưu batch để xác nhận.");
    };

    const saveBatch = async () => {
        try {
            const result = await update.mutateAsync({
                artifactId: query.data.artifactId,
                testCases: buildTestCaseBatchPayload(draft)
            });
            setDraft(structuredClone(result.testCases));
            setDirtyIds(new Set());
            setNotice("Backend đã lưu toàn bộ batch testcase.");
        } catch {
            setNotice("");
        }
    };

    const approveBatch = async () => {
        if (
            !canApprove ||
            !window.confirm("Xác nhận phê duyệt toàn bộ danh sách testcase hiện tại?")
        )
            return;
        try {
            await approve.mutateAsync({
                artifactId: query.data.artifactId,
                approvedBy: "user"
            });
            setNotice(
                "Batch testcase đã được phê duyệt. Export chưa chạy cho tới khi bạn tiếp tục workflow."
            );
        } catch {
            setNotice("");
        }
    };

    const continueWorkflow = async () => {
        try {
            const result = await resume.mutateAsync();
            setNotice("Workflow đã tiếp tục và hoàn tất export.");
            navigate(`/workflows/${encodeURIComponent(result.workflowId)}`, { replace: true });
        } catch {
            setNotice("");
        }
    };

    const error = update.error || approve.error || resume.error;

    return (
        <section
            className="review-workspace testcase-review-workspace"
            aria-labelledby="testcase-review-title"
        >
            <div className="review-workspace__header">
                <div>
                    <p className="workflow-id">Batch review · {query.data.artifactId}</p>
                    <h3 id="testcase-review-title">Review testcase</h3>
                    <p>
                        Lưu và phê duyệt là hai thao tác riêng. DATA_REQUIRED không chặn approval
                        theo contract hiện tại.
                    </p>
                </div>
                <span className="status-badge status-badge--warning">
                    {query.data.approvalStatus}
                </span>
            </div>

            <div className="review-workspace__summary">
                <div>
                    <strong>{query.data.summary.total}</strong>
                    <span>Tổng testcase</span>
                </div>
                <div>
                    <strong>{query.data.summary.ready}</strong>
                    <span>Sẵn sàng</span>
                </div>
                <div>
                    <strong>{query.data.summary.requiresTesterInput}</strong>
                    <span>Cần tester nhập data</span>
                </div>
            </div>

            <div className="testcase-review-layout">
                <div className="testcase-review-sidebar">
                    <TestCaseList
                        testCases={draft}
                        selectedId={selectedId}
                        dirtyIds={dirtyIds}
                        onSelect={setSelectedId}
                    />
                    <p className="review-workspace__notice">
                        Backend chưa cấp ID cho testcase thêm mới, nên chức năng thêm thủ công chưa
                        được bật.
                    </p>
                </div>
                <div className="testcase-review-editor">
                    <TestCaseEditor
                        testCase={selected}
                        disabled={!canEdit || pending}
                        onChange={updateSelected}
                        onRemove={removeSelected}
                    />
                </div>
            </div>

            {error && (
                <div className="inline-alert" role="alert">
                    <strong>{error.code || "REQUEST_FAILED"}</strong>
                    <span>{error.message}</span>
                </div>
            )}
            <div className="visually-hidden" aria-live="polite">
                {notice}
            </div>
            {notice && <p className="success-notice">{notice}</p>}

            {exports.length > 0 && (
                <div className="download-actions">
                    {exports
                        .filter(output => ["json", "excel"].includes(output.format))
                        .map(output => (
                            <a
                                className="button button--secondary"
                                key={output.format}
                                href={getWorkflowOutputUrl(workflowId, output.format)}
                            >
                                Tải {output.format === "json" ? "approved JSON" : "Excel"}
                            </a>
                        ))}
                </div>
            )}

            <div className="review-action-bar">
                <div>
                    <strong>
                        {dirtyIds.size > 0 ? "Có thay đổi chưa lưu" : "Draft đã đồng bộ"}
                    </strong>
                    <span>{draft.length} testcase trong batch hiện tại</span>
                </div>
                <div className="workflow-card__actions">
                    {canEdit && (
                        <button
                            className="button button--secondary"
                            type="button"
                            disabled={dirtyIds.size === 0 || pending}
                            onClick={saveBatch}
                        >
                            {update.isPending ? "Đang lưu..." : "Lưu toàn bộ batch"}
                        </button>
                    )}
                    {query.data.allowedActions.includes("APPROVE_TEST_CASES") && (
                        <button
                            className="button button--primary"
                            type="button"
                            disabled={!canApprove}
                            onClick={approveBatch}
                        >
                            {approve.isPending ? "Đang phê duyệt..." : "Phê duyệt toàn bộ batch"}
                        </button>
                    )}
                    {canResume && (
                        <button
                            className="button button--primary"
                            type="button"
                            disabled={pending}
                            onClick={continueWorkflow}
                        >
                            {resume.isPending ? "Đang export..." : "Tiếp tục để export"}
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
