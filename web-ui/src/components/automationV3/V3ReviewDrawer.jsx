import { useEffect, useState } from "react";
import { listRecordings, getRecordingDetail } from "../../api/automationV3Api.js";
import { canGenerateForTestcase, generateGateReason } from "../../utils/automationV3.js";
import V3RecordingTab from "./V3RecordingTab.jsx";
import V3ExpectedResultTab from "./V3ExpectedResultTab.jsx";
import V3ActionSetupPanel from "./V3ActionSetupPanel.jsx";

/*
 V3ReviewDrawer — Drawer (6C: TESTCASE luôn là context chính).

   Header: TCxxx · tên testcase + Expected Result + trạng thái automation (giữ ở mọi tab)
   Tabs  : Thông tin | Thao tác (6C) | Recording | Kết quả mong đợi (5C)
   Footer: [Đóng] + hành động chính theo tab:
     - Recording  → [Duyệt recording]
     - Kết quả mong đợi → [Sinh automation] (chỉ khi đủ gate: chọn Automation + thao tác CONFIRMED + ≥1 TESTER_CONFIRMED)
   Một primary action duy nhất — không Generate trên card.
*/

export default function V3ReviewDrawer({ workspaceId, testCase, initialTab = "recording", onClose, onApprove, onGenerate, onChanged, onError }) {
    const [tab, setTab] = useState(initialTab);
    const [versions, setVersions] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const list = await listRecordings(workspaceId, testCase.testCaseId);
                if (cancelled) return;
                const arr = Array.isArray(list) ? list : [];
                setVersions(arr);
                const latest = arr[0] ?? null;
                setSelectedId(latest?.recordingId ?? null);
                if (latest) {
                    const d = await getRecordingDetail(workspaceId, latest.recordingId);
                    if (!cancelled) setDetail(d);
                }
            } catch (e) {
                if (!cancelled) setError(e?.message ?? "Không tải được recording.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [workspaceId, testCase.testCaseId]);

    const selectVersion = async recordingId => {
        setSelectedId(recordingId);
        setDetail(null);
        setLoading(true);
        try {
            const d = await getRecordingDetail(workspaceId, recordingId);
            setDetail(d);
        } catch (e) {
            setError(e?.message ?? "Không tải được recording.");
        } finally {
            setLoading(false);
        }
    };

    const canGenerate = canGenerateForTestcase(testCase);
    const gateReason = generateGateReason(testCase);

    return (
        <div className="v3-drawer" role="dialog" aria-modal="true" aria-label={`Review ${testCase.testCaseId}`}>
            <div className="v3-drawer__head">
                <div>
                    <b>{testCase.testCaseId} · {testCase.title}</b>
                    <div className="v3-drawer__sub">
                        {testCase.expectedResult ? <span>Kết quả mong đợi: {testCase.expectedResult}</span> : null}
                        <span>Automation: {(testCase.segments?.length ?? 0) > 0 ? "Đang thiết lập" : "Chưa thiết lập"}</span>
                    </div>
                </div>
                <button type="button" className="v3-drawer__close" onClick={onClose} aria-label="Đóng">✕</button>
            </div>

            <div className="v3-drawer__tabs">
                <button
                    type="button"
                    className={`v3-drawer__tab${tab === "info" ? " v3-drawer__tab--on" : ""}`}
                    onClick={() => setTab("info")}
                >
                    Thông tin
                </button>
                {testCase.selectedForAutomation ? (
                    <button
                        type="button"
                        className={`v3-drawer__tab${tab === "actions" ? " v3-drawer__tab--on" : ""}`}
                        onClick={() => setTab("actions")}
                    >
                        Thao tác
                    </button>
                ) : null}
                <button
                    type="button"
                    className={`v3-drawer__tab${tab === "recording" ? " v3-drawer__tab--on" : ""}`}
                    onClick={() => setTab("recording")}
                >
                    Recording
                </button>
                {testCase.selectedForAutomation ? (
                    <button
                        type="button"
                        className={`v3-drawer__tab${tab === "expected" ? " v3-drawer__tab--on" : ""}`}
                        onClick={() => setTab("expected")}
                    >
                        Kết quả mong đợi
                    </button>
                ) : null}
            </div>

            <div className="v3-drawer__body">
                {error ? <div className="v3-banner v3-banner--error">{error}</div> : null}

                {tab === "info" ? (
                    <div className="v3-info-tab">
                        <div className="v3-info-row"><span>Testcase</span><b>{testCase.testCaseId}</b></div>
                        <div className="v3-info-row"><span>Tiêu đề</span><b>{testCase.title}</b></div>
                        <div className="v3-info-row"><span>Loại</span><b>{testCase.type}</b></div>
                        <div className="v3-info-row"><span>Module</span><b>{testCase.module || "—"}</b></div>
                        <div className="v3-info-row"><span>Trạng thái</span><b>{testCase.automationStatus ?? "—"}</b></div>
                    </div>
                ) : tab === "actions" ? (
                    <V3ActionSetupPanel
                        workspaceId={workspaceId}
                        testCase={testCase}
                        onChanged={onChanged}
                        onError={setError}
                    />
                ) : tab === "expected" ? (
                    <V3ExpectedResultTab
                        workspaceId={workspaceId}
                        testCase={testCase}
                        onChanged={onChanged}
                        onError={setError}
                    />
                ) : (
                    <>
                        {versions.length > 1 ? (
                            <div className="v3-versions">
                                <span className="v3-versions__label">Phiên bản:</span>
                                {versions.map(v => (
                                    <button
                                        key={v.recordingId}
                                        type="button"
                                        className={`v3-versions__chip${v.recordingId === selectedId ? " v3-versions__chip--on" : ""}`}
                                        onClick={() => selectVersion(v.recordingId)}
                                    >
                                        v{v.version ?? "?"}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                        <V3RecordingTab workspaceId={workspaceId} detail={detail} loading={loading} />
                    </>
                )}
            </div>

            <div className="v3-drawer__footer">
                <button type="button" className="v3-btn v3-btn--ghost" onClick={onClose}>Đóng</button>
                {tab === "expected" ? (
                    <button
                        type="button"
                        className="v3-btn v3-btn--primary"
                        disabled={!canGenerate}
                        title={gateReason ?? undefined}
                        onClick={() => onGenerate?.(testCase)}
                    >
                        Sinh automation
                    </button>
                ) : (
                    <button
                        type="button"
                        className="v3-btn v3-btn--primary"
                        disabled={!detail}
                        onClick={() => onApprove?.(detail)}
                    >
                        Duyệt recording
                    </button>
                )}
            </div>
        </div>
    );
}
