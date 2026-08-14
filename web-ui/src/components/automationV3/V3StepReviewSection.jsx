import { useState } from "react";
import { saveStepDecision } from "../../api/automationV3Api.js";
import { isSetupField } from "../../utils/setupFields.js";
import { ACTION_LABEL } from "../../utils/automationV3.js";

/*
 V3StepReviewSection — CẦN XÁC NHẬN THAO TÁC (P0, READ + quyết định step).

 Vùng RIÊNG (KHÔNG trộn vào DỮ LIỆU KIỂM THỬ / business Test Data editor).
 Chỉ xuất hiện khi có unresolved FILL target không map được business field
 (technical target / accessible name từ recording — VD 'TextInput').

 Mỗi item:
   - Action source (label · bước order), loại thao tác, locator/target secondary,
     recorded sample (nếu có).
   - Tester quyết định:
       [Giữ thao tác]        → INCLUDE + xác nhận data (VALUE/EMPTY) cho chính step.
       [Không thuộc testcase] → EXCLUDE — bỏ step KHỎI testcase/workspace hiện tại
                                khi Generate (KHÔNG mutate Action Library/recording).

 Decision persist workspace-level (stepDecisions, identity "<blockId>:<order>");
 remove/re-add CÙNG Action không làm mất decision (blockId + snapshot steps ổn định).
*/

export default function V3StepReviewSection({ workspaceId, testCase, onChanged, onError }) {
    const [busyKey, setBusyKey] = useState(null);
    const [editingKey, setEditingKey] = useState(null); // "<blockId>:<order>" đang nhập data
    const [draftVal, setDraftVal] = useState("");
    const [draftEmpty, setDraftEmpty] = useState(false);

    const decisions = testCase?.stepDecisions ?? {};
    const approvedKeys = new Set(Object.keys(testCase?.testData?.fields ?? {}));
    const bindingTargets = new Set(Object.keys(testCase?.testDataBindings ?? {}));

    // FILL steps không resolve business (không ∈ approved keys / binding / setup) → cần review.
    const candidates = [];
    for (const seg of testCase?.segments ?? []) {
        for (const step of seg?.steps ?? []) {
            if (String(step?.actionType ?? "").toUpperCase() !== "FILL") continue;
            const t = String(step?.target ?? "").trim();
            if (!t || isSetupField(t)) continue;
            if (approvedKeys.has(t) || bindingTargets.has(t)) continue; // business / đã map — editor business lo
            candidates.push({
                blockId: seg.segmentId,
                order: step.order,
                actionType: String(step.actionType ?? "").toUpperCase(),
                target: t,
                locator: String(step.locator ?? ""),
                recordedValue: step.recordedValue ?? "",
                source: seg.label ?? seg.segmentId
            });
        }
    }
    if (candidates.length === 0) return null;

    const keyOf = c => `${c.blockId}:${c.order}`;
    const decisionOf = c => decisions[keyOf(c)] ?? null;

    const decide = async (c, decision, value = "", intent = "") => {
        setBusyKey(keyOf(c));
        try {
            await saveStepDecision(workspaceId, testCase.testCaseId, {
                blockId: c.blockId, stepOrder: c.order, decision, value, intent
            });
            onChanged?.();
        } catch (e) {
            onError?.(e?.message ?? "Không lưu được quyết định thao tác.");
        } finally {
            setBusyKey(null);
            setEditingKey(null);
            setDraftVal("");
            setDraftEmpty(false);
        }
    };

    const startEdit = c => {
        const d = decisionOf(c);
        setEditingKey(keyOf(c));
        setDraftVal(d?.value ?? "");
        setDraftEmpty(d?.intent === "EMPTY");
    };

    return (
        <div className="v3-step-review">
            <h4 className="v3-map__h">CẦN XÁC NHẬN THAO TÁC</h4>
            <p className="v3-act__note">
                Những input trong bản ghi chưa xác định được là dữ liệu nghiệp vụ nào. Hãy quyết định cho từng thao tác
                trước khi Sinh (quyết định chỉ áp dụng cho testcase/workspace này — không sửa Thư viện thao tác gốc).
            </p>
            {candidates.map(c => {
                const k = keyOf(c);
                const d = decisionOf(c);
                const busy = busyKey === k;
                const editing = editingKey === k;
                const isExcluded = d?.status === "EXCLUDE";
                const isIncluded = d?.status === "INCLUDE";
                return (
                    <div className={`v3-step-review__item${isExcluded ? " v3-step-review__item--excluded" : ""}${isIncluded ? " v3-step-review__item--included" : ""}`} key={k}>
                        <div className="v3-step-review__head">
                            <div>
                                <b>Input chưa xác định</b>
                                <span className="v3-act__note">
                                    Nguồn: {c.source} · bước {c.order} · {ACTION_LABEL[c.actionType] ?? c.actionType}
                                </span>
                                {c.recordedValue ? (
                                    <code className="v3-lib-viewer__value">Giá trị trong bản ghi: {JSON.stringify(c.recordedValue)}{c.recordedValue === "••••" ? " (nhạy cảm — đã che)" : ""}</code>
                                ) : null}
                                <span className="v3-act__note">Kỹ thuật: {c.target}{c.locator ? ` · ${c.locator}` : ""}</span>
                            </div>
                            <div className="v3-step-review__state">
                                {isExcluded ? <span className="v3-ok">Đã loại khỏi testcase</span>
                                    : isIncluded ? <span className="v3-ok">Đã giữ — {d?.intent === "EMPTY" ? "Để trống" : `"${d?.value ?? ""}"`}</span>
                                    : <span className="v3-warn">⚠ Chưa quyết định</span>}
                            </div>
                        </div>

                        {isIncluded && !editing ? (
                            <div className="v3-step-review__actions">
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => startEdit(c)}>Sửa</button>
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => decide(c, "REVIEW_REQUIRED")}>Bỏ quyết định</button>
                            </div>
                        ) : isExcluded ? (
                            <div className="v3-step-review__actions">
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => decide(c, "REVIEW_REQUIRED")}>Hoàn tác (đưa về chờ xác nhận)</button>
                            </div>
                        ) : editing ? (
                            <div className="v3-step-review__edit">
                                {draftEmpty ? (
                                    <em className="v3-act__note">Không nhập (để trống)</em>
                                ) : (
                                    <input
                                        className="v3-input"
                                        type="text"
                                        value={draftVal}
                                        disabled={busy}
                                        onChange={e => setDraftVal(e.target.value)}
                                        placeholder="Giá trị cho bước này"
                                    />
                                )}
                                <label className="v3-td-toggle">
                                    <input type="checkbox" checked={draftEmpty} disabled={busy} onChange={e => setDraftEmpty(e.target.checked)} /> <span>Để trống</span>
                                </label>
                                <div className="v3-step-review__actions">
                                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={busy || (!draftEmpty && !draftVal.trim())} onClick={() => decide(c, "INCLUDE", draftEmpty ? "" : draftVal, draftEmpty ? "EMPTY" : "VALUE")}>
                                        {busy ? "Đang lưu…" : "Lưu — giữ thao tác"}
                                    </button>
                                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => setEditingKey(null)}>Hủy</button>
                                </div>
                            </div>
                        ) : (
                            <div className="v3-step-review__actions">
                                <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={busy} onClick={() => startEdit(c)}>Giữ thao tác</button>
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={() => decide(c, "EXCLUDE")}>Không thuộc testcase</button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
