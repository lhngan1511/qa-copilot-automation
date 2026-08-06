import { useEffect, useMemo, useState } from "react";
import V3UploadPanel from "../components/automationV3/V3UploadPanel.jsx";
import V3TestCaseList from "../components/automationV3/V3TestCaseList.jsx";
import V3ActionBar from "../components/automationV3/V3ActionBar.jsx";
import {
    createWorkspace,
    getWorkspace,
    selectTestCase,
    unselectTestCase
} from "../api/automationV3Api.js";

/*
 AutomationV3Page — Automation Workspace (bước 5A).

 Tư duy: Workspace là MÀN HÌNH GỐC, không phải Upload.
   - Upload approved-testcases.json chỉ xuất hiện khi TẠO Workspace mới.
   - Khi đã có Workspace → không hiển thị Upload Panel, chỉ hiển thị workspace.
   - Nút trên card thay đổi theo trạng thái testcase (chọn/bỏ chọn).
   - Mỗi card chỉ có một hành động chính (checkbox).
   - Không hiển thị khái niệm 5A/5B/5C cho người dùng.
 Workspace hiện tại được ghi nhớ (localStorage) để mở lại sau khi tải lại trang.
*/

const STORAGE_KEY = "qa-copilot.automation.workspaceId";
const DISPLAY_KEY = "qa-copilot.automation.display";

function readDisplayMap() {
    try {
        return JSON.parse(window.localStorage.getItem(DISPLAY_KEY) || "{}");
    } catch {
        return {};
    }
}

export default function AutomationV3Page() {
    const [workspace, setWorkspace] = useState(null); // { workspaceId, items }
    const [displayMap, setDisplayMap] = useState(() => readDisplayMap());
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const savedId = window.localStorage.getItem(STORAGE_KEY);
        if (!savedId) {
            setCreating(true);
            return;
        }
        getWorkspace(savedId)
            .then(data => {
                if (cancelled) return;
                setWorkspace({ workspaceId: savedId, items: Array.isArray(data.items) ? data.items : [] });
            })
            .catch(() => {
                if (cancelled) return;
                window.localStorage.removeItem(STORAGE_KEY);
                setCreating(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const selectedIds = useMemo(() => {
        if (!workspace?.items) return [];
        return workspace.items.filter(item => item.selectedForAutomation).map(item => item.testCaseId);
    }, [workspace]);

    const meta = useMemo(() => {
        const items = workspace?.items ?? [];
        return {
            count: items.length,
            module: items[0]?.module ?? ""
        };
    }, [workspace]);

    const enrichedItems = useMemo(() => {
        if (!workspace?.items) return [];
        return workspace.items.map(item => ({
            ...item,
            ...(displayMap[item.testCaseId] ?? {})
        }));
    }, [workspace, displayMap]);

    const handleCreated = async ({ result, fileName }) => {
        setError("");
        setNotice("");
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
            const next = {
                workspaceId: created.workspaceId,
                items: Array.isArray(created.items) ? created.items : []
            };
            setWorkspace(next);
            window.localStorage.setItem(STORAGE_KEY, created.workspaceId);
            // Lưu metadata hiển thị (automationCandidate/executionReadiness/dataNote) để mở lại.
            const map = {};
            for (const tc of result.approved ?? []) {
                map[tc.testCaseId] = {
                    automationCandidate: tc.automationCandidate,
                    automationDisabledReason: tc.automationDisabledReason,
                    executionReadiness: tc.executionReadiness,
                    dataNote: tc.dataNote
                };
            }
            setDisplayMap(map);
            window.localStorage.setItem(DISPLAY_KEY, JSON.stringify(map));
            setCreating(false);
            setNotice(`Đã tạo Workspace — ${created.approvedCount ?? result.meta.count} testcase`);
        } catch (caught) {
            setError(caught?.message ?? "Không tạo được workspace.");
        } finally {
            setBusy(false);
        }
    };

    const handleCreateStart = () => {
        setError("");
        setCreating(true);
    };

    const handleCreateCancel = () => {
        setCreating(false);
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

    return (
        <div className="v3-page">
            <div className="v3-page__head">
                <div>
                    <h1 className="v3-page__title">Automation Workspace</h1>
                    <p className="v3-page__sub">
                        {workspace
                            ? `${meta.count} testcase đã duyệt · module ${meta.module || "—"}`
                            : "Chọn testcase cần tự động hóa"}
                    </p>
                </div>
                {workspace ? (
                    <button type="button" className="v3-btn v3-btn--secondary" onClick={handleCreateStart}>
                        Tạo workspace mới
                    </button>
                ) : null}
            </div>

            {error ? (
                <div className="v3-banner v3-banner--error" role="alert">
                    {error}
                </div>
            ) : null}
            {notice ? <div className="v3-banner v3-banner--ok">{notice}</div> : null}

            {creating ? (
                <section className="v3-section" aria-label="Tạo workspace mới">
                    <div className="v3-section__title">
                        <h2>Tạo Workspace mới</h2>
                        <span className="v3-section__hint">Tải approved-testcases.json</span>
                    </div>
                    <V3UploadPanel onApproved={handleCreated} onError={handleError} busy={busy} />
                    {workspace ? (
                        <button type="button" className="v3-btn v3-btn--ghost" onClick={handleCreateCancel}>
                            Quay lại workspace
                        </button>
                    ) : null}
                </section>
            ) : null}

            {!creating && !workspace ? (
                <div className="v3-empty v3-empty--action">
                    <strong>Chưa có Automation Workspace</strong>
                    <span>Tạo workspace để chọn testcase cần ghi.</span>
                    <button type="button" className="v3-btn v3-btn--primary" onClick={handleCreateStart}>
                        Tạo workspace mới
                    </button>
                </div>
            ) : null}

            {!creating && workspace ? (
                <section className="v3-section" aria-label="Chọn testcase">
                    <div className="v3-section__title">
                        <h2>Testcase đã duyệt</h2>
                        <span className="v3-section__hint">Chỉ hiển thị reviewStatus = APPROVED</span>
                    </div>
                    <V3TestCaseList testCases={enrichedItems} selectedIds={selectedIds} onToggle={handleToggle} />
                </section>
            ) : null}

            {workspace && selectedIds.length > 0 && !creating ? (
                <V3ActionBar selectedCount={selectedIds.length} busy={busy} />
            ) : null}
        </div>
    );
}
