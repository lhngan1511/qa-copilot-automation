import { useCallback, useEffect, useMemo, useState } from "react";
import {
    listAssertions,
    createAssertion,
    confirmAssertion,
    updateAssertion,
    removeAssertion,
    updateExpectedResult,
    suggestAssertions
} from "../../api/automationV3Api.js";
import {
    assertionTypeLabel,
    assertionStatusLabel,
    matcherLabel,
    ASSERTION_TYPE_OPTIONS,
    MATCHER_OPTIONS
} from "../../utils/automationV3.js";

/*
 V3ExpectedResultTab — Tab "Kết quả mong đợi" (Bước 5C, wireframe đã duyệt).

 Flow chốt:
   Xem Expected Result → [Chỉnh sửa] (working copy, không đụng approved)
   → [Đề xuất điều kiện xác nhận] (CHỦ ĐỘNG — không tự bung)
   → [Áp dụng] đề xuất → Nháp (DRAFT) → tester chỉnh → [Xác nhận]
   → ≥1 TESTER_CONFIRMED → [Sinh automation] (ở drawer footer, chỉ khi đủ gate)

 Nguyên tắc:
   - Expected Result do TESTER sở hữu; hệ thống chỉ đề xuất (deterministic, KHÔNG AI ở 5C).
   - KHÔNG heuristic mạnh: chỉ gợi ý nhẹ khi không tạo được candidate nào.
   - Sửa điều kiện đã xác nhận → quay về Nháp.
*/

const EMPTY_FORM = { type: "TEXT_VISIBLE", target: "", locator: "", expected: "", matcher: "toBeVisible" };

export default function V3ExpectedResultTab({ workspaceId, testCase, onChanged, onError }) {
    const [assertions, setAssertions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Expected Result
    const [editingExpected, setEditingExpected] = useState(false);
    const [expectedDraft, setExpectedDraft] = useState("");

    // Đề xuất
    const [suggestions, setSuggestions] = useState([]);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedAt, setSuggestedAt] = useState(null);

    // 6C.2 — Recorded candidates (tester đánh dấu trong Playwright recording — CANDIDATE, chưa xác nhận)
    const [recordedCandidates, setRecordedCandidates] = useState([]);
    const [dismissedCandidates, setDismissedCandidates] = useState(() => new Set()); // bỏ qua (session)

    // Form điều kiện (thêm tay / sửa)
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [editingId, setEditingId] = useState(null);
    const [removingId, setRemovingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState("");

    const expectedResult = testCase?.expectedResult ?? "";

    const refresh = useCallback(async () => {
        try {
            const list = await listAssertions(workspaceId, testCase.testCaseId);
            setAssertions(Array.isArray(list) ? list : []);
        } catch (e) {
            onError?.(e?.message ?? "Không tải được điều kiện xác nhận.");
        } finally {
            setLoading(false);
        }
    }, [workspaceId, testCase.testCaseId, onError]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const confirmedCount = useMemo(() => assertions.filter(a => a.status === "TESTER_CONFIRMED").length, [assertions]);
    const draftCount = useMemo(() => assertions.filter(a => a.status === "DRAFT").length, [assertions]);

    const notify = async () => {
        await refresh();
        onChanged?.();
    };

    /* ---------- Expected Result ---------- */

    const startEditExpected = () => {
        setExpectedDraft(expectedResult);
        setEditingExpected(true);
        setLocalError("");
    };

    const saveExpected = async () => {
        setSaving(true);
        setLocalError("");
        try {
            await updateExpectedResult(workspaceId, testCase.testCaseId, expectedDraft);
            setEditingExpected(false);
            setSuggestions([]);
            setSuggestedAt(null);
            await notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không lưu được kết quả mong đợi.");
        } finally {
            setSaving(false);
        }
    };

    /* ---------- Đề xuất (chủ động) ---------- */

    const handleSuggest = async () => {
        if (suggesting) return;
        setSuggesting(true);
        setLocalError("");
        try {
            const data = await suggestAssertions(workspaceId, testCase.testCaseId);
            setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
            // 6C.2 — recorded candidates từ suggest (chỉ những cái chưa bị bỏ qua).
            const all = Array.isArray(data.recordedCandidates) ? data.recordedCandidates : [];
            const existing = new Set(assertions.map(a => a.locator || a.target));
            const fresh = all.filter(c => !dismissedCandidates.has(c.id) && !existing.has(c.locator || c.target));
            setRecordedCandidates(fresh);
            setSuggestedAt(new Date());
        } catch (e) {
            setLocalError(e?.message ?? "Không đề xuất được điều kiện.");
        } finally {
            setSuggesting(false);
        }
    };

    /* ---------- 6C.2 — Recorded candidate: Xác nhận / Bỏ qua ---------- */

    const confirmRecordedCandidate = async candidate => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            // Tạo assertion chính thức source=RECORDED, status TESTER_CONFIRMED (giữ locator/matcher từ recording).
            await createAssertion(workspaceId, testCase.testCaseId, {
                type: candidate.type,
                target: candidate.target,
                locator: candidate.locator,
                expected: candidate.expected,
                matcher: candidate.matcher,
                source: "RECORDED",
                status: "TESTER_CONFIRMED"
            });
            setRecordedCandidates(prev => prev.filter(c => c.id !== candidate.id));
            await notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không xác nhận được điều kiện từ bản ghi.");
        } finally {
            setSaving(false);
        }
    };

    const dismissRecordedCandidate = candidate => {
        setDismissedCandidates(prev => new Set(prev).add(candidate.id));
        setRecordedCandidates(prev => prev.filter(c => c.id !== candidate.id));
    };

    const applySuggestion = async suggestion => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await createAssertion(workspaceId, testCase.testCaseId, {
                ...suggestion,
                status: "DRAFT",
                source: "SYSTEM_SUGGESTED"
            });
            setSuggestions(prev => prev.filter(s => !(s.matcher === suggestion.matcher && s.expected === suggestion.expected)));
            await notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không áp dụng được đề xuất.");
        } finally {
            setSaving(false);
        }
    };

    /* ---------- Điều kiện: xác nhận / sửa / xóa ---------- */

    const handleConfirm = async assertion => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await confirmAssertion(workspaceId, testCase.testCaseId, assertion.id);
            await notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không xác nhận được điều kiện.");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = assertion => {
        setEditingId(assertion.id);
        setForm({
            type: assertion.type ?? "TEXT_VISIBLE",
            target: assertion.target ?? "",
            locator: assertion.locator ?? "",
            expected: assertion.expected ?? "",
            matcher: assertion.matcher ?? "toBeVisible"
        });
        setShowForm(true);
        setLocalError("");
    };

    const startAdd = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setShowForm(true);
        setLocalError("");
    };

    const saveForm = async () => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            const payload = { ...form, source: editingId ? undefined : "TESTER_INPUT" };
            if (editingId) {
                await updateAssertion(workspaceId, testCase.testCaseId, editingId, payload);
            } else {
                await createAssertion(workspaceId, testCase.testCaseId, { ...payload, status: "DRAFT" });
            }
            setShowForm(false);
            setEditingId(null);
            await notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không lưu được điều kiện.");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async assertion => {
        if (removingId !== assertion.id) {
            setRemovingId(assertion.id);
            return;
        }
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await removeAssertion(workspaceId, testCase.testCaseId, assertion.id);
            setRemovingId(null);
            await notify();
        } catch (e) {
            setLocalError(e?.message ?? "Không xóa được điều kiện.");
        } finally {
            setSaving(false);
        }
    };

    const setFormField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    if (loading) return <div className="v3-note">Đang tải kết quả mong đợi…</div>;

    return (
        <div className="v3-exp">
            {localError ? <div className="v3-banner v3-banner--error" role="alert">{localError}</div> : null}

            {/* ---------- Expected Result ---------- */}
            <div className="v3-exp__block">
                <h4 className="v3-exp__h">Kết quả mong đợi (nghiệp vụ)</h4>
                {!editingExpected ? (
                    <>
                        <div className="v3-exp__value">{expectedResult || "(trống)"}</div>
                        <p className="v3-exp__note">
                            {testCase.expectedResultEdited
                                ? "Đã chỉnh sửa — bản lưu trong workspace, không đổi file testcase đã duyệt."
                                : "Bản gốc từ testcase đã duyệt. Chỉnh sửa chỉ lưu trong workspace."}
                        </p>
                        <button type="button" className="v3-btn v3-btn--ghost" onClick={startEditExpected} disabled={saving}>
                            Chỉnh sửa kết quả mong đợi
                        </button>
                    </>
                ) : (
                    <div className="v3-exp__edit">
                        <textarea
                            className="v3-input"
                            value={expectedDraft}
                            onChange={e => setExpectedDraft(e.target.value)}
                            rows={3}
                            placeholder="Ví dụ: Đăng nhập thành công và hiển thị &quot;Danh mục phần mềm quản lý&quot;"
                        />
                        <div className="v3-exp__actions">
                            <button type="button" className="v3-btn v3-btn--primary" onClick={saveExpected} disabled={saving}>
                                Lưu
                            </button>
                            <button type="button" className="v3-btn v3-btn--ghost" onClick={() => setEditingExpected(false)} disabled={saving}>
                                Hủy
                            </button>
                        </div>
                        <p className="v3-exp__note">Xóa trống → quay về bản gốc đã duyệt.</p>
                    </div>
                )}
            </div>

            {/* ---------- Đề xuất (chủ động) ---------- */}
            {/* ---------- 6C.2 — Điều kiện tìm thấy trong bản ghi (recorded candidates) ---------- */}
            <div className="v3-exp__block">
                <div className="v3-exp__row">
                    <h4 className="v3-exp__h">Điều kiện tìm thấy trong bản ghi</h4>
                    {recordedCandidates.length === 0 ? (
                        <span className="v3-exp__note">Không tìm thấy điều kiện xác nhận trong bản ghi.</span>
                    ) : null}
                </div>
                {recordedCandidates.map((c, i) => (
                    <div className="v3-cond" key={c.id}>
                        <div className="v3-cond__body">
                            <b>{i + 1}. {c.target} {c.matcher === "toBeHidden" ? "không hiển thị" : "hiển thị"}</b>
                            <div className="v3-cond__meta">
                                <span>Nguồn: Playwright recording</span>
                                {c.statement ? <span className="v3-exp__stmt">{c.statement}</span> : null}
                            </div>
                        </div>
                        <div className="v3-cond__actions">
                            <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={() => confirmRecordedCandidate(c)} disabled={saving}>
                                Xác nhận
                            </button>
                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => dismissRecordedCandidate(c)} disabled={saving}>
                                Bỏ qua
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="v3-exp__block">
                <div className="v3-exp__row">
                    <h4 className="v3-exp__h">Đề xuất điều kiện kiểm tra</h4>
                    <button
                        type="button"
                        className="v3-btn v3-btn--secondary v3-btn--mini"
                        onClick={handleSuggest}
                        disabled={suggesting || saving}
                    >
                        {suggesting ? "Đang đề xuất…" : "Đề xuất điều kiện xác nhận"}
                    </button>
                </div>

                {suggestedAt && suggestions.length === 0 ? (
                    <p className="v3-exp__note">
                        Chưa có gì để đề xuất từ kết quả mong đợi hiện tại. Bạn có thể{" "}
                        <b>bổ sung điều kiện kiểm tra thủ công</b>, hoặc chỉnh sửa kết quả mong đợi để hệ thống đề xuất phù hợp hơn.
                    </p>
                ) : null}

                {suggestions.map((s, i) => (
                    <div className="v3-sugg" key={`${s.matcher}-${s.expected}-${i}`}>
                        <div className="v3-sugg__body">
                            <b>{assertionTypeLabel(s.type)}</b>
                            <span>· {matcherLabel(s.matcher)}</span>
                            {s.target ? <div className="v3-sugg__target">Đối tượng: {s.target}</div> : null}
                            {s.expected ? <div className="v3-sugg__target">Giá trị: {s.expected}</div> : null}
                            <div className="v3-sugg__reason">{s.reason}</div>
                        </div>
                        <div className="v3-sugg__actions">
                            <button
                                type="button"
                                className="v3-btn v3-btn--primary v3-btn--mini"
                                onClick={() => applySuggestion(s)}
                                disabled={saving}
                            >
                                Áp dụng
                            </button>
                        </div>
                    </div>
                ))}
                {suggestedAt && suggestions.length > 0 ? (
                    <p className="v3-exp__note">Áp dụng = tạo điều kiện ở trạng thái Nháp — bạn xem và xác nhận sau.</p>
                ) : null}
            </div>

            {/* ---------- Điều kiện xác nhận ---------- */}
            <div className="v3-exp__block">
                <div className="v3-exp__row">
                    <h4 className="v3-exp__h">Điều kiện xác nhận</h4>
                    <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={startAdd} disabled={saving}>
                        + Bổ sung điều kiện kiểm tra
                    </button>
                </div>

                {assertions.length === 0 ? (
                    <p className="v3-exp__note">Chưa có điều kiện nào.</p>
                ) : (
                    assertions.map(a => (
                        <div className="v3-cond" key={a.id}>
                            <div className="v3-cond__body">
                                <b>{assertionTypeLabel(a.type)}</b>
                                <span className={`v3-badge ${a.status === "TESTER_CONFIRMED" ? "v3-badge--ok" : a.status === "DRAFT" ? "v3-badge--review" : "v3-badge--nosel"}`}>
                                    {assertionStatusLabel(a.status)}
                                </span>
                                <div className="v3-cond__meta">
                                    {a.target ? <span>Đối tượng: {a.target}</span> : null}
                                    {a.expected != null && a.expected !== "" ? <span>Giá trị: {a.expected}</span> : null}
                                    {a.matcher ? <span>{matcherLabel(a.matcher)}</span> : null}
                                </div>
                            </div>
                            <div className="v3-cond__actions">
                                {a.status === "DRAFT" ? (
                                    <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={() => handleConfirm(a)} disabled={saving}>
                                        Xác nhận
                                    </button>
                                ) : null}
                                <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => startEdit(a)} disabled={saving}>
                                    Chỉnh sửa
                                </button>
                                <button
                                    type="button"
                                    className={`v3-btn v3-btn--mini ${removingId === a.id ? "v3-btn--danger" : "v3-btn--ghost"}`}
                                    onClick={() => handleRemove(a)}
                                    disabled={saving}
                                >
                                    {removingId === a.id ? "Chắc chắn?" : "Xóa"}
                                </button>
                            </div>
                        </div>
                    ))
                )}

                {showForm ? (
                    <div className="v3-cond-form">
                        <h5 className="v3-exp__h">{editingId ? "Chỉnh sửa điều kiện" : "Điều kiện mới"}</h5>
                        <div className="v3-cond-form__grid">
                            <label className="v3-map__label">
                                Loại
                                <select className="v3-input" value={form.type} onChange={e => setFormField("type", e.target.value)}>
                                    {ASSERTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </label>
                            <label className="v3-map__label">
                                Matcher
                                <select className="v3-input" value={form.matcher} onChange={e => setFormField("matcher", e.target.value)}>
                                    {MATCHER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </label>
                            <label className="v3-map__label">
                                Đối tượng (nhãn nghiệp vụ)
                                <input className="v3-input" value={form.target} onChange={e => setFormField("target", e.target.value)} placeholder="VD: Danh mục phần mềm quản lý" />
                            </label>
                            <label className="v3-map__label">
                                Locator (tùy chọn)
                                <input className="v3-input" value={form.locator} onChange={e => setFormField("locator", e.target.value)} placeholder="page.getByText('...')" />
                            </label>
                            <label className="v3-map__label">
                                Giá trị kỳ vọng
                                <input className="v3-input" value={form.expected ?? ""} onChange={e => setFormField("expected", e.target.value)} placeholder="VD: Danh mục phần mềm quản lý" />
                            </label>
                        </div>
                        <div className="v3-exp__actions">
                            <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" onClick={saveForm} disabled={saving}>
                                {editingId ? "Lưu (quay về Nháp)" : "Tạo điều kiện"}
                            </button>
                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => { setShowForm(false); setEditingId(null); }} disabled={saving}>
                                Hủy
                            </button>
                        </div>
                    </div>
                ) : null}

                {confirmedCount > 0 ? (
                    <p className="v3-exp__ok">✓ Điều kiện xác nhận đã được tester xác nhận ({confirmedCount} điều kiện).</p>
                ) : (
                    <p className="v3-exp__note">
                        Cần ít nhất 1 điều kiện được xác nhận để Sinh automation. {draftCount > 0 ? `Còn ${draftCount} điều kiện ở trạng thái Nháp.` : ""}
                    </p>
                )}
            </div>
        </div>
    );
}
