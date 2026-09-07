import { Link, useNavigate, useParams } from "react-router-dom";
import { useTestCaseReview, useUpdateTestCaseReview } from "../hooks/useTestCaseReview.js";
import { assignDisplayIds, buildTestCaseBatchPayload, nextStableTestCaseId } from "../utils/testCaseReview.js";
import TemplateTestCaseWizard from "../components/TemplateTestCaseWizard.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";

/* "+ Tạo testcase nhanh theo khuôn mẫu" — TRANG RIÊNG (không phải modal — Ngân sửa lại 2026-09-04:
   bản đầu render dạng popup/overlay là SAI, lặp lại đúng lỗi đã sửa ở "+ Tạo testcase từ CodeGen"
   trước đó, xem CodeGenRequirementReviewPage.jsx). Nguồn này STATELESS + không AI nên KHÔNG cần
   workflow "ẩn" như CodeGen — chỉ 1 tham số :workflowId (chính session "Duyệt testcase" đang mở),
   sinh testcase xong tự merge thẳng vào đó bằng ĐÚNG cơ chế nextStableTestCaseId()/assignDisplayIds()
   mà performMerge() (CodeGen) đã dùng. */
export default function TemplateTestCaseWizardPage() {
    const { workflowId } = useParams();
    const navigate = useNavigate();
    const query = useTestCaseReview(workflowId);
    const update = useUpdateTestCaseReview(workflowId);

    const backLink = (
        <Link className="back-link" to={`/workflows/${encodeURIComponent(workflowId)}`}>
            ← Quay lại Duyệt testcase
        </Link>
    );

    if (query.isPending) {
        return (
            <section className="page requirement-review-page template-wizard-page">
                {backLink}
                <LoadingState message="Đang tải Duyệt testcase..." />
            </section>
        );
    }
    if (query.isError) {
        return (
            <section className="page requirement-review-page template-wizard-page">
                {backLink}
                <ErrorState title="Không thể tải Duyệt testcase" error={query.error} onRetry={() => query.refetch()} />
            </section>
        );
    }

    const handleComplete = async templateTestCases => {
        const draft = query.data.testCases;
        let cursor = draft;
        const remapped = templateTestCases.map(testCase => {
            const id = nextStableTestCaseId(cursor);
            const next = { ...testCase, id, testcaseId: id, reviewStatus: "PENDING" };
            cursor = [...cursor, next];
            return next;
        });
        const merged = assignDisplayIds([...draft, ...remapped]);
        await update.mutateAsync({
            artifactId: query.data.artifactId,
            testCases: buildTestCaseBatchPayload(merged)
        });
        navigate(`/workflows/${encodeURIComponent(workflowId)}`, { replace: true });
    };

    return (
        <section className="page requirement-review-page template-wizard-page">
            {backLink}
            <TemplateTestCaseWizard onComplete={handleComplete} />
        </section>
    );
}
