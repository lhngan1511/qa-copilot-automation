import { useEffect, useMemo, useState } from "react";
import V3UploadPanel from "../components/automationV3/V3UploadPanel.jsx";
import V3TestCaseList from "../components/automationV3/V3TestCaseList.jsx";
import V3RecordingPanel from "../components/automationV3/V3RecordingPanel.jsx";
import V3ReviewDrawer from "../components/automationV3/V3ReviewDrawer.jsx";
import V3ConfirmDialog from "../components/automationV3/V3ConfirmDialog.jsx";
import {
    createWorkspace,
    getWorkspace,
    selectTestCase,
    unselectTestCase,
    startRecording,
    stopRecording,
    approveRecording,
    rejectRecording,
    deleteRecording
} from "../api/automationV3Api.js";

/*
 AutomationV3Page — Automation Workspace (bước 5A + 5B).

 Bước 5B:
   - Ghi testcase (banner đang ghi) / Dừng ghi / cập nhật card.
   - Review Recording mở theo Drawer khi tester chủ động.
   - Approve / Reject / Ghi lại / Xóa recording (xác nhận).
 Chưa Generate / Run / AI assertion.
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
    const [workspace, setWorkspace] = useState(null);
    const [displayMap, setDisplayMap] = useState(() => readDisplayMap());
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    // Bước 5B
    const [activeRecording, setActiveRecording] = useState(null); // {testCaseId, recordingId, sessionId, title}
    const [recordingSource, setRecordingSource] = useState("");
    const [drawerTestcase, setDrawerTestcase] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [confirm, setConfirm] = useState(null); // {kind, title, message, testCase}

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
        return () => { cancelled = true; };
    }, []);

    const selectedIds = useMemo(() => {
        if (!workspace?.items) return [];
        return workspace.items.filter(item => item.selectedForAutomation).map(item => item.testCaseId);
    }, [workspace]);

    const meta = useMemo(() => {
        const items = workspace?.items ?? [];
        return { count: items.length, module: items[0]?.module ?? "" };
    }, [workspace]);

    const enrichedItems = useMemo(() => {
        if (!workspace?.items) return [];
        return workspace.items.map(item => ({ ...item, ...(displayMap[item.testCaseId] ?? {}) }));
    }, [workspace, displayMap]);

    const recordingActive = Boolean(activeRecording);
    const activeTestcase = activeRecording
        ? enrichedItems.find(i => i.testCaseId === activeRecording.testCaseId) ?? null
        : null;

    const applyItem = patch => {
        setWorkspace(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                items: (prev.items ?? []).map(it => (it.testCaseId === patch.testCaseId ? { ...it, ...patch } : it))
            };
        });
    };

    /* ---------------- Workspace (5A) ---------------- */

    const handleCreated = async ({ result }) => {
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
            const created = await createWorkspace({ approvedTestCases: payload, module: result.meta.module, source: "NEW" });
            setWorkspace({ workspaceId: created.workspaceId, items: created.items ?? [] });
            window.localStorage.setItem(STORAGE_KEY, created.workspaceId);
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
        } catch (e) {
            setError(e?.message ?? "Không tạo được workspace.");
        } finally {
            setBusy(false);
        }
    };

    const handleToggle = async (testCaseId, nextSelected) => {
        if (!workspace?.workspaceId || recordingActive) return;
        setError("");
        setBusy(true);
        try {
            const item = nextSelected
                ? await selectTestCase(workspace.workspaceId, testCaseId)
                : await unselectTestCase(workspace.workspaceId, testCaseId);
            applyItem(item);
        } catch (e) {
            setError(e?.message ?? "Không cập nhật được lựa chọn.");
        } finally {
            setBusy(false);
        }
    };

    /* ---------------- Recording (5B) ---------------- */

    const handlePrimaryAction = async (key, testCase) => {
        setOpenMenuId(null);
        if (key === "record") await handleStart(testCase);
        else if (key === "stop") await handleStop();
        else if (key === "review") setDrawerTestcase(testCase);
    };

    const handleStart = async testCase => {
        if (recordingActive) return;
        setError("");
        setBusy(true);
        try {
            const start = await startRecording(workspace.workspaceId, {
                testCaseId: testCase.testCaseId,
                type: "TESTCASE"
            });
            setActiveRecording({
                testCaseId: testCase.testCaseId,
                recordingId: start.recordingId,
                sessionId: start.sessionId,
                title: testCase.title
            });
            setRecordingSource("");
            applyItem({ testCaseId: testCase.testCaseId, automationStatus: "RECORDING", reviewStatus: "RECORDING" });
        } catch (e) {
            setError(e?.message ?? "Không ghi được testcase.");
        } finally {
            setBusy(false);
        }
    };

    const handleStop = async () => {
        if (!activeRecording) return;
        setError("");
        setBusy(true);
        const testCaseId = activeRecording.testCaseId;
        const recordingId = activeRecording.recordingId;
        try {
            const stop = await stopRecording(workspace.workspaceId, { recordingId, source: recordingSource });
            setActiveRecording(null);
            setRecordingSource("");
            applyItem({
                testCaseId,
                automationStatus: "REVIEW_REQUIRED",
                reviewStatus: "REVIEW_REQUIRED",
                recordingStatus: "RECORDED",
                recordingId: stop.recordingId ?? recordingId
            });
        } catch (e) {
            setError(e?.message ?? "Không dừng được recording.");
        } finally {
            setBusy(false);
        }
    };

    const handleApprove = async detail => {
        if (!detail) return;
        setError("");
        setBusy(true);
        try {
            await approveRecording(workspace.workspaceId, detail.recordingId);
            applyItem({
                testCaseId: detail.testCaseId,
                automationStatus: "APPROVED",
                reviewStatus: "APPROVED",
                recordingId: detail.recordingId,
                recordingVersion: detail.version
            });
            setDrawerTestcase(null);
            setNotice("Recording đã được duyệt.");
        } catch (e) {
            setError(e?.message ?? "Không duyệt được recording.");
        } finally {
            setBusy(false);
        }
    };

    const handleMenuAction = (action, testCase) => {
        setOpenMenuId(prev => (action === "__toggle" ? (prev === testCase.testCaseId ? null : testCase.testCaseId) : null));
        if (action === "delete") {
            setConfirm({
                kind: "delete",
                title: `Xóa recording ${testCase.testCaseId}?`,
                message: "Recording đã duyệt hoặc file đã sinh sẽ không còn dùng được.",
                testCase
            });
        } else if (action === "reject") {
            setConfirm({
                kind: "reject",
                title: `Từ chối recording ${testCase.testCaseId}?`,
                message: "Recording này sẽ bị đánh dấu từ chối và cần ghi lại.",
                testCase
            });
        } else if (action === "record_again") {
            handleStart(testCase);
        }
    };

    const handleConfirm = async () => {
        if (!confirm) return;
        setBusy(true);
        try {
            if (confirm.kind === "delete") {
                await deleteRecording(workspace.workspaceId, confirm.testCase.recordingId);
                applyItem({
                    testCaseId: confirm.testCase.testCaseId,
                    automationStatus: "SELECTED",
                    reviewStatus: "SELECTED",
                    recordingId: null
                });
                setNotice("Đã xóa recording.");
            } else if (confirm.kind === "reject") {
                await rejectRecording(workspace.workspaceId, confirm.testCase.recordingId, "Tester từ chối.");
                applyItem({
                    testCaseId: confirm.testCase.testCaseId,
                    automationStatus: "REVIEW_REQUIRED",
                    reviewStatus: "REVIEW_REQUIRED"
                });
                setNotice("Đã từ chối recording.");
            }
            setConfirm(null);
        } catch (e) {
            setError(e?.message ?? "Không thực hiện được.");
        } finally {
            setBusy(false);
        }
    };

    /* ---------------- Render ---------------- */

    return (
        <div className="v3-page">
            <div className="v3-page__head">
                <div>
                    <h1 className="v3-page__title">Automation Workspace</h1>
                    <p className="v3-page__sub">
                        {workspace ? `${meta.count} testcase đã duyệt · module ${meta.module || "—"}` : "Chọn testcase cần tự động hóa"}
                    </p>
                </div>
                {workspace ? (
                    <button type="button" className="v3-btn v3-btn--secondary" onClick={() => setCreating(true)} disabled={recordingActive}>
                        Tạo workspace mới
                    </button>
                ) : null}
            </div>

            {error ? <div className="v3-banner v3-banner--error" role="alert">{error}</div> : null}
            {notice ? <div className="v3-banner v3-banner--ok">{notice}</div> : null}

            {recordingActive ? (
                <V3RecordingPanel
                    active={activeTestcase ?? activeRecording}
                    source={recordingSource}
                    onSourceChange={setRecordingSource}
                    busy={busy}
                    onStop={handleStop}
                />
            ) : null}

            {creating ? (
                <section className="v3-section" aria-label="Tạo workspace mới">
                    <div className="v3-section__title">
                        <h2>Tạo Workspace mới</h2>
                        <span className="v3-section__hint">Tải approved-testcases.json</span>
                    </div>
                    <V3UploadPanel onApproved={handleCreated} onError={setError} busy={busy} />
                    {workspace ? (
                        <button type="button" className="v3-btn v3-btn--ghost" onClick={() => setCreating(false)}>
                            Quay lại workspace
                        </button>
                    ) : null}
                </section>
            ) : null}

            {!creating && !workspace ? (
                <div className="v3-empty v3-empty--action">
                    <strong>Chưa có Automation Workspace</strong>
                    <span>Tạo workspace để chọn testcase cần ghi.</span>
                    <button type="button" className="v3-btn v3-btn--primary" onClick={() => setCreating(true)}>
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
                    <V3TestCaseList
                        testCases={enrichedItems}
                        selectedIds={selectedIds}
                        onToggle={handleToggle}
                        recordingActive={recordingActive}
                        onPrimaryAction={handlePrimaryAction}
                        onMenuAction={handleMenuAction}
                        openMenuId={openMenuId}
                    />
                </section>
            ) : null}

            {drawerTestcase ? (
                <V3ReviewDrawer
                    workspaceId={workspace.workspaceId}
                    testCase={drawerTestcase}
                    onClose={() => setDrawerTestcase(null)}
                    onApprove={handleApprove}
                />
            ) : null}

            <V3ConfirmDialog
                open={Boolean(confirm)}
                title={confirm?.title ?? ""}
                message={confirm?.message ?? ""}
                confirmLabel={confirm?.kind === "delete" ? "Xóa recording" : "Từ chối recording"}
                danger={confirm?.kind === "delete"}
                busy={busy}
                onCancel={() => setConfirm(null)}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
