import { useEffect, useMemo, useState } from "react";
import V3UploadPanel from "../components/automationV3/V3UploadPanel.jsx";
import V3TestCaseList from "../components/automationV3/V3TestCaseList.jsx";
import V3RecordingPanel from "../components/automationV3/V3RecordingPanel.jsx";
import V3SegmentMappingPanel from "../components/automationV3/V3SegmentMappingPanel.jsx";
import V3ReviewDrawer from "../components/automationV3/V3ReviewDrawer.jsx";
import V3ConfirmDialog from "../components/automationV3/V3ConfirmDialog.jsx";
import { useProject } from "../contexts/ProjectContext.jsx";
import {
    createWorkspace,
    getWorkspace,
    selectTestCase,
    unselectTestCase,
    startRecording,
    stopRecording,
    approveRecording,
    rejectRecording,
    deleteRecording,
    setAutomationDecision,
    generateTestcase,
    runTestcase,
    listWorkspaces,
    deleteWorkspace,
    removeTestCaseFromWorkspace,
    listAvailableTestcases,
    addTestCaseToWorkspace
} from "../api/automationV3Api.js";

/*
 AutomationV3Page — Automation Workspace (bước 5A + 5B).

 Bước 5B:
   - Gắn bản ghi testcase (banner nhập bản ghi) / Nhập xong / cập nhật card.
   - Review Recording mở theo Drawer khi tester chủ động.
   - Approve / Reject / Ghi lại / Xóa recording (xác nhận).
 Chưa Generate / Run / AI assertion. Chưa điều khiển Playwright Recorder thật (chỉ dán source).
*/

const STORAGE_KEY = "qa-copilot.automation.workspaceId";
const DISPLAY_KEY = "qa-copilot.automation.display";
// P0 lifecycle — danh sách workspace gần đây (tối đa 5) để quay lại; không xây manager lớn.
const RECENT_KEY = "qa-copilot.automation.recentWorkspaces";

function readDisplayMap() {
    try {
        return JSON.parse(window.localStorage.getItem(DISPLAY_KEY) || "{}");
    } catch {
        return {};
    }
}

function readRecentWorkspaces() {
    try {
        const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function persistRecentWorkspaces(list) {
    try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    } catch {
        /* ignore */
    }
}

/** P0-D (C) — hiển thị thời gian ngắn "12/08 16:20" (không raw ISO). */
export function formatUpdatedAt(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const pad = n => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Rút gọn id cho hiển thị phụ (debug/danh sách gần đây) — KHÔNG làm UX chính. */
export function shortWorkspaceId(id) {
    return String(id ?? "").replace(/^WS-/, "WS-").slice(0, 18);
}

export default function AutomationV3Page() {
    const { projectId } = useProject();
    const workspaceStorageKey = `${STORAGE_KEY}.${projectId}`;
    const [workspace, setWorkspace] = useState(null);
    const [displayMap, setDisplayMap] = useState(() => readDisplayMap());
    const [recentWorkspaces, setRecentWorkspaces] = useState(() => readRecentWorkspaces());
    // P0-D (C) — danh sách workspace từ API (newest first) + menu ⋯ của từng workspace.
    const [workspaceList, setWorkspaceList] = useState([]);
    const [wsMenuId, setWsMenuId] = useState(null);
    // P0-D1 (B) — popover [Đổi workspace] + modal [Xem tất cả workspace].
    const [wsPopoverOpen, setWsPopoverOpen] = useState(false);
    const [wsManagerOpen, setWsManagerOpen] = useState(false);
    const [wsSearch, setWsSearch] = useState("");
    // P0 (D/E) — loại testcase khỏi workspace + [+ Thêm testcase].
    const [addTcOpen, setAddTcOpen] = useState(false);
    const [availableTcs, setAvailableTcs] = useState([]);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    // Bước 5B
    const [activeRecording, setActiveRecording] = useState(null); // {testCaseId, recordingId, sessionId, title}
    const [recordingSource, setRecordingSource] = useState("");
    const [drawerTestCaseId, setDrawerTestCaseId] = useState(null); // P0: chỉ giữ ID — item derive từ workspace
    const [drawerTab, setDrawerTab] = useState("actions");
    const [openMenuId, setOpenMenuId] = useState(null);
    // P0-C - ket qua Generate/Run nam trong testcase dang mo (khong banner toan workspace).
    const [drawerGenerateResult, setDrawerGenerateResult] = useState(null);
    const [drawerRunResult, setDrawerRunResult] = useState(null);
    const [confirm, setConfirm] = useState(null); // {kind, title, message, testCase}
    // 5C-0 — Record Mapping: panel gán đoạn (mở sau khi dán xong bản ghi / bấm "Xem và gán đoạn").
    const [mappingPanel, setMappingPanel] = useState(null); // { recordingId, initialTestCaseId }
    const [pendingTestCaseId, setPendingTestCaseId] = useState(null);

    /** P0-D (C) — tải danh sách workspace (newest first). */
    const refreshWorkspaceList = async () => {
        try {
            const data = await listWorkspaces();
            const nextList = Array.isArray(data) ? data : [];
            setWorkspaceList(nextList);
            return nextList;
        } catch {
            /* giữ list cũ */
            return null;
        }
    };

    useEffect(() => {
        let cancelled = false;
        const loadProjectWorkspace = async () => {
            // Project là ranh giới dữ liệu. Xóa ngay context cũ trước khi tải để
            // workspace/testcase của project trước không nháy hoặc tồn tại dai dẳng.
            setWorkspace(null);
            setWorkspaceList([]);
            setCreating(false);
            setDrawerTestCaseId(null);
            setMappingPanel(null);
            setDrawerGenerateResult(null);
            setDrawerRunResult(null);
            setWsPopoverOpen(false);
            setWsManagerOpen(false);
            setWsMenuId(null);
            setAddTcOpen(false);
            setError("");

            const list = await refreshWorkspaceList();
            if (cancelled || !list) return;

            const savedId = window.localStorage.getItem(workspaceStorageKey);
            // Không gọi GET bằng ID lưu từ project khác. Chỉ mở workspace đã được
            // endpoint danh sách xác nhận thuộc project hiện tại.
            const activeId = savedId && list.some(item => item.workspaceId === savedId)
                ? savedId
                : list[0]?.workspaceId;

            if (!activeId) {
                window.localStorage.removeItem(workspaceStorageKey);
                return;
            }

            try {
                const data = await getWorkspace(activeId);
                if (cancelled) return;
                setWorkspace({ workspaceId: activeId, items: Array.isArray(data.items) ? data.items : [], approvedTotal: data.approvedTotal ?? null });
                window.localStorage.setItem(workspaceStorageKey, activeId);
            } catch {
                if (cancelled) return;
                window.localStorage.removeItem(workspaceStorageKey);
                setWorkspaceList(current => current.filter(item => item.workspaceId !== activeId));
            }
        };

        loadProjectWorkspace();
        return () => { cancelled = true; };
    }, [projectId]);

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

    // P0 — Drawer LUÔN derive testcase từ ACTIVE WORKSPACE + id đã chốt (không giữ snapshot stale).
    const drawerTestcase = useMemo(() => {
        if (!drawerTestCaseId) return null;
        return (workspace?.items ?? []).find(i => i.testCaseId === drawerTestCaseId) ?? null;
    }, [drawerTestCaseId, workspace]);

    /** P0 lifecycle — chuyển active workspace (chỉ khi user chủ động chọn từ danh sách gần đây). */
    const switchWorkspace = async wsId => {
        if (!wsId || wsId === workspace?.workspaceId) return;
        setError("");
        setBusy(true);
        try {
            const data = await getWorkspace(wsId);
            setWorkspace({ workspaceId: wsId, items: Array.isArray(data.items) ? data.items : [], approvedTotal: data.approvedTotal ?? null });
            window.localStorage.setItem(workspaceStorageKey, wsId);
            setDrawerTestCaseId(null);
            setMappingPanel(null);
            setDrawerGenerateResult(null);
            setDrawerRunResult(null);
            setWsMenuId(null);
            setWsPopoverOpen(false);
            setWsManagerOpen(false);
            await refreshWorkspaceList();
            setNotice(`Đã mở workspace "${data?.module || "Workspace"}".`);
        } catch (e) {
            setError(e?.message ?? "Không mở được workspace.");
        } finally {
            setBusy(false);
        }
    };

    /** P0 lifecycle — "Tạo workspace mới" là destructive context switch: cần xác nhận nếu có dữ liệu automation. */
    const handleNewWorkspaceClick = () => {
        const hasData = (workspace?.items ?? []).some(i =>
            i.selectedForAutomation || (Array.isArray(i.segments) ? i.segments.length : 0) > 0);
        if (hasData) {
            setConfirm({
                kind: "new_workspace",
                title: "Tạo workspace mới?",
                message: "Bạn sắp chuyển sang workspace mới. Dữ liệu workspace hiện tại vẫn được lưu.",
                testCase: null
            });
        } else {
            setCreating(true);
        }
    };

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
                // 6A — fix BUG 2: truyền đủ expectedResult (approved) vào workspace, không để mất trên UI.
                expectedResult: String(tc?.expectedResult ?? tc?.expected ?? "").trim(),
                reviewStatus: "APPROVED"
            }));
            const created = await createWorkspace({ approvedTestCases: payload, module: result.meta.module, source: "NEW" });
            // P0 lifecycle — workspace cũ (nếu có) được giữ trong danh sách gần đây để quay lại; KHÔNG xóa.
            if (workspace?.workspaceId && workspace.workspaceId !== created.workspaceId) {
                const prev = {
                    id: workspace.workspaceId,
                    module: meta.module,
                    count: meta.count
                };
                setRecentWorkspaces(prevList => {
                    const next = [prev, ...prevList.filter(w => w.id !== prev.id)].slice(0, 5);
                    persistRecentWorkspaces(next);
                    return next;
                });
            }
            setWorkspace({ workspaceId: created.workspaceId, items: created.items ?? [], approvedTotal: created.approvedCount ?? null });
            window.localStorage.setItem(workspaceStorageKey, created.workspaceId);
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
        // 6C — primary theo trạng thái: Tạo/Tiếp tục/Xem Automation → mở Drawer tab "Thao tác" (context TC giữ nguyên).
        if (key === "setup" || key === "view") { setDrawerTestCaseId(testCase.testCaseId); setDrawerTab("actions"); }
        else if (key === "record") await handleStart(testCase);
        else if (key === "stop") await handleStop();
        else if (key === "review") { setDrawerTestCaseId(testCase.testCaseId); setDrawerTab("recording"); }
        else if (key === "segments") openMappingFor(testCase);
        else if (key === "conditions") { setDrawerTestCaseId(testCase.testCaseId); setDrawerTab("expected"); }
    };

    const openMappingFor = testCase => {
        const segs = Array.isArray(testCase.segments) ? testCase.segments : [];
        const recordingId = segs.length > 0 ? segs[0].recordingId : null;
        if (!recordingId) return;
        setMappingPanel({ recordingId, initialTestCaseId: testCase.testCaseId });
    };

    const handleStart = async (testCase, { prefill = null } = {}) => {
        if (recordingActive) return;
        setError("");
        setBusy(true);
        try {
            // 5C-0: bản ghi KHÔNG gắn testcase cụ thể — 1 bản ghi dài gán nhiều testcase qua Segment.
            const start = await startRecording(workspace.workspaceId, {
                testCaseId: null,
                type: "TESTCASE"
            });
            setActiveRecording({
                testCaseId: null,
                recordingId: start.recordingId,
                sessionId: start.sessionId,
                title: null
            });
            setPendingTestCaseId(prefill ?? testCase?.testCaseId ?? null);
            setRecordingSource("");
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
        const recordingId = activeRecording.recordingId;
        try {
            const stop = await stopRecording(workspace.workspaceId, { recordingId, source: recordingSource });
            setActiveRecording(null);
            setRecordingSource("");
            // Mở ngay màn hình gán đoạn cho bản ghi vừa nhập (wireframe A+B gộp).
            setMappingPanel({ recordingId: stop.recordingId ?? recordingId, initialTestCaseId: pendingTestCaseId });
            setPendingTestCaseId(null);
            await refreshWorkspace();
        } catch (e) {
            setError(e?.message ?? "Không dừng được recording.");
        } finally {
            setBusy(false);
        }
    };

    /** 5C — Sinh automation (chỉ từ drawer, khi đủ gate). */
    const handleGenerate = async testCase => {
        if (!testCase || busy) return;
        setError("");
        setBusy(true);
        try {
            const res = await generateTestcase(workspace.workspaceId, testCase.testCaseId, {});
            await refreshWorkspace();
            // P0-C - ket qua Generate nam trong testcase dang mo (khong success banner toan workspace).
            setDrawerGenerateResult({ ok: true, code: res?.code ?? "", fileName: res?.outputPath?.split("/").pop() ?? `${testCase.testCaseId}.spec.js` });
        } catch (e) {
            setDrawerGenerateResult({ ok: false, error: e?.message ?? "Không sinh được automation." });
        } finally {
            setBusy(false);
        }
    };

    /** P0-C - Chay thu testcase dang mo. */
    const handleRun = async testCase => {
        if (!testCase || busy) return;
        setError("");
        setBusy(true);
        try {
            const res = await runTestcase(workspace.workspaceId, testCase.testCaseId);
            setDrawerRunResult({ ok: true, ...res });
            await refreshWorkspace();
        } catch (e) {
            setDrawerRunResult({ ok: false, error: e?.message ?? "Không chạy được." });
        } finally {
            setBusy(false);
        }
    };

    /** 5C-0 — tải lại workspace sau khi đổi mapping segment (để card cập nhật). */
    const refreshWorkspace = async () => {
        if (!workspace?.workspaceId) return;
        try {
            const data = await getWorkspace(workspace.workspaceId);
            setWorkspace({ workspaceId: workspace.workspaceId, items: Array.isArray(data.items) ? data.items : [], approvedTotal: data.approvedTotal ?? workspace.approvedTotal ?? null });
        } catch {
            /* giữ trạng thái cũ nếu tải lỗi */
        }
    };

    const handleApprove = async detail => {
        if (!detail) return;
        setError("");
        setNotice(""); // 6C.1 — không để notice cũ hiện cùng error mới (tránh success+error đồng thời).
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
            setDrawerTestCaseId(null);
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
        } else if (action === "remove_from_workspace") {
            setConfirm({
                kind: "remove_testcase",
                title: `Loại ${testCase.testCaseId} khỏi Automation Workspace?`,
                message: "Testcase sẽ không còn hiển thị trong workspace này. Testcase đã duyệt và Thư viện thao tác dùng chung không bị ảnh hưởng.",
                testCase
            });
        } else if (action === "record_again" || action === "setup") {
            // 6C — không đẩy panel recording global; mở Drawer tab "Thao tác" trong context testcase.
            setDrawerTestCaseId(testCase.testCaseId);
            setDrawerTab("actions");
        } else if (action === "segments") {
            openMappingFor(testCase);
        } else if (action === "decision_manual" || action === "decision_automated") {
            handleDecision(action === "decision_manual" ? "MANUAL_ONLY" : "AUTOMATED", testCase);
        }
    };

    /** 5C-0 — tester đặt trạng thái tự động hóa (3 nhãn). */
    const handleDecision = async (decision, testCase) => {
        setError("");
        setBusy(true);
        try {
            const item = await setAutomationDecision(workspace.workspaceId, testCase.testCaseId, decision);
            applyItem(item);
            setNotice(decision === "MANUAL_ONLY"
                ? `${testCase.testCaseId} được đánh dấu chỉ kiểm thử thủ công.`
                : `${testCase.testCaseId} được phép tự động hóa.`);
        } catch (e) {
            setError(e?.message ?? "Không cập nhật được trạng thái.");
        } finally {
            setBusy(false);
        }
    };

    /** P0-D (C) — xóa workspace: confirm → API → refresh; xóa current → chọn gần nhất hoặc empty. */
    const confirmDeleteWorkspace = w => {
        setWsMenuId(null);
        setConfirm({
            kind: "delete_workspace",
            title: `Xóa workspace "${w.module || "Workspace"}"?`,
            message: "Toàn bộ cấu hình automation thuộc workspace này sẽ bị xóa. Testcase đã duyệt và Thư viện thao tác dùng chung không bị ảnh hưởng. Các tệp Playwright đã sinh sẽ được giữ lại.",
            testCase: null,
            workspaceId: w.workspaceId
        });
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
            } else if (confirm.kind === "new_workspace") {
                // P0 lifecycle — user đã xác nhận chủ động tạo workspace mới.
                setCreating(true);
            } else if (confirm.kind === "remove_testcase") {
                await removeTestCaseFromWorkspace(workspace.workspaceId, confirm.testCase.testCaseId);
                await refreshWorkspace();
                setNotice(`Đã loại ${confirm.testCase.testCaseId} khỏi workspace.`);
            } else if (confirm.kind === "delete_workspace") {
                const wsId = confirm.workspaceId;
                const isCurrent = wsId === workspace?.workspaceId;
                await deleteWorkspace(wsId);
                const refreshedList = await refreshWorkspaceList();
                if (isCurrent) {
                    // Chọn workspace gần nhất còn lại (newest first) — UI nói rõ đã chuyển.
                    const next = (refreshedList ?? []).find(w => w.workspaceId !== wsId) ?? null;
                    if (next) {
                        const data = await getWorkspace(next.workspaceId);
                        setWorkspace({ workspaceId: next.workspaceId, items: Array.isArray(data.items) ? data.items : [], approvedTotal: data.approvedTotal ?? null });
                        window.localStorage.setItem(workspaceStorageKey, next.workspaceId);
                        setNotice(`Đã xóa workspace cũ và chuyển sang "${next.module || "Workspace"}".`);
                    } else {
                        window.localStorage.removeItem(workspaceStorageKey);
                        setWorkspace(null);
                        setCreating(false);
                        setDrawerTestCaseId(null);
                        setMappingPanel(null);
                        setNotice("Đã xóa workspace. Tạo workspace mới để bắt đầu.");
                    }
                } else {
                    setNotice("Đã xóa workspace.");
                }
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
        <div className={`v3-page${creating ? " v3-page--creating" : ""}${drawerTestcase ? " v3-page--drawer-open" : ""}`}>
            <div className="v3-page__head">
                <div>
                    <h1 className="v3-page__title">Automation Workspace</h1>
                    <p className="v3-page__sub" title={workspace ? `Workspace: ${workspace.workspaceId}` : undefined}>
                        {workspace ? `${meta.count} testcase đã duyệt · module ${meta.module || "—"} · Đã lưu` : "Chọn testcase cần tự động hóa"}
                    </p>
                </div>
                {workspace ? (
                    <div className="v3-page__head-actions">
                        {/* P0-D1 (B) — chỉ hiển thị workspace HIỆN TẠI trên main page (không render lịch sử).
                            [Đổi workspace ▾] mở popover recent; [Xem tất cả workspace] mở modal quản lý. */}
                        <div className="v3-ws-panel">
                            <div className="v3-ws-panel__current">
                                <span className="v3-ws-panel__label">Workspace hiện tại</span>
                                <b>{meta.module || "Workspace"}</b>
                                <span className="v3-ws-panel__meta">
                                    {meta.count} testcase · Cập nhật {formatUpdatedAt(workspaceList.find(w => w.workspaceId === workspace.workspaceId)?.updatedAt)}
                                </span>
                            </div>
                            <div className="v3-ws-panel__switch">
                                <button type="button" className="v3-btn v3-btn--secondary" onClick={() => setWsPopoverOpen(v => !v)} disabled={recordingActive}>
                                    Đổi workspace ▾
                                </button>
                                {wsPopoverOpen ? (
                                    <div className="v3-ws-popover">
                                        <span className="v3-ws-panel__label">Workspace gần đây</span>
                                        {workspaceList.filter(w => w.workspaceId !== workspace.workspaceId).slice(0, 5).map(w => (
                                            <div className="v3-ws-panel__item" key={w.workspaceId}>
                                                <button type="button" className="v3-ws-panel__item-main" onClick={() => { setWsPopoverOpen(false); switchWorkspace(w.workspaceId); }} disabled={recordingActive}>
                                                    <b>{w.module || "Workspace"}</b>
                                                    <span>{w.selectedCount} testcase · Cập nhật {formatUpdatedAt(w.updatedAt)}</span>
                                                </button>
                                                <span className="v3-ws-panel__menu">
                                                    <button type="button" className="v3-btn v3-btn--mini" aria-label="Menu workspace" onClick={() => setWsMenuId(wsMenuId === w.workspaceId ? null : w.workspaceId)}>
                                                        ⋯
                                                    </button>
                                                    {wsMenuId === w.workspaceId ? (
                                                        <span className="v3-ws-panel__pop">
                                                            <button type="button" className="v3-ws-panel__pop-btn" onClick={() => { setWsPopoverOpen(false); switchWorkspace(w.workspaceId); }} disabled={recordingActive}>Mở</button>
                                                            <button type="button" className="v3-ws-panel__pop-btn v3-ws-panel__danger" onClick={() => confirmDeleteWorkspace(w)}>Xóa</button>
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </div>
                                        ))}
                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => { setWsPopoverOpen(false); setWsManagerOpen(true); }}>
                                            Xem tất cả workspace
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        <button
                            type="button"
                            className="v3-btn v3-btn--secondary"
                            onClick={handleNewWorkspaceClick}
                            disabled={recordingActive}
                        >
                            Tạo workspace mới
                        </button>
                    </div>
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

            {mappingPanel ? (
                <V3SegmentMappingPanel
                    workspaceId={workspace.workspaceId}
                    recordingId={mappingPanel.recordingId}
                    testCases={enrichedItems}
                    initialTestCaseId={mappingPanel.initialTestCaseId}
                    onChanged={refreshWorkspace}
                    onClose={() => setMappingPanel(null)}
                    onError={setError}
                />
            ) : null}

            {creating ? (
                <section className="v3-section v3-section--create" aria-label="Tạo workspace mới">
                    <div className="v3-section__title">
                        <h2>Tạo workspace mới</h2>
                    </div>
                    <div className="v3-upload-shell">
                        <V3UploadPanel onApproved={handleCreated} onError={setError} busy={busy} />
                    </div>
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
                        <span className="v3-section__hint">
                            Testcase trong workspace: {meta.count} / {workspace?.approvedTotal ?? meta.count}
                        </span>
                        <button type="button" className="v3-btn v3-btn--secondary v3-btn--mini" onClick={async () => {
                            setAddTcOpen(v => !v);
                            if (!addTcOpen) {
                                try { const d = await listAvailableTestcases(workspace.workspaceId); setAvailableTcs(Array.isArray(d) ? d : []); } catch { setAvailableTcs([]); }
                            }
                        }} disabled={recordingActive}>
                            + Thêm testcase
                        </button>
                    </div>
                    {addTcOpen ? (
                        <div className="v3-addtc">
                            <p className="v3-act__note">Approved testcase chưa có trong workspace (thêm lại ở trạng thái mới):</p>
                            {availableTcs.length === 0 ? (
                                <p className="v3-act__note">Tất cả testcase đã có trong workspace.</p>
                            ) : (
                                availableTcs.map(tc => (
                                    <div className="v3-ws-panel__item" key={tc.testCaseId}>
                                        <div className="v3-ws-panel__item-main">
                                            <b>{tc.testCaseId} — {tc.title}</b>
                                            <span>{tc.module || ""} · {tc.type || ""}</span>
                                        </div>
                                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={async () => {
                                            try {
                                                await addTestCaseToWorkspace(workspace.workspaceId, tc.testCaseId);
                                                await refreshWorkspace();
                                                setAvailableTcs(prev => prev.filter(x => x.testCaseId !== tc.testCaseId));
                                                setNotice(`Đã thêm ${tc.testCaseId} vào workspace.`);
                                            } catch (e) { setError(e?.message ?? "Không thêm được testcase."); }
                                        }}>Thêm</button>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : null}
                    <V3TestCaseList
                        testCases={enrichedItems}
                        selectedIds={selectedIds}
                        activeTestCaseId={drawerTestCaseId}
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
                    initialTab={drawerTab}
                    onClose={() => { setDrawerTestCaseId(null); setDrawerGenerateResult(null); setDrawerRunResult(null); }}
                    onGenerate={handleGenerate}
                    onRun={handleRun}
                    generateResult={drawerGenerateResult}
                    runResult={drawerRunResult}
                    onChanged={refreshWorkspace}
                />
            ) : null}

            {/* P0-D1 (B) — modal QUẢN LÝ WORKSPACE: search + full list + Mở/Xóa. */}
            {wsManagerOpen ? (
                <div className="v3-overlay" role="dialog" aria-modal="true" aria-label="Quản lý workspace">
                    <div className="v3-dialog v3-dialog--wide">
                        <h4>Quản lý workspace</h4>
                        <input
                            className="v3-input"
                            value={wsSearch}
                            onChange={e => setWsSearch(e.target.value)}
                            placeholder="Tìm workspace theo tên…"
                        />
                        <div className="v3-ws-manager__list">
                            {workspaceList
                                .filter(w => !wsSearch.trim() || String(w.module ?? "").toLowerCase().includes(wsSearch.trim().toLowerCase()))
                                .map(w => (
                                    <div className="v3-ws-panel__item" key={w.workspaceId}>
                                        <button type="button" className="v3-ws-panel__item-main" onClick={() => { setWsManagerOpen(false); switchWorkspace(w.workspaceId); }} disabled={recordingActive}>
                                            <b>{w.module || "Workspace"}{w.workspaceId === workspace.workspaceId ? " (hiện tại)" : ""}</b>
                                            <span>{w.selectedCount} testcase · Cập nhật {formatUpdatedAt(w.updatedAt)}</span>
                                        </button>
                                        <span className="v3-ws-panel__menu">
                                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => { setWsManagerOpen(false); switchWorkspace(w.workspaceId); }} disabled={recordingActive}>Mở</button>
                                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini v3-ws-panel__danger" onClick={() => confirmDeleteWorkspace(w)}>Xóa</button>
                                        </span>
                                    </div>
                                ))}
                            {workspaceList.length === 0 ? <p className="v3-act__note">Chưa có workspace nào.</p> : null}
                        </div>
                        <div className="v3-dialog__actions">
                            <button type="button" className="v3-btn v3-btn--ghost" onClick={() => setWsManagerOpen(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            ) : null}

            <V3ConfirmDialog
                open={Boolean(confirm)}
                title={confirm?.title ?? ""}
                message={confirm?.message ?? ""}
                confirmLabel={confirm?.kind === "delete"
                    ? "Xóa recording"
                    : confirm?.kind === "delete_workspace"
                        ? "Xóa workspace"
                        : confirm?.kind === "remove_testcase"
                            ? "Loại khỏi workspace"
                            : confirm?.kind === "new_workspace"
                                ? "Tạo workspace mới"
                                : "Từ chối recording"}
                danger={confirm?.kind === "delete"}
                busy={busy}
                onCancel={() => setConfirm(null)}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
