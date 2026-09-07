import { useEffect, useState } from "react";
import {
    getEntry, setTarget, setSensitiveOverrides, suggestValues, saveCandidates, runEntry, markDefect, previewSpec
} from "../api/boundaryTestingApi.js";
import { ACTION_LABEL } from "../utils/automationV3.js";

/*
 BoundaryEntryPanel — Kiểm thử biên (Boundary Testing), HOÀN TOÀN độc lập với Automation
 Workspace/Action Library. Panel chi tiết 1 entry (script đã dán), theo 3 giai đoạn:

 1. Chưa đánh dấu mục tiêu (`entry.targetStep === null`) — hiện danh sách bước đã parse, tester
    chọn 1 bước FILL làm mục tiêu kiểm thử biên.
 2. Đã chọn mục tiêu nhưng còn bước FILL nhạy cảm KHÁC (Mật khẩu/Mã xác nhận...) chưa có giá trị
    thật (bị ẩn "REDACTED" lúc parse) — bắt buộc tester nhập lại trước khi tiếp tục, nếu không
    mọi lần chạy sẽ luôn fail sai lý do (sai mật khẩu, không phải vì giá trị biên đang test).
 3. Sẵn sàng — candidate editor + Chạy/Xem mã/Lịch sử chạy (giống thiết kế trước, chỉ đổi API
    sang entryId-based).
*/

function newLocalId() {
    return `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCandidate(c) {
    return {
        id: c.id ?? null,
        localId: c.id ?? newLocalId(),
        value: String(c.value ?? ""),
        source: c.source ?? "RULE_BASED",
        lastStatus: c.lastStatus ?? null,
        lastError: c.lastError ?? null,
        defectFlag: c.defectFlag ?? "UNREVIEWED",
        note: c.note ?? "",
        screenshotPath: c.screenshotPath ?? null
    };
}

function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const pad = n => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SOURCE_LABEL = { AI_SUGGESTED: "AI đề xuất", TESTER: "Tự thêm", RULE_BASED: "Gợi ý" };
const AI_ERROR_LABEL = {
    AI_PROVIDER_UNAVAILABLE: "AI chưa được cấu hình trên server — đang chỉ dùng gợi ý theo quy tắc.",
    AI_REQUEST_FAILED: "Không kết nối được AI — đang chỉ dùng gợi ý theo quy tắc.",
    AI_RESPONSE_INVALID: "AI phản hồi không đúng định dạng — đang chỉ dùng gợi ý theo quy tắc."
};

function otherSensitiveSteps(entry) {
    if (!entry?.targetStep) return [];
    return (entry.steps ?? []).filter(s => s.actionType === "FILL" && s.sensitive && s.order !== entry.targetStep.order);
}

function missingOverrides(entry) {
    return otherSensitiveSteps(entry).filter(s => !String(entry.sensitiveOverrides?.[s.order] ?? "").trim());
}

export default function BoundaryEntryPanel({ entryId, runBaseUrl = "", runnerAgentId = "", onError, onChanged }) {
    const [entry, setEntry] = useState(null);
    const [loading, setLoading] = useState(true);
    const [candidates, setCandidates] = useState([]);
    const [runs, setRuns] = useState([]);
    const [busy, setBusy] = useState(false);
    const [overrideDrafts, setOverrideDrafts] = useState({});
    const [previewCode, setPreviewCode] = useState("");
    const [previewBusy, setPreviewBusy] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [lightbox, setLightbox] = useState(null);

    async function reload() {
        setLoading(true);
        try {
            const e = await getEntry(entryId);
            setEntry(e);
            setPreviewCode("");
            if (e?.targetStep && missingOverrides(e).length === 0) {
                if (e.candidates.length > 0) {
                    setCandidates(e.candidates.map(normalizeCandidate));
                    setRuns(e.runs ?? []);
                } else {
                    const suggested = await suggestValues(entryId);
                    setCandidates((suggested?.candidates ?? []).map(normalizeCandidate));
                    setRuns([]);
                    setAiError(suggested?.aiError ?? null);
                }
            }
        } catch (err) {
            onError?.(err?.message ?? "Không tải được kiểm thử biên.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entryId]);

    async function pickTarget(stepOrder) {
        setBusy(true);
        try {
            await setTarget(entryId, stepOrder);
            await reload();
            onChanged?.();
        } catch (err) {
            onError?.(err?.message ?? "Không chọn được bước mục tiêu.");
        } finally {
            setBusy(false);
        }
    }

    async function saveOverrides() {
        setBusy(true);
        try {
            const merged = { ...(entry.sensitiveOverrides ?? {}), ...overrideDrafts };
            await setSensitiveOverrides(entryId, merged);
            await reload();
        } catch (err) {
            onError?.(err?.message ?? "Không lưu được giá trị.");
        } finally {
            setBusy(false);
        }
    }

    function updateLocal(localId, patch) {
        setCandidates(list => list.map(c => (c.localId === localId ? { ...c, ...patch } : c)));
    }

    function removeLocal(localId) {
        setCandidates(list => list.filter(c => c.localId !== localId));
    }

    function addBlank() {
        setCandidates(list => [...list, normalizeCandidate({ value: "", source: "TESTER" })]);
    }

    async function showPreview() {
        setPreviewBusy(true);
        try {
            const result = await previewSpec(entryId, candidates.map(c => ({ id: c.localId, value: c.value })));
            setPreviewCode(result?.code ?? "");
        } catch (err) {
            onError?.(err?.message ?? "Không xem trước được mã.");
        } finally {
            setPreviewBusy(false);
        }
    }

    /** Chạy TỪ XA (Ngân yêu cầu 2026-09-07): runEntry() trả QUEUED ngay, kết quả thật đến sau khi
     *  agent báo job xong (BoundaryTestingService#completeRemoteRun ghi thêm 1 "run" mới vào entry,
     *  y hệt luồng local). Poll getEntry() tới khi runs.length tăng — không có WebSocket, cùng quy
     *  ước AutomationV3Page.jsx đang poll getWorkspace() tới khi runStatus đổi trạng thái cuối. */
    async function pollUntilNewRun(runsBefore) {
        const deadline = Date.now() + 120000; // 2 phút — job kẹt thì dừng chờ, không poll vô hạn
        while (Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            let latest;
            try {
                latest = await getEntry(entryId);
            } catch {
                continue; // lỗi mạng tạm thời — thử lại ở vòng poll tiếp theo
            }
            if ((latest?.runs?.length ?? 0) > runsBefore) {
                setCandidates((latest.candidates ?? []).map(normalizeCandidate));
                setRuns(latest.runs ?? []);
                return;
            }
        }
        onError?.("Chưa nhận được kết quả từ máy Runner sau 2 phút — kiểm tra máy đó còn Online không, hoặc thử lại.");
    }

    /** candidateIds=null -> chạy TẤT CẢ; mảng id -> chỉ chạy tập con (nút "Chạy lại lỗi"). */
    async function persistAndRun(candidateIds = null) {
        setBusy(true);
        try {
            await saveCandidates(entryId, candidates.map(c => ({ id: c.id, value: c.value, source: c.source })));
            onChanged?.();
            const env = runBaseUrl.trim() ? { BASE_URL: runBaseUrl.trim() } : {};
            if (runnerAgentId) {
                const runsBefore = runs.length;
                await runEntry(entryId, candidateIds, env, runnerAgentId);
                await pollUntilNewRun(runsBefore);
            } else {
                const result = await runEntry(entryId, candidateIds, env);
                setCandidates(result.candidates.map(normalizeCandidate));
                setRuns(result.runs ?? []);
            }
            onChanged?.();
        } catch (err) {
            onError?.(err?.message ?? "Chạy kiểm thử biên thất bại.");
        } finally {
            setBusy(false);
        }
    }

    async function toggleDefect(candidate, defectFlag) {
        if (!candidate.id) return;
        updateLocal(candidate.localId, { defectFlag });
        try {
            await markDefect(entryId, candidate.id, { defectFlag });
        } catch (err) {
            onError?.(err?.message ?? "Không lưu được đánh giá.");
        }
    }

    async function saveNote(candidate, note) {
        if (!candidate.id) return;
        try {
            await markDefect(entryId, candidate.id, { note });
        } catch (err) {
            onError?.(err?.message ?? "Không lưu được ghi chú.");
        }
    }

    if (loading) return <p className="v3-act__note">Đang tải…</p>;
    if (!entry) return null;

    // ---- Giai đoạn 1: chưa chọn mục tiêu ----
    if (!entry.targetStep) {
        return (
            <div className="v3-boundary-detail">
                <div className="v3-boundary-detail__head">
                    <h3>{entry.label}</h3>
                    <p className="v3-act__note">Chọn 1 bước nhập liệu (Nhập) làm trường cần kiểm thử biên. Các bước khác sẽ được giữ nguyên khi chạy.</p>
                </div>
                <div className="v3-boundary-steps">
                    {entry.steps.map(s => (
                        <div className="v3-boundary-step" key={s.order}>
                            <span className="v3-boundary-step__n">{s.order}</span>
                            <span className="v3-boundary-step__act">{ACTION_LABEL[s.actionType] ?? s.actionType}</span>
                            <span className="v3-boundary-step__target">{s.target}{s.sensitive ? " (nhạy cảm)" : ""}</span>
                            {s.actionType === "FILL" ? (
                                <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={busy} onClick={() => pickTarget(s.order)}>
                                    Chọn làm mục tiêu
                                </button>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ---- Giai đoạn 2: còn field nhạy cảm khác chưa có giá trị thật ----
    const missing = missingOverrides(entry);
    if (missing.length > 0) {
        return (
            <div className="v3-boundary-detail">
                <div className="v3-boundary-detail__head">
                    <h3>{entry.label}</h3>
                    <p className="v3-act__note">Nhập giá trị thật cho các trường nhạy cảm khác trường mục tiêu:</p>
                </div>
                <div className="v3-boundary-detail__rows">
                    {missing.map(s => (
                        <div className="v3-boundary-row" key={s.order}>
                            <span>{s.target}</span>
                            <input
                                className="v3-input"
                                type="text"
                                placeholder="Giá trị dùng khi chạy"
                                value={overrideDrafts[s.order] ?? ""}
                                onChange={e => setOverrideDrafts(d => ({ ...d, [s.order]: e.target.value }))}
                            />
                        </div>
                    ))}
                </div>
                <div className="v3-boundary-detail__actions">
                    <button type="button" className="v3-btn v3-btn--primary" disabled={busy} onClick={saveOverrides}>Lưu</button>
                </div>
            </div>
        );
    }

    // ---- Giai đoạn 3: sẵn sàng — candidate editor ----
    const defectIds = candidates.filter(c => c.defectFlag === "DEFECT" && c.id).map(c => c.id);
    const hasResults = candidates.some(c => c.lastStatus);
    const aiCount = candidates.filter(c => c.source === "AI_SUGGESTED").length;

    return (
        <div className="v3-boundary-detail" aria-label={`Kiểm thử biên — ${entry.label}`}>
            <div className="v3-boundary-detail__head">
                <h3>{entry.label}</h3>
                <p className="v3-act__note">Trường đang kiểm thử: <code>{entry.targetStep.target}</code></p>
                <p className="v3-act__note v3-boundary-ai-status">
                    {aiCount > 0
                        ? `AI đã đề xuất thêm ${aiCount} giá trị bên dưới.`
                        : (aiError ? AI_ERROR_LABEL[aiError.code] ?? AI_ERROR_LABEL.AI_REQUEST_FAILED : "AI không có đề xuất thêm ngoài các gợi ý theo quy tắc bên dưới.")}
                </p>
            </div>

            <div className="v3-boundary-detail__rows">
                {candidates.map(c => (
                    <div className="v3-boundary-card" key={c.localId}>
                        <div className="v3-boundary-card__top">
                            <input
                                className="v3-input v3-boundary-card__value"
                                type="text"
                                value={c.value}
                                disabled={busy}
                                onChange={e => updateLocal(c.localId, { value: e.target.value })}
                                placeholder="Giá trị biên"
                            />
                            <span className={`v3-boundary-badge v3-boundary-badge--${c.source === "AI_SUGGESTED" ? "ai" : c.source === "TESTER" ? "tester" : "rule"}`}>
                                {SOURCE_LABEL[c.source] ?? "Gợi ý"}
                            </span>
                            {c.lastStatus ? (
                                <span className={`v3-boundary-status v3-boundary-status--${c.lastStatus === "PASSED" ? "pass" : "fail"}`}>
                                    {c.lastStatus === "PASSED" ? "Đạt" : "Không đạt"}
                                </span>
                            ) : <span className="v3-boundary-status v3-boundary-status--pending">Chưa chạy</span>}
                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini v3-boundary-card__remove" disabled={busy} onClick={() => removeLocal(c.localId)}>Xóa</button>
                        </div>

                        {c.lastStatus ? (
                            <div className="v3-boundary-card__result">
                                {c.screenshotPath ? (
                                    <button type="button" className="v3-boundary-shot" onClick={() => setLightbox(c.screenshotPath)} title="Xem ảnh lớn">
                                        <img src={c.screenshotPath} alt="Ảnh chụp màn hình sau khi nhập giá trị và chạy" loading="lazy" />
                                    </button>
                                ) : <p className="v3-act__note v3-boundary-card__no-shot">Không có ảnh chụp màn hình cho lần chạy này.</p>}
                                <div className="v3-boundary-card__review">
                                    <label className="v3-td-toggle">
                                        <input
                                            type="checkbox"
                                            checked={c.defectFlag === "DEFECT"}
                                            disabled={busy}
                                            onChange={e => toggleDefect(c, e.target.checked ? "DEFECT" : "UNREVIEWED")}
                                        /> <span>Lỗi thật</span>
                                    </label>
                                    <input
                                        className="v3-input"
                                        type="text"
                                        value={c.note}
                                        disabled={busy}
                                        placeholder="Ghi chú"
                                        onChange={e => updateLocal(c.localId, { note: e.target.value })}
                                        onBlur={e => saveNote(c, e.target.value)}
                                    />
                                    {c.lastStatus !== "PASSED" && c.lastError ? (
                                        <p className="v3-boundary-row__error">{c.lastError}</p>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ))}
                <div className="v3-boundary-detail__actions">
                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" disabled={busy} onClick={addBlank}>+ Thêm giá trị</button>
                </div>
            </div>

            <div className="v3-boundary-detail__actions">
                <button type="button" className="v3-btn v3-btn--ghost" disabled={previewBusy || candidates.length === 0} onClick={showPreview}>
                    {previewBusy ? "Đang tạo mã…" : "Xem mã sẽ chạy"}
                </button>
                <button type="button" className="v3-btn v3-btn--primary" disabled={busy || candidates.length === 0} onClick={() => persistAndRun(null)}>
                    {busy ? "Đang chạy…" : "Chạy"}
                </button>
                {hasResults ? (
                    <button type="button" className="v3-btn v3-btn--secondary" disabled={busy || defectIds.length === 0} onClick={() => persistAndRun(defectIds)}>
                        Chạy lại các giá trị đã đánh dấu lỗi
                    </button>
                ) : null}
                {runnerAgentId ? <span className="v3-act__note">Đang chạy trên máy Runner đã chọn (đổi ở menu tài khoản).</span> : null}
            </div>

            {previewCode ? (
                <details className="v3-act__raw" open>
                    <summary>Xem mã đã sinh — mỗi giá trị biên là 1 khối test() riêng, lặp lại đúng các bước trước đó, chỉ đổi dòng nhập giá trị của trường đang kiểm thử</summary>
                    <pre className="v3-exp__stmt" style={{ whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto" }}>{previewCode}</pre>
                </details>
            ) : null}

            <div className="v3-boundary-history">
                <h4 className="v3-exp__h">Lịch sử chạy {runs.length > 0 ? `(${runs.length})` : ""}</h4>
                {runs.length === 0 ? (
                    <p className="v3-act__note">Chưa có lần chạy nào.</p>
                ) : runs.map((run, i) => (
                    <details className="v3-boundary-run" key={run.runId} open={i === 0}>
                        <summary>
                            {formatDateTime(run.ranAt)} — <span className="v3-ok">{run.summary.passed} pass</span>
                            {run.summary.failed > 0 ? <> · <span className="v3-warn">{run.summary.failed} fail</span></> : null}
                        </summary>
                        <div className="v3-boundary-run__rows">
                            {run.results.map(r => (
                                <div className="v3-boundary-run__row" key={r.candidateId}>
                                    <div className="v3-info-row">
                                        <span><code>{r.value || "(rỗng)"}</code></span>
                                        <span className="v3-boundary-run__result">
                                            <span className={`v3-boundary-status v3-boundary-status--${r.status === "PASSED" ? "pass" : "fail"}`}>
                                                {r.status === "PASSED" ? "Đạt" : "Không đạt"}
                                            </span>
                                            {r.screenshotPath ? (
                                                <button type="button" className="v3-boundary-shot v3-boundary-shot--mini" onClick={() => setLightbox(r.screenshotPath)} title="Xem ảnh lớn">
                                                    <img src={r.screenshotPath} alt="Ảnh chụp màn hình" loading="lazy" />
                                                </button>
                                            ) : null}
                                        </span>
                                    </div>
                                    {r.status !== "PASSED" && r.errorMessage ? <p className="v3-boundary-row__error">{r.errorMessage}</p> : null}
                                </div>
                            ))}
                        </div>
                    </details>
                ))}
            </div>

            {lightbox ? (
                <div className="v3-boundary-lightbox" role="button" tabIndex={0} onClick={() => setLightbox(null)}>
                    <img src={lightbox} alt="Ảnh chụp màn hình phóng to" />
                </div>
            ) : null}
        </div>
    );
}
