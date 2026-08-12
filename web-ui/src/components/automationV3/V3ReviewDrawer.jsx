import { useEffect, useState } from "react";
import { saveTestData } from "../../api/automationV3Api.js";
import { canGenerateForTestcase, generateGateReason } from "../../utils/automationV3.js";
import V3ExpectedResultTab from "./V3ExpectedResultTab.jsx";
import V3ActionSetupPanel from "./V3ActionSetupPanel.jsx";
import { isSensitiveField } from "../../utils/sensitive.js";

/*
 V3ReviewDrawer — Drawer (6C + 6C.1: TESTCASE luôn là context chính).

   Header: TCxxx · tên testcase + Expected Result ngắn + trạng thái automation (giữ ở mọi tab)
   Tabs  : Thông tin | Thao tác | Kết quả mong đợi
     - KHÔNG còn tab Recording như primary workflow (6C.1: recording chỉ là source/evidence;
       "Xem bản ghi nguồn" read-only nằm trong expand của thao tác).
     - KHÔNG còn "Duyệt recording" (không business gate thứ hai sau Xác nhận thao tác).
   Footer: [Đóng] + [Sinh automation] (chỉ ở tab Kết quả mong đợi, khi đủ gate:
     chọn Automation + TẤT CẢ thao tác CONFIRMED + ≥1 assertion TESTER_CONFIRMED).
*/

export default function V3ReviewDrawer({ workspaceId, testCase, initialTab = "actions", onClose, onGenerate, onRun, onChanged, onError, generateResult = null, runResult = null }) {
    const [tab, setTab] = useState(initialTab);
    // P0-A — Test Data editor: bản nháp local; save qua API (persist workspace, không sửa approved).
    const [tdDraft, setTdDraft] = useState(null); // { "<field>": "<value>" }
    const [tdSaving, setTdSaving] = useState(false);
    const tdApproved = testCase?.testData ?? null;

    // Đồng bộ draft khi testcase đổi.
    useEffect(() => {
        const td = tdApproved;
        if (!td || typeof td !== "object") { setTdDraft({}); return; }
        const entries = [];
        if (td.fields && typeof td.fields === "object") {
            for (const [k, f] of Object.entries(td.fields)) entries.push([k, f && typeof f === "object" ? f.value : f]);
        } else if (td.inputs && typeof td.inputs === "object") {
            for (const [k, v] of Object.entries(td.inputs)) entries.push([k, v]);
        } else {
            for (const [k, v] of Object.entries(td)) entries.push([k, v]);
        }
        const merged = {};
        for (const [k, v] of entries) merged[k] = String(v ?? "");
        // Ưu tiên confirmedTestData (tester đã edit) khi có.
        const confirmed = testCase?.confirmedTestData ?? null;
        if (confirmed && typeof confirmed === "object") {
            for (const [k, v] of Object.entries(confirmed)) if (Object.prototype.hasOwnProperty.call(merged, k)) merged[k] = String(v ?? "");
        }
        setTdDraft(merged);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [testCase?.testCaseId]);

    const persistTd = async next => {
        if (tdSaving) return;
        setTdSaving(true);
        try {
            await saveTestData(workspaceId, testCase.testCaseId, next ?? tdDraft ?? {});
            onChanged?.();
        } catch (e) {
            onError?.(e?.message ?? "Không lưu được dữ liệu kiểm thử.");
        } finally {
            setTdSaving(false);
        }
    };

    /** P0-A UX — helper: approved values (chỉ business data từ testcase.fields). */
    const approvedTdValues = () => {
        const td = tdApproved;
        const out = {};
        if (td?.fields && typeof td.fields === "object") {
            for (const [k, f] of Object.entries(td.fields)) out[k] = String(f && typeof f === "object" ? f.value : f ?? "");
        } else if (td?.inputs && typeof td.inputs === "object") {
            for (const [k, v] of Object.entries(td.inputs)) out[k] = String(v ?? "");
        }
        return out;
    };
    // Automation data đã khác approved? (để hiện [Khôi phục] chỉ khi cần)
    const tdConfirmed = testCase?.confirmedTestData ?? null;
    const tdHasEdited = Boolean(
        tdConfirmed && typeof tdConfirmed === "object" &&
        Object.keys(tdConfirmed).length > 0 &&
        Object.entries(tdConfirmed).some(([k, v]) => approvedTdValues()[k] !== String(v ?? ""))
    );

    const canGenerate = canGenerateForTestcase(testCase);
    const gateReason = generateGateReason(testCase);
    const expected = String(testCase.expectedResult ?? "").trim();
    const segCount = testCase.segmentSummary?.total ?? 0;

    return (
        <div className="v3-drawer" role="dialog" aria-modal="true" aria-label={`Automation ${testCase.testCaseId}`}>
            <div className="v3-drawer__head">
                <div>
                    <b>{testCase.testCaseId} · {testCase.title}</b>
                    <div className="v3-drawer__sub">
                        {expected ? <span>Kết quả mong đợi: {expected.length > 70 ? `${expected.slice(0, 70)}…` : expected}</span> : null}
                        <span>Automation: {segCount > 0 ? "Đang thiết lập" : "Chưa thiết lập"}</span>
                    </div>
                </div>
                <button type="button" className="v3-drawer__close" onClick={onClose} aria-label="Đóng">✕</button>
            </div>

            <div className="v3-drawer__tabs">
                <button type="button" className={`v3-drawer__tab${tab === "info" ? " v3-drawer__tab--on" : ""}`} onClick={() => setTab("info")}>
                    Thông tin
                </button>
                {testCase.selectedForAutomation ? (
                    <button type="button" className={`v3-drawer__tab${tab === "actions" ? " v3-drawer__tab--on" : ""}`} onClick={() => setTab("actions")}>
                        Thao tác
                    </button>
                ) : null}
                {testCase.selectedForAutomation ? (
                    <button type="button" className={`v3-drawer__tab${tab === "expected" ? " v3-drawer__tab--on" : ""}`} onClick={() => setTab("expected")}>
                        Kết quả mong đợi
                    </button>
                ) : null}
                {testCase.selectedForAutomation ? (
                    <button type="button" className={`v3-drawer__tab${tab === "run" ? " v3-drawer__tab--on" : ""}`} onClick={() => setTab("run")}>
                        Chạy thử
                    </button>
                ) : null}
            </div>

            <div className="v3-drawer__body">
                {tab === "info" ? (
                    <div className="v3-info-tab v3-info-tab--compact">
                        <div className="v3-info-row"><span>TC</span><b>{testCase.testCaseId} · {testCase.type}</b></div>
                        <div className="v3-info-row"><span>Tiêu đề</span><b>{testCase.title}</b></div>
                        <div className="v3-info-row"><span>Module</span><b>{testCase.module || "—"}</b></div>
                        {/* P0-A — DỮ LIỆU KIỂM THỬ: editable (tester edit cho lần automation);
                            approved giữ nguyên; [Khôi phục dữ liệu testcase] trả về approved. */}
                        <div className="v3-info-td">
                            <div className="v3-info-td__head">DỮ LIỆU KIỂM THỬ</div>
                            {(() => {
                                const draft = tdDraft ?? {};
                                const keys = Object.keys(draft);
                                if (keys.length === 0) {
                                    return <p className="v3-act__note">Testcase chưa có dữ liệu kiểm thử.</p>;
                                }
                                return (
                                    <>
                                        {keys.map(k => (
                                            <label className="v3-td-field" key={k}>
                                                <span>{k}</span>
                                                <input
                                                    className="v3-input"
                                                    type={isSensitiveField(k) ? "password" : "text"}
                                                    value={draft[k] ?? ""}
                                                    disabled={tdSaving}
                                                    onChange={e => setTdDraft(d => ({ ...d, [k]: e.target.value }))}
                                                />
                                            </label>
                                        ))}
                                        <div className="v3-td-actions">
                                            {/* P0-A UX — [Lưu dữ liệu] là primary (lưu automation-specific, không sửa approved). */}
                                            <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={tdSaving} onClick={() => persistTd()}>
                                                {tdSaving ? "Đang lưu…" : "Lưu dữ liệu"}
                                            </button>
                                            {/* [Khôi phục] secondary — CHỈ hiện khi approved có value và automation data đã khác approved. */}
                                            {Object.keys(approvedTdValues()).length > 0 && tdHasEdited ? (
                                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={tdSaving} onClick={() => {
                                                    const restored = approvedTdValues();
                                                    setTdDraft(restored);
                                                    persistTd(restored);
                                                }}>
                                                    Khôi phục dữ liệu testcase
                                                </button>
                                            ) : null}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="v3-info-row"><span>Automation</span><b>{segCount > 0 ? "Đang thiết lập" : "Chưa thiết lập"}</b></div>
                        {expected ? <div className="v3-info-row"><span>Kết quả mong đợi</span><b>{expected}</b></div> : null}
                    </div>
                ) : tab === "actions" ? (
                    <V3ActionSetupPanel workspaceId={workspaceId} testCase={testCase} onChanged={onChanged} onError={onError} />
                ) : tab === "run" ? (
                    <div className="v3-run-tab">
                        <h4 className="v3-map__h">Chạy thử</h4>
                        {/* Test Data hiện tại */}
                        <div className="v3-exp__block">
                            <h4 className="v3-exp__h">Test Data hiện tại</h4>
                            {(() => {
                                const conf = testCase?.confirmedTestData ?? null;
                                const appr = testCase?.testData?.fields ?? null;
                                const entries = [];
                                if (conf && typeof conf === "object") for (const [k, v] of Object.entries(conf)) entries.push([k, v]);
                                else if (appr && typeof appr === "object") for (const [k, f] of Object.entries(appr)) entries.push([k, f && typeof f === "object" ? f.value : f]);
                                if (entries.length === 0) return <p className="v3-act__note">Testcase chưa có dữ liệu kiểm thử.</p>;
                                return entries.map(([k, v]) => <div className="v3-info-row" key={k}><span>{k}</span><b>{String(v ?? "—")}</b></div>);
                            })()}
                        </div>
                        {/* Action sequence */}
                        <div className="v3-exp__block">
                            <h4 className="v3-exp__h">Thao tác</h4>
                            {testCase?.segments?.length > 0 ? (
                                testCase.segments.map(s => <div className="v3-info-row" key={s.segmentId}><span>{s.orderInTestCase}.</span><b>{s.label ?? s.segmentId}</b></div>)
                            ) : <p className="v3-act__note">Chưa chọn thao tác.</p>}
                        </div>
                        {/* Điều kiện kiểm tra đã xác nhận */}
                        <div className="v3-exp__block">
                            <h4 className="v3-exp__h">Điều kiện kiểm tra đã xác nhận</h4>
                            {testCase?.assertionStatus?.confirmed > 0 ? (
                                <span className="v3-ok">✓ {testCase.assertionStatus.confirmed} điều kiện đã xác nhận</span>
                            ) : <p className="v3-act__note">Chưa có điều kiện kiểm tra được xác nhận.</p>}
                        </div>
                        {/* Generated source */}
                        <div className="v3-exp__block">
                            <h4 className="v3-exp__h">Playwright</h4>
                            {testCase?.generateStatus === "GENERATED" && generateResult?.ok ? (
                                <>
                                    <p className="v3-act__note">{generateResult.fileName}</p>
                                    <details className="v3-act__raw"><summary>Xem script</summary><pre className="v3-exp__stmt" style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>{generateResult.code}</pre></details>
                                    <div className="v3-td-actions">
                                        <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={() => onRun?.(testCase)} disabled={!onRun}>
                                            Chạy thử
                                        </button>
                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => {
                                            const blob = new Blob([generateResult.code], { type: "text/javascript;charset=utf-8" });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url; a.download = generateResult.fileName;
                                            document.body.appendChild(a); a.click(); a.remove();
                                            URL.revokeObjectURL(url);
                                        }}>Lưu file .spec.js</button>
                                    </div>
                                </>
                            ) : testCase?.generateStatus === "GENERATED" ? (
                                <>
                                    <p className="v3-act__note">{testCase.generatedFile?.split("/").pop() ?? `${testCase.testCaseId}.spec.js`}</p>
                                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={() => onGenerate?.(testCase)}>Sinh lại Playwright</button>
                                </>
                            ) : (
                                <>
                                    <p className="v3-act__note">Chưa có script. Hãy Sinh Playwright trước khi chạy thử.</p>
                                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={() => onGenerate?.(testCase)}>Sinh Playwright</button>
                                </>
                            )}
                        </div>
                        {/* Kết quả run */}
                        {runResult ? (
                            <div className={`v3-run-result ${runResult.ok && runResult.passed ? "v3-run-result--pass" : "v3-run-result--fail"}`}>
                                <strong>{runResult.ok && runResult.passed ? "PASS" : runResult.error ? "FAIL" : "LỖI"}</strong>
                                {runResult.error ? <span>{String(runResult.error)}</span> : null}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <V3ExpectedResultTab workspaceId={workspaceId} testCase={testCase} onChanged={onChanged} onError={onError} />
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
                ) : null}
            </div>
        </div>
    );
}
