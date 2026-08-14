import { useState } from "react";
import { saveStepDecision, saveTestData } from "../../api/automationV3Api.js";
import { isSetupField } from "../../utils/setupFields.js";
import { ACTION_LABEL } from "../../utils/automationV3.js";
import { fieldEntry } from "../../utils/testDataView.js";

/*
 V3StepReviewSection — "Cần bạn xác nhận" (P0, workspace/testcase scope).

 Vùng RIÊNG (KHÔNG trộn vào DỮ LIỆU KIỂM THỬ / business Test Data editor).
 Chỉ xuất hiện khi còn FILL step UNRESOLVED (chưa đủ data/intent để Generate).

 Flow: XÁC ĐỊNH FIELD → XÁC ĐỊNH VALUE.
   Case 1 — technical chưa map (VD 'TextInput'): UI hỏi "Thao tác này đang nhập
     dữ liệu cho trường nào?" với dropdown business fields của testcase hiện tại
     (KHÔNG hard-code) + [Không thuộc testcase]. Technical (target/locator/order/
     blockId/recorded) chỉ hiện dưới "▸ Xem thông tin kỹ thuật" (collapse).
   Case 2 — business field đã biết (VD 'Ghi chú'): hiện tên field + giá trị khi ghi
     + input "Giá trị dùng khi chạy testcase" + [ ] Để trống.
   Case 3 — Không thuộc testcase → EXCLUDE (bỏ step khỏi testcase/workspace này).

 MAPPING (1 source of truth — KHÔNG duplicate):
   - technical input → business field: lưu vào testDataBindings[target] = field
     (canonical binding model { stepTarget: businessField } — autoBind cũng ghi đây).
   - value/intent: lưu vào confirmedTestData[field] (business test data chuẩn).
   Cả hai qua 1 call saveTestData({ field: {value,intent} }, { target: field }).
   KHÔNG lưu businessField trong stepDecisions (tránh 2 nơi độc lập).
   stepDecisions chỉ giữ EXCLUDE (workspace scope; không mutate Action Library).
*/

export default function V3StepReviewSection({ workspaceId, testCase, onChanged, onError }) {
    const [busyKey, setBusyKey] = useState(null);
    const [selectedField, setSelectedField] = useState({}); // key -> field (dropdown)
    const [valueDraft, setValueDraft] = useState({}); // key -> string
    const [emptyDraft, setEmptyDraft] = useState({}); // key -> bool

    const decisions = testCase?.stepDecisions ?? {};
    const confirmed = testCase?.confirmedTestData ?? null;
    const approved = testCase?.testData?.fields ?? {};
    const approvedKeys = Object.keys(approved);
    const approvedKeySet = new Set(approvedKeys);
    const bindings = testCase?.testDataBindings ?? {};

    // Business fields cho dropdown: approved keys (non-setup). KHÔNG hard-code.
    const businessFieldOptions = approvedKeys.filter(k => !isSetupField(k));

    // Trường đã resolve (có data) tại field → business editor lo; không hiện ở đây.
    const resolvedAt = field => {
        const e = fieldEntry(confirmed?.[field]);
        if (e.intent === "EMPTY") return true;
        if (e.intent === "VALUE" && e.value.trim() !== "") return true;
        const apprRaw = approved?.[field] != null && typeof approved[field] === "object" ? approved[field].value : approved?.[field];
        return apprRaw !== undefined && apprRaw !== null && String(apprRaw).trim() !== "";
    };

    // FILL steps UNRESOLVED: field = binding[target] || target; không setup; chưa resolve.
    const candidates = [];
    for (const seg of testCase?.segments ?? []) {
        for (const step of seg?.steps ?? []) {
            if (String(step?.actionType ?? "").toUpperCase() !== "FILL") continue;
            const t = String(step?.target ?? "").trim();
            if (!t || isSetupField(t)) continue;
            const field = bindings[t] || t;
            if (resolvedAt(field)) continue;
            candidates.push({
                blockId: seg.segmentId,
                order: step.order,
                actionType: String(step.actionType ?? "").toUpperCase(),
                target: t,
                field,
                knownField: approvedKeySet.has(field),
                locator: String(step.locator ?? ""),
                recordedValue: step.recordedValue ?? "",
                source: seg.label ?? seg.segmentId
            });
        }
    }
    if (candidates.length === 0) return null;

    const keyOf = c => `${c.blockId}:${c.order}`;
    const decisionOf = c => decisions[keyOf(c)] ?? null;

    const preload = (c, field) => {
        const e = fieldEntry(confirmed?.[field]);
        const apprRaw = approved?.[field] != null && typeof approved[field] === "object" ? approved[field].value : approved?.[field];
        return {
            value: e.intent === "EMPTY" ? "" : (e.value || String(apprRaw ?? "")),
            empty: e.intent === "EMPTY"
        };
    };

    const chooseField = (c, field) => {
        const k = keyOf(c);
        setSelectedField(s => ({ ...s, [k]: field }));
        const p = preload(c, field);
        setValueDraft(v => ({ ...v, [k]: p.value }));
        setEmptyDraft(e => ({ ...e, [k]: p.empty }));
    };

    const saveMapping = async (c, field, value, empty) => {
        const k = keyOf(c);
        setBusyKey(k);
        try {
            // 1 call: value vào confirmedTestData[field] + mapping vào testDataBindings[target].
            await saveTestData(workspaceId, testCase.testCaseId, {
                [field]: { value: empty ? "" : value, intent: empty ? "EMPTY" : "VALUE" }
            }, { [c.target]: field });
            onChanged?.();
        } catch (e) {
            onError?.(e?.message ?? "Không lưu được dữ liệu cho thao tác.");
        } finally {
            setBusyKey(null);
        }
    };

    const decide = async (c, decision) => {
        const k = keyOf(c);
        setBusyKey(k);
        try {
            await saveStepDecision(workspaceId, testCase.testCaseId, {
                blockId: c.blockId, stepOrder: c.order, decision
            });
            onChanged?.();
        } catch (e) {
            onError?.(e?.message ?? "Không lưu được quyết định thao tác.");
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <div className="v3-step-review">
            <h4 className="v3-map__h">Cần bạn xác nhận</h4>
            <p className="v3-act__note">
                Một số thao tác trong bản ghi chưa xác định rõ dữ liệu hoặc chưa biết có thuộc testcase này hay không.
                Quyết định chỉ áp dụng cho testcase/workspace này — không sửa Thư viện thao tác gốc.
            </p>
            {candidates.map(c => {
                const k = keyOf(c);
                const d = decisionOf(c);
                const busy = busyKey === k;
                const isExcluded = d?.status === "EXCLUDE";
                const fieldChosen = selectedField[k] ?? (c.knownField ? c.field : (bindings[c.target] ?? null));
                const p = preload(c, fieldChosen || c.field);
                const value = valueDraft[k] ?? p.value;
                const empty = emptyDraft[k] ?? p.empty;
                return (
                    <div className={`v3-step-review__item${isExcluded ? " v3-step-review__item--excluded" : ""}`} key={k}>
                        <div className="v3-step-review__head">
                            <div>
                                <b>{fieldChosen ? (c.knownField || bindings[c.target] ? fieldChosen : fieldChosen) : "Chưa xác định trường dữ liệu"}</b>
                                <span className="v3-act__note">
                                    {c.source} · bước {c.order} · {ACTION_LABEL[c.actionType] ?? c.actionType}
                                </span>
                                {c.recordedValue ? (
                                    <code className="v3-lib-viewer__value">Giá trị khi ghi: {JSON.stringify(c.recordedValue)}{c.recordedValue === "••••" ? " (nhạy cảm — đã che)" : ""}</code>
                                ) : null}
                                {/* Technical — CHỈ dưới collapse (không hiện ở main surface) */}
                                <details className="v3-act__tech"><summary>Xem thông tin kỹ thuật</summary>
                                    <code className="v3-exp__stmt">
                                        target: {c.target}{"\n"}locator: {c.locator || "—"}{"\n"}actionType: {c.actionType}{"\n"}step: {c.order}{"\n"}block: {c.blockId}
                                    </code>
                                </details>
                            </div>
                            <div className="v3-step-review__state">
                                {isExcluded ? <span className="v3-ok">Đã loại khỏi testcase này</span>
                                    : fieldChosen ? <span className="v3-warn">⚠ Cần xác nhận giá trị</span>
                                    : <span className="v3-warn">⚠ Chưa quyết định</span>}
                            </div>
                        </div>

                        {isExcluded ? (
                            <div className="v3-step-review__actions">
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => decide(c, "REVIEW_REQUIRED")}>Hoàn tác (đưa về chờ xác nhận)</button>
                            </div>
                        ) : !fieldChosen ? (
                            /* Case 1 — chưa biết field: hỏi "trường dữ liệu nào?" */
                            <>
                                <p className="v3-act__note"><b>Thao tác này đang nhập dữ liệu cho trường nào?</b></p>
                                <div className="v3-step-review__actions">
                                    <select
                                        className="v3-input"
                                        value=""
                                        disabled={busy}
                                        onChange={e => { if (e.target.value) chooseField(c, e.target.value); }}
                                        style={{ maxWidth: 280 }}
                                    >
                                        <option value="">Chọn trường dữ liệu ▼</option>
                                        {businessFieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => decide(c, "EXCLUDE")}>Không thuộc testcase</button>
                                </div>
                            </>
                        ) : (
                            /* Case 1 (đã chọn field) / Case 2 (field đã biết) — xác định VALUE */
                            <div className="v3-step-review__edit">
                                <p className="v3-act__note"><b>Giá trị dùng khi chạy testcase</b> — {fieldChosen}</p>
                                {empty ? (
                                    <em className="v3-act__note">Không nhập (để trống)</em>
                                ) : (
                                    <input
                                        className="v3-input"
                                        type="text"
                                        value={value}
                                        disabled={busy}
                                        onChange={e => setValueDraft(v => ({ ...v, [k]: e.target.value }))}
                                        placeholder="Giá trị dùng khi chạy testcase"
                                        style={{ maxWidth: 280 }}
                                    />
                                )}
                                <label className="v3-td-toggle">
                                    <input type="checkbox" checked={empty} disabled={busy} onChange={e => setEmptyDraft(em => ({ ...em, [k]: e.target.checked }))} /> <span>Để trống</span>
                                </label>
                                <div className="v3-step-review__actions">
                                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={busy || (!empty && !value.trim())} onClick={() => saveMapping(c, fieldChosen, value, empty)}>
                                        {busy ? "Đang lưu…" : "Lưu"}
                                    </button>
                                    {!c.knownField ? (
                                        <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => setSelectedField(s => ({ ...s, [k]: "" }))}>Đổi trường</button>
                                    ) : null}
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => decide(c, "EXCLUDE")}>Không thuộc testcase</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
