import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import WorkflowStepper from "../components/WorkflowStepper.jsx";
import RecentWorkflowsTable from "../components/dashboard/RecentWorkflowsTable.jsx";
import useWorkflows from "../hooks/useWorkflows.js";
import cuscSoftwareLogo from "../assets/cusc-software-logo.png";

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
        )
    };

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            {paths[name]}
        </svg>
    );
}

function DashboardSummaryCard({ icon, tone, label, value, detail }) {
    return (
        <article className="dashboard-summary-card">
            <span className={`dashboard-summary-card__icon dashboard-summary-card__icon--${tone}`}>
                <DashboardIcon name={icon} />
            </span>
            <span>
                <small>{label}</small>
                <strong>{value}</strong>
                <span>{detail}</span>
            </span>
        </article>
    );
}

export default function DashboardPage() {
    const [offset, setOffset] = useState(0);
    const query = useWorkflows({ limit: PAGE_SIZE, offset });
    const items = query.data?.items ?? [];
    const pagination = query.data?.pagination ?? {};
    const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil((pagination.total ?? 0) / PAGE_SIZE));

    const pageSummary = useMemo(
        () => ({
            visible: items.length,
            needsReview: items.filter(workflow =>
                [
                    "AI_ANALYSIS_REVIEW_REQUIRED",
                    "TEST_CASE_REVIEW_REQUIRED",
                    "REVIEW_REQUIRED"
                ].includes(workflow.status)
            ).length,
            completed: items.filter(workflow => workflow.status === "COMPLETED").length,
            testCases: items.reduce(
                (total, workflow) => total + (workflow.testCases?.total ?? 0),
                0
            )
        }),
        [items]
    );

    return (
        <section className="page dashboard-page">
            <header className="dashboard-page__header">
                <div>
                    <h2>Dashboard</h2>
                    <p>
                        Quản lý quy trình phân tích requirement, review và phê duyệt testcase bằng
                        AI.
                    </p>
                </div>
                <Link
                    className="button button--primary dashboard-page__primary-action"
                    to="/workflows/new"
                >
                    <span aria-hidden="true">+</span>
                    New AI Test Design
                </Link>
            </header>

            <section className="dashboard-branding" aria-label="CUSC Software">
                <img src={cuscSoftwareLogo} alt="CUSC Software" />
            </section>

            <section
                className="dashboard-section dashboard-workflow-overview"
                aria-labelledby="workflow-overview-title"
            >
                <header className="dashboard-section__header">
                    <div>
                        <span className="dashboard-section__heading-icon">
                            <DashboardIcon name="workflow" />
                        </span>
                        <h3 id="workflow-overview-title">AI Test Design Workflow</h3>
                    </div>
                    <span className="dashboard-control-badge">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6l-7-3Z" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                        Tester-controlled
                    </span>
                </header>
                <WorkflowStepper />
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
                            <h3 id="recent-workflows-title">Recent Workflows</h3>
                            <p>Theo dõi các phiên AI Test Design đang xử lý hoặc đã hoàn thành.</p>
                        </span>
                    </div>
                    <a
                        className="button button--secondary dashboard-recent__all"
                        href="#recent-workflows-table"
                    >
                        Xem tất cả
                        <span aria-hidden="true">→</span>
                    </a>
                </header>

                {query.isPending && <LoadingState message="Đang tải danh sách workflow..." />}
                {query.isError && (
                    <ErrorState error={query.error} onRetry={() => query.refetch()} />
                )}
                {query.isSuccess && items.length === 0 && <EmptyState />}
                {query.isSuccess && items.length > 0 && (
                    <>
                        <RecentWorkflowsTable workflows={items} />
                        <nav className="dashboard-pagination" aria-label="Phân trang workflow">
                            <button
                                className="button button--secondary"
                                type="button"
                                disabled={offset === 0 || query.isFetching}
                                onClick={() =>
                                    setOffset(current => Math.max(0, current - PAGE_SIZE))
                                }
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

            {query.isSuccess && items.length > 0 && (
                <section
                    className="dashboard-summary"
                    aria-label="Tóm tắt các workflow đang hiển thị"
                >
                    <DashboardSummaryCard
                        icon="folder"
                        tone="purple"
                        label="Workflows đang hiển thị"
                        value={pageSummary.visible}
                        detail={`Trang ${pageNumber} hiện tại`}
                    />
                    <DashboardSummaryCard
                        icon="review"
                        tone="blue"
                        label="Cần review"
                        value={pageSummary.needsReview}
                        detail="Trong các workflow hiển thị"
                    />
                    <DashboardSummaryCard
                        icon="complete"
                        tone="green"
                        label="Hoàn thành"
                        value={pageSummary.completed}
                        detail="Trong các workflow hiển thị"
                    />
                    <DashboardSummaryCard
                        icon="testcase"
                        tone="amber"
                        label="Testcases đã tạo"
                        value={pageSummary.testCases}
                        detail="Tổng trên trang hiện tại"
                    />
                </section>
            )}
        </section>
    );
}
