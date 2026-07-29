import { useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import WorkflowCard from "../components/WorkflowCard.jsx";
import useWorkflows from "../hooks/useWorkflows.js";

const PAGE_SIZE = 6;

export default function DashboardPage() {
    const [offset, setOffset] = useState(0);
    const query = useWorkflows({ limit: PAGE_SIZE, offset });
    const items = query.data?.items ?? [];
    const pagination = query.data?.pagination ?? {};
    const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil((pagination.total ?? 0) / PAGE_SIZE));

    return (
        <section className="page">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">Review pipeline</p>
                    <h2>Workflows</h2>
                    <p>Theo dõi trạng thái review, testcase và output trong một nơi.</p>
                </div>
                <Link className="button button--primary" to="/workflows/new">
                    New Workflow
                </Link>
            </div>

            {query.isPending && <LoadingState message="Đang tải danh sách workflow..." />}
            {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
            {query.isSuccess && items.length === 0 && <EmptyState />}
            {query.isSuccess && items.length > 0 && (
                <>
                    <div className="workflow-list">
                        {items.map(workflow => (
                            <WorkflowCard key={workflow.id} workflow={workflow} />
                        ))}
                    </div>
                    <nav className="pagination" aria-label="Phân trang workflow">
                        <button
                            className="button button--secondary"
                            type="button"
                            disabled={offset === 0 || query.isFetching}
                            onClick={() => setOffset(current => Math.max(0, current - PAGE_SIZE))}
                        >
                            Previous
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
                            Next
                        </button>
                    </nav>
                </>
            )}
        </section>
    );
}
