import { useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import RecentWorkflowsTable from "../components/dashboard/RecentWorkflowsTable.jsx";
import useWorkflows from "../hooks/useWorkflows.js";
import { deleteWorkflow } from "../api/workflowApi.js";

const PAGE_SIZE = 6;

function DashboardIcon({ name }) {
    const paths = {
        workflow: (
            <path d="M5 6h4v4H5V6Zm10 8h4v4h-4v-4ZM5 14h4v4H5v-4Zm4-6h4a3 3 0 0 1 3 3v3M9 16h6" />
        ),
        clock: (
            <>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7v5l3 2" />
            </>
        ),
        folder: (
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        ),
        review: (
            <>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M9 12h6M12 9v6" />
            </>
        ),
        complete: (
            <>
                <circle cx="12" cy="12" r="8.5" />
                <path d="m8.5 12 2.3 2.3 4.8-5" />
            </>
        ),
        testcase: (
            <>
                <path d="M6 3h9l3 3v15H6V3Z" />
                <path d="M15 3v4h4M9 12h6M9 16h6" />
            </>
        ),
        code: <><path d="m9 8-4 4 4 4M15 8l4 4-4 4M13 5l-2 14" /></>,
        automation: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5" /></>
    };

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            {paths[name]}
        </svg>
    );
}

export default function DashboardPage() {
    const [offset, setOffset] = useState(0);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deletingId, setDeletingId] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const query = useWorkflows({ limit: PAGE_SIZE, offset });
    const items = query.data?.items ?? [];
    const pagination = query.data?.pagination ?? {};
    const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil((pagination.total ?? 0) / PAGE_SIZE));

    const confirmDelete = async () => {
        if (!pendingDelete || deletingId) return;
        setDeletingId(pendingDelete.id);
        setDeleteError("");
        try {
            await deleteWorkflow(pendingDelete.id);
            setPendingDelete(null);
            if (items.length === 1 && offset > 0) setOffset(current => Math.max(0, current - PAGE_SIZE));
            else await query.refetch();
        } catch (error) {
            setDeleteError(error?.message ?? "Không xóa được phiên testcase.");
        } finally {
            setDeletingId("");
        }
    };

    return (
        <section className="page dashboard-page">
            <header className="dashboard-page__header">
                <div>
                    <h2>Tổng quan project</h2>
                    <p>
                        Bắt đầu từ yêu cầu, hoàn thiện testcase, ghi thao tác và tạo automation trong cùng một project.
                    </p>
                </div>
                <Link
                    className="button button--primary dashboard-page__primary-action"
                    to="/workflows/new"
                >
                    <span aria-hidden="true">+</span>
                    Tạo bộ testcase
                </Link>
            </header>

            <section
                className="dashboard-project-flow"
                aria-labelledby="project-flow-title"
            >
                <header className="dashboard-project-flow__header">
                    <h3 id="project-flow-title">Các khu vực làm việc</h3>
                    <p>Mỗi khu vực dùng chung dữ liệu của project đang chọn.</p>
                </header>
                <div className="dashboard-project-flow__grid">
                    <Link className="dashboard-project-card" to="/workflows/new">
                        <span className="dashboard-project-card__icon"><DashboardIcon name="testcase" /></span>
                        <span><strong>Thiết kế testcase</strong><small>Nhập Markdown hoặc ảnh giao diện, review và phê duyệt testcase.</small></span>
                        <span className="dashboard-project-card__arrow" aria-hidden="true">→</span>
                    </Link>
                    <Link className="dashboard-project-card" to="/codegen">
                        <span className="dashboard-project-card__icon"><DashboardIcon name="code" /></span>
                        <span><strong>Ghi và quản lý thao tác</strong><small>Ghi luồng sử dụng, phân tích và lưu Action theo chức năng.</small></span>
                        <span className="dashboard-project-card__arrow" aria-hidden="true">→</span>
                    </Link>
                    <Link className="dashboard-project-card" to="/automation">
                        <span className="dashboard-project-card__icon"><DashboardIcon name="automation" /></span>
                        <span><strong>Tạo automation</strong><small>Ghép Action với testcase đã duyệt, sinh và chạy kịch bản.</small></span>
                        <span className="dashboard-project-card__arrow" aria-hidden="true">→</span>
                    </Link>
                </div>
            </section>

            <section
                className="dashboard-section dashboard-recent"
                aria-labelledby="recent-workflows-title"
            >
                <header className="dashboard-section__header dashboard-section__header--recent">
                    <div>
                        <span className="dashboard-section__heading-icon">
                            <DashboardIcon name="clock" />
                        </span>
                        <span>
                            <h3 id="recent-workflows-title">Các phiên testcase gần đây</h3>
                            <p>Tiếp tục những requirement đang review hoặc đã hoàn thành.</p>
                        </span>
                    </div>
                </header>

                {query.isPending && <LoadingState message="Đang tải danh sách workflow..." />}
                {query.isError && (
                    <ErrorState error={query.error} onRetry={() => query.refetch()} />
                )}
                {query.isSuccess && items.length === 0 && <EmptyState />}
                {query.isSuccess && items.length > 0 && (
                    <>
                        <RecentWorkflowsTable workflows={items} deletingId={deletingId} onDelete={workflow => { setDeleteError(""); setPendingDelete(workflow); }} />
                        <nav className="dashboard-pagination" aria-label="Phân trang workflow">
                            <button
                                className="button button--secondary"
                                type="button"
                                disabled={offset === 0 || query.isFetching}
                                onClick={() =>
                                    setOffset(current => Math.max(0, current - PAGE_SIZE))
                                }
                            >
                                Trước
                            </button>
                            <span>
                                Trang <strong>{pageNumber}</strong> / {totalPages}
                                <small>{pagination.total ?? 0} workflow</small>
                            </span>
                            <button
                                className="button button--secondary"
                                type="button"
                                disabled={!pagination.hasMore || query.isFetching}
                                onClick={() => setOffset(current => current + PAGE_SIZE)}
                            >
                                Sau
                            </button>
                        </nav>
                    </>
                )}
            </section>

            {pendingDelete && (
                <div className="dashboard-confirm-overlay" role="presentation" onClick={() => !deletingId && setPendingDelete(null)}>
                    <div className="dashboard-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-workflow-title" onClick={event => event.stopPropagation()}>
                        <h3 id="delete-workflow-title">Xóa phiên testcase?</h3>
                        <p>Phiên <strong>{pendingDelete.name || "Chưa có tên"}</strong> và toàn bộ nội dung review của phiên sẽ bị xóa. Action Library và Automation Workspace không bị ảnh hưởng.</p>
                        {deleteError && <div className="dashboard-confirm__error" role="alert">{deleteError}</div>}
                        <div className="dashboard-confirm__actions">
                            <button className="button button--secondary" type="button" disabled={Boolean(deletingId)} onClick={() => setPendingDelete(null)}>Hủy</button>
                            <button className="button dashboard-confirm__danger" type="button" disabled={Boolean(deletingId)} onClick={confirmDelete}>{deletingId ? "Đang xóa…" : "Xóa phiên"}</button>
                        </div>
                    </div>
                </div>
            )}

        </section>
    );
}
