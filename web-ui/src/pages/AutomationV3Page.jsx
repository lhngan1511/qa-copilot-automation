import { useMemo, useState } from "react";
import V3WorkspaceStepper from "../components/automationV3/V3WorkspaceStepper.jsx";
import V3UploadPanel from "../components/automationV3/V3UploadPanel.jsx";
import V3TestCaseList from "../components/automationV3/V3TestCaseList.jsx";
import V3ActionBar from "../components/automationV3/V3ActionBar.jsx";
import {
    createWorkspace,
    selectTestCase,
    unselectTestCase
} from "../api/automationV3Api.js";

/*
 AutomationV3Page — UI Bước 5A (Workspace + Upload + Chọn testcase).

 Luồng:
   Upload approved-testcases.json
     → parse (chỉ APPROVED) → POST /api/automation-v3/workspaces
     → hiển thị toàn bộ approved testcase
     → chọn/bỏ chọn gọi select/unselect API.

 Chưa làm ở Bước 5A: Record, Review, Assertion, Generate, Run.
 Không có upload CodeGen, không AI Mapping, không Drawer tự mở.
*/

const STEP_LABEL = "Workspace & chọn testcase";

export default function AutomationV3Page() {
    const [approveData, setApproveData] = useState(null); // { result, fileName }
    const [workspace, setWorkspace] = useState(null); // { workspaceId, items }
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    const selectedIds = useMemo(() => {
        if (!workspace?.items) return [];
        return workspace.items.filter(item => item.selectedForAutomation).map(item => item.testCaseId);
    }, [workspace]);

    const handleApproved = async ({ result, fileName }) => {
        setError("");
        setNotice("");
        setApproveData({ result, fileName });
        setBusy(true);
        try {
            const payload = (result.rawApproved ?? []).map(tc => ({
                id: String(tc?.testCaseId ?? tc?.id ?? tc?.testcaseId ?? ""),
                title: tc?.title ?? tc?.scenario ?? "",
                module: tc?.module ?? "",
                type: tc?.type ?? "",
                testData: tc?.testData ?? null,
                reviewStatus: "APPROVED"
            }));
            const created = await createWorkspace({
                approvedTestCases: payload,
                module: result.meta.module,
                source: "NEW"
            });
            setWorkspace({
                workspaceId: created.workspaceId,
                items: Array.isArray(created.items) ? created.items : []
            });
            setNotice(
                `Đã đọc thành công — ${created.approvedCount ?? result.meta.count} testcase đã duyệt`
            );
        } catch (caught) {
            setError(caught?.message ?? "Không tạo được workspace.");
            setWorkspace(null);
        } finally {
            setBusy(false);
        }
    };

    const handleError = message => setError(message);

    const applyItem = item => {
        setWorkspace(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                items: (prev.items ?? []).map(it => (it.testCaseId === item.testCaseId ? item : it))
            };
        });
    };

    const handleToggle = async (testCaseId, nextSelected) => {
        if (!workspace?.workspaceId) return;
        setError("");
        setBusy(true);
        try {
            if (nextSelected) {
                const item = await selectTestCase(workspace.workspaceId, testCaseId);
                applyItem(item);
            } else {
                const item = await unselectTestCase(workspace.workspaceId, testCaseId);
                applyItem(item);
            }
        } catch (caught) {
            setError(caught?.message ?? "Không cập nhật được lựa chọn.");
        } finally {
            setBusy(false);
        }
    };

    const approvedList = approveData?.result?.approved ?? [];

    return (
        <div className="v3-page">
            <div className="v3-page__head">
                <div>
                    <h1 className="v3-page__title">Automation — Record by Testcase</h1>
                    <p className="v3-page__sub">{STEP_LABEL}</p>
                </div>
            </div>

            <V3WorkspaceStepper />

            {error ? (
                <div className="v3-banner v3-banner--error" role="alert">
                    {error}
                </div>
            ) : null}

            {!workspace ? (
                <section className="v3-section" aria-label="Bước 1: Workspace">
                    <V3UploadPanel onApproved={handleApproved} onError={handleError} busy={busy} />
                </section>
            ) : (
                <>
                    <section className="v3-section" aria-label="Bước 1: Workspace">
                        <div className="v3-ok">
                            <span className="v3-ok__check" aria-hidden="true">✓</span>
                            <div>
                                <b>Đã đọc thành công</b>
                                <div className="v3-ok__meta">
                                    <span className="v3-chip">
                                        <b>{approveData.result.meta.count}</b> testcase đã duyệt
                                    </span>
                                    {approveData.result.meta.module ? (
                                        <span className="v3-chip">
                                            Module: <b>{approveData.result.meta.module}</b>
                                        </span>
                                    ) : null}
                                    {approveData.result.meta.feature ? (
                                        <span className="v3-chip">
                                            Chức năng: <b>{approveData.result.meta.feature}</b>
                                        </span>
                                    ) : null}
                                    <span className="v3-chip">
                                        Workspace: <b>{workspace.workspaceId}</b>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="v3-section" aria-label="Bước 2: Chọn testcase">
                        <div className="v3-section__title">
                            <h2>Chọn testcase</h2>
                            <span className="v3-section__hint">
                                Chỉ hiển thị testcase đã duyệt (reviewStatus = APPROVED)
                            </span>
                        </div>
                        <V3TestCaseList testCases={approvedList} selectedIds={selectedIds} onToggle={handleToggle} />
                    </section>
                </>
            )}

            {workspace && selectedIds.length > 0 ? (
                <V3ActionBar selectedCount={selectedIds.length} busy={busy} />
            ) : null}
        </div>
    );
}
