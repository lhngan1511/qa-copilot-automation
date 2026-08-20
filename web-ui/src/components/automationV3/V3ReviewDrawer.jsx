import { useEffect, useState } from "react";
import { saveTestData } from "../../api/automationV3Api.js";
import { ACTION_LABEL, canGenerateForTestcase, generateGateReason, automationDisplayStatus } from "../../utils/automationV3.js";
import V3ExpectedResultTab from "./V3ExpectedResultTab.jsx";
import V3ActionSetupPanel from "./V3ActionSetupPanel.jsx";
import V3StepReviewSection from "./V3StepReviewSection.jsx";
import { isSensitiveField } from "../../utils/sensitive.js";
import { isSetupField, isLoginTestCase } from "../../utils/setupFields.js";
import { infoBusinessKeys, runTestcaseDataRows, actionPrepStatus, fieldEntry } from "../../utils/testDataView.js";

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
    // P0 — canonical binding: { "<step.target>": "<businessField>" } (tester-owned; persist reload).
    const [tdBindings, setTdBindings] = useState(null);

    // P0-D1 — Generate SUCCESS → tự chuyển sang tab Chạy thử (không đóng drawer).
    useEffect(() => {
        if (generateResult?.ok) setTab("run");
    }, [generateResult]);
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
        // P0 TC001 — draft entries {value, intent}: approved non-empty = VALUE (business);
        // approved ""/null = UNRESOLVED (chưa intent — KHÔNG tự EMPTY); confirmed override.
        // P0 422-LIFECYCLE — giữ MỌI confirmed key (kể cả không nằm trong approved) khi save:
        // trước đây key ngoài approved bị drop khỏi draft -> save làm MẤT data đã xác nhận.
        const merged = {};
        const isLoginTc = isLoginTestCase(testCase?.title, testCase?.module);
        for (const [k, v] of entries) {
            if (isSetupField(k) && !isLoginTc) continue; // setup approved field -> ẩn (trừ testcase Login)
            const sv = v === undefined || v === null ? "" : String(v);
            merged[k] = { value: sv, intent: sv.trim() !== "" ? "VALUE" : "" };
        }
        const confirmed = testCase?.confirmedTestData ?? null;
        if (confirmed && typeof confirmed === "object") {
            for (const [k, v] of Object.entries(confirmed)) {
                if (isSetupField(k) && !isLoginTc) continue; // credential legacy — ẩn (trừ testcase Login)
                if (!Object.prototype.hasOwnProperty.call(merged, k)) merged[k] = { value: "", intent: "" };
                merged[k] = fieldEntry(v);
            }
        }
        setTdDraft(merged);
        setTdBindings(testCase?.testDataBindings ?? {});
        // P0 EMPTY-FIX — dep phải là testCase (object), KHÔNG chỉ testCaseId: sau khi vùng
        // "Cần bạn xác nhận" lưu EMPTY/VALUE (onChanged → refreshWorkspace → testCase mới),
        // draft phải REBUILD từ confirmed mới. Trước đây dep=[testCaseId] → draft state giữ
        // cũ (intent "") → [Lưu dữ liệu] ghi đè mất EMPTY → Generate lại fill/block.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [testCase]);

    const persistTd = async (next, bindingsOverride) => {
        if (tdSaving) return;
        setTdSaving(true);
        try {
            // P0 422-LIFECYCLE — drawer KHÔNG còn UI sửa binding (P0 simplify bỏ select):
            // KHÔNG gửi tdBindings (snapshot lúc MỞ drawer — có thể cũ) để tránh ghi đè binding
            // canonical backend. bindingsOverride chỉ dùng khi CHỦ ĐỘNG muốn đổi (VD Khôi phục).
            await saveTestData(workspaceId, testCase.testCaseId, next ?? tdDraft ?? {}, bindingsOverride ?? null);
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
    /** KEY-FIX — inputs từ selected actions: key CHÍNH XÁC renderer lookup (step.target). */
    const actionInputs = () => {
        const out = {};
        for (const seg of testCase?.segments ?? []) {
            for (const inp of seg.inputs ?? []) {
                const f = String(inp?.field ?? "").trim();
                if (f && !Object.prototype.hasOwnProperty.call(out, f)) out[f] = String(inp?.recordedValue ?? "");
            }
        }
        return out;
    };
    /** P0 (C) — setup inputs (Login env-bound LOGIN_*) KHÔNG xuất hiện trong business Test Data. */
    const businessActionInputs = () => {
        const all = actionInputs();
        const out = {};
        for (const [k, v] of Object.entries(all)) {
            if (isSetupField(k)) continue; // setup (Login) — dùng shared env, không là business data
            out[k] = v;
        }
        return out;
    };
    /** P0 (C) — approved fields: ẩn credential (Tài khoản/Mật khẩu/Mã xác nhận) TRỪ KHI testcase test Login. */
    const approvedBusinessValues = () => {
        const all = approvedTdValues();
        const out = {};
        const loginTc = isLoginTestCase(testCase?.title, testCase?.module);
        for (const [k, v] of Object.entries(all)) {
            if (isSetupField(k) && !loginTc) continue;
            out[k] = v;
        }
        return out;
    };
    // Automation data đã khác approved? (để hiện [Khôi phục] chỉ khi cần)
    // P0 TC001 — so sánh theo {value, intent} (entry object hoặc string cũ).
    const tdConfirmed = testCase?.confirmedTestData ?? null;
    const tdHasEdited = Boolean(
        tdConfirmed && typeof tdConfirmed === "object" &&
        Object.keys(tdConfirmed).length > 0 &&
        Object.entries(tdConfirmed).some(([k, v]) => {
            const e = fieldEntry(v);
            const apprV = approvedTdValues()[k];
            const apprEntry = { value: apprV ?? "", intent: apprV != null && String(apprV).trim() !== "" ? "VALUE" : "" };
            return e.value !== apprEntry.value || e.intent !== apprEntry.intent;
        })
    );

    const canGenerate = canGenerateForTestcase(testCase);
    const gateReason = generateGateReason(testCase);
    const expected = String(testCase.expectedResult ?? "").trim();
    const segCount = testCase.segmentSummary?.total ?? 0;

    return (
        <div className="v3-drawer" role="dialog" aria-modal="true" aria-label={`Automation ${testCase.testCaseId}`}>
            <div className="v3-drawer__head">
                <div>
                    <span className="v3-drawer__eyebrow">Chi tiết testcase</span>
                    <b>{testCase.testCaseId} · {testCase.title}</b>
                    <div className="v3-drawer__sub">
                        <span>Automation: {automationDisplayStatus(testCase)}</span>
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
                        <div className="v3-info-summary">
                            <div className="v3-info-summary__item"><span>Mã testcase</span><b>{testCase.testCaseId}</b></div>
                            <div className="v3-info-summary__item"><span>Loại</span><b>{testCase.type}</b></div>
                            <div className="v3-info-summary__item v3-info-summary__item--wide"><span>Module</span><b>{testCase.module || "—"}</b></div>
                        </div>
                        {/* P0-A — DỮ LIỆU KIỂM THỬ: editable (tester edit cho lần automation);
                            approved giữ nguyên; [Khôi phục dữ liệu testcase] trả về approved. */}
                        <div className="v3-info-td">
                            <div className="v3-info-td__head">DỮ LIỆU KIỂM THỬ</div>
                            {(() => {
                                const draft = tdDraft ?? {};
                                const bindings = { ...(testCase?.testDataBindings ?? {}), ...(tdBindings ?? {}) };
                                const actionInputs = businessActionInputs();
                                // P0 REGRESSION — CHỈ business fields (util testDataView): approved keys
                                // (đã lọc setup) + business field của binding. KHÔNG technical target,
                                // KHÔNG hint 'giá trị trong bản ghi' (recorded value kỹ thuật).
                                const businessKeys = infoBusinessKeys({
                                    approvedBusinessKeys: Object.keys(approvedBusinessValues()),
                                    bindings,
                                    actionInputs
                                });
                                if (businessKeys.length === 0) {
                                    return <p className="v3-act__note">Testcase chưa có dữ liệu kiểm thử.</p>;
                                }
                                return (
                                    <>
                                        <div className="v3-info-td__fields">{businessKeys.map(k => {
                                            // P0 TC001 — entry {value, intent}: VALUE (nhập) / EMPTY (Để trống) /
                                            // UNRESOLVED (chưa intent — cần review trước khi Sinh).
                                            const entry = draft[k] ?? { value: "", intent: "" };
                                            const isEmpty = entry.intent === "EMPTY";
                                            const isUnresolved = !isEmpty && String(entry.value ?? "").trim() === "";
                                            return (
                                                <div className="v3-td-field" key={k}>
                                                    <span>
                                                        {k}
                                                        {isUnresolved ? <span className="v3-exp__note v3-warn"> ⚠ cần review</span> : null}
                                                    </span>
                                                    {isEmpty ? (
                                                        <div className="v3-td-empty"><em>Không nhập (để trống)</em></div>
                                                    ) : (
                                                        <input
                                                            className="v3-input"
                                                            type={isSensitiveField(k) ? "password" : "text"}
                                                            value={entry.value ?? ""}
                                                            disabled={tdSaving}
                                                            onChange={e => setTdDraft(d => ({ ...d, [k]: { value: e.target.value, intent: "VALUE" } }))}
                                                        />
                                                    )}
                                                    <label className="v3-td-toggle">
                                                        <input
                                                            type="checkbox"
                                                            checked={isEmpty}
                                                            disabled={tdSaving}
                                                            onChange={e => setTdDraft(d => ({
                                                                ...d,
                                                                [k]: e.target.checked
                                                                    ? { value: "", intent: "EMPTY" }
                                                                    : { value: d?.[k]?.value ?? "", intent: "VALUE" }
                                                            }))}
                                                        /> <span>Để trống</span>
                                                    </label>
                                                </div>
                                            );
                                        })}</div>
                                        <div className="v3-td-actions">
                                            {/* P0-A UX — [Lưu dữ liệu] là primary (lưu automation-specific, không sửa approved). */}
                                            <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={tdSaving} onClick={() => persistTd()}>
                                                {tdSaving ? "Đang lưu…" : "Lưu dữ liệu"}
                                            </button>
                                            {/* [Khôi phục] secondary — CHỈ hiện khi approved có value và automation data đã khác approved. */}
                                            {Object.keys(approvedTdValues()).length > 0 && tdHasEdited ? (
                                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={tdSaving} onClick={() => {
                                                    const restored = {};
                                                    for (const [k, v] of Object.entries(approvedBusinessValues())) {
                                                        const sv = String(v ?? "");
                                                        restored[k] = { value: sv, intent: sv.trim() !== "" ? "VALUE" : "" };
                                                    }
                                                    setTdDraft(restored);
                                                    setTdBindings({});
                                                    persistTd(restored, {});
                                                }}>
                                                    Khôi phục dữ liệu testcase
                                                </button>
                                            ) : null}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="v3-info-row"><span>Automation</span><b>{automationDisplayStatus(testCase)}</b></div>
                        {expected ? <div className="v3-info-row"><span>Kết quả mong đợi</span><b>{expected}</b></div> : null}
                    </div>
                ) : tab === "actions" ? (
                    <>
                        {/* P0 — CẦN XÁC NHẬN THAO TÁC: vùng RIÊNG (không trộn business Test Data);
                            chỉ hiện khi có unresolved FILL target không map business field. */}
                        <V3StepReviewSection workspaceId={workspaceId} testCase={testCase} onChanged={onChanged} onError={onError} />
                        <V3ActionSetupPanel workspaceId={workspaceId} testCase={testCase} onChanged={onChanged} onError={onError} />
                    </>
                ) : tab === "run" ? (
                    <div className="v3-run-tab">
                        <h4 className="v3-map__h">Chạy thử</h4>
                        {/* P0 REGRESSION — DỮ LIỆU TESTCASE (chỉ business fields; không technical/setup).
                            P0 TC001 — state VALUE/EMPTY/UNRESOLVED: EMPTY hiện "—", UNRESOLVED "⚠ Cần review". */}
                        <div className="v3-exp__block">
                            <h4 className="v3-exp__h">DỮ LIỆU TESTCASE</h4>
                            {(() => {
                                const approvedPurpose = {};
                                for (const [k, f] of Object.entries(testCase?.testData?.fields ?? {})) approvedPurpose[k] = f?.purpose ?? "";
                                const rows = runTestcaseDataRows({
                                    approvedBusinessValues: approvedBusinessValues(),
                                    approvedPurpose,
                                    confirmedTestData: testCase?.confirmedTestData ?? null,
                                    bindings: { ...(testCase?.testDataBindings ?? {}) },
                                    actionInputs: businessActionInputs(),
                                    loginTestCase: isLoginTestCase(testCase?.title, testCase?.module)
                                });
                                if (rows.length === 0) return <p className="v3-act__note">Testcase chưa có dữ liệu kiểm thử.</p>;
                                return rows.map(({ key, value, state }) => (
                                    <div className="v3-info-row" key={key}>
                                        <span>{key}</span>
                                        <b className={state === "UNRESOLVED" ? "v3-warn" : state === "EMPTY" ? "v3-act__note" : ""}>{value}</b>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* P0 — DỮ LIỆU CHUẨN BỊ (per selected action: env/ready/missing). */}
                        <div className="v3-exp__block">
                            <h4 className="v3-exp__h">DỮ LIỆU CHUẨN BỊ</h4>
                            {testCase?.segments?.length > 0 ? (
                                testCase.segments.map(seg => {
                                    // P0 TC001 — singleInput: heuristic unique-business-field chỉ khi ĐÚNG 1 input.
                                    const actionInputs = businessActionInputs();
                                    const prep = actionPrepStatus({
                                        inputs: seg?.inputs ?? [],
                                        steps: seg?.steps ?? null,
                                        segmentId: seg?.segmentId ?? null,
                                        stepDecisions: testCase?.stepDecisions ?? null,
                                        bindings: { ...(testCase?.testDataBindings ?? {}) },
                                        confirmedTestData: testCase?.confirmedTestData ?? null,
                                        approvedFields: testCase?.testData?.fields ?? null,
                                        singleInput: Object.keys(actionInputs).length === 1
                                    });
                                    return (
                                        <div className="v3-info-row" key={seg.segmentId}>
                                            <span>{seg.label ?? seg.segmentId}</span>
                                            <b className={prep.status === "missing" ? "v3-warn" : prep.status === "env" ? "" : "v3-ok"}>{prep.text}</b>
                                        </div>
                                    );
                                })
                            ) : <p className="v3-act__note">Chưa chọn thao tác.</p>}
                        </div>
                        {/* Same Action -> Steps hierarchy consumed by GenerateService. */}
                        <div className="v3-exp__block">
                            <h4 className="v3-exp__h">Thao tác sẽ chạy</h4>
                            {testCase?.segments?.length > 0 ? (
                                testCase.segments.map(s => (
                                    <div className="v3-run-action" key={`${s.segmentId}:${s.orderInTestCase}`}>
                                        <div className="v3-run-action__title">
                                            <span>{s.orderInTestCase}.</span>
                                            <b>{s.label ?? s.segmentId}</b>
                                            <em>{Array.isArray(s.steps) ? `${s.steps.length} bước` : ""}</em>
                                        </div>
                                        {Array.isArray(s.steps) && s.steps.length > 0 ? (
                                            <ol className="v3-run-action__steps">
                                                {s.steps.map((step, index) => {
                                                    const action = ACTION_LABEL[step.actionType] ?? step.actionType ?? "";
                                                    const target = step.target || step.locator || "";
                                                    return <li key={`${s.segmentId}:${step.order ?? index}`}>{`${action}${target ? ` ${target}` : ""}`.trim()}</li>;
                                                })}
                                            </ol>
                                        ) : <p className="v3-act__note">Action chưa có bước thực thi.</p>}
                                    </div>
                                ))
                            ) : <p className="v3-act__note">Chưa chọn thao tác.</p>}
                        </div>
                        {/* P0-D1 — Kết quả đã chọn */}
                        <div className="v3-exp__block">
                            <h4 className="v3-exp__h">Kết quả đã chọn</h4>
                            {testCase?.assertionStatus?.confirmed > 0 ? (
                                <span className="v3-ok">✓ {testCase.assertionStatus.confirmed} kết quả đã chọn</span>
                            ) : <p className="v3-act__note">Chưa có kết quả dự kiến được chọn.</p>}
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
                        {/* Kết quả run — P0 RUNTIME FIX: PASS khi ok + passed (hoặc runStatus PASSED —
                            runner thật trả "PASSED"); luôn có chi tiết (error hoặc status + duration). */}
                        {runResult ? (
                            (() => {
                                const runPassed = Boolean(runResult.ok && (runResult.passed || runResult.runStatus === "PASSED"));
                                return (
                                    <div className={`v3-run-result ${runPassed ? "v3-run-result--pass" : "v3-run-result--fail"}`}>
                                        <strong>{runPassed ? "PASS" : runResult.error ? "FAIL" : "LỖI"}</strong>
                                        {runResult.error ? <span>{String(runResult.error)}</span> : runResult.runStatus ? (
                                            <span className="v3-act__note">{runResult.runStatus}{runResult.durationMs ? ` · ${(runResult.durationMs / 1000).toFixed(1)}s` : ""}</span>
                                        ) : null}
                                    </div>
                                );
                            })()
                        ) : null}
                    </div>
                ) : (
                    <V3ExpectedResultTab
                        workspaceId={workspaceId}
                        testCase={testCase}
                        onChanged={onChanged}
                        onError={onError}
                        onGenerate={onGenerate}
                        canGenerate={canGenerate}
                        gateReason={gateReason}
                        generateResult={generateResult}
                    />
                )}
            </div>

        </div>
    );
}
