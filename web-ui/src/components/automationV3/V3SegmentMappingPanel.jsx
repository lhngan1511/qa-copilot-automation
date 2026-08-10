import { useCallback, useEffect, useMemo, useState } from "react";
import {
    getRecordingDetail,
    createSegment,
    updateSegment,
    confirmSegment,
    deleteSegment,
    reorderTestCaseSegments
} from "../../api/automationV3Api.js";
import {
    ACTION_LABEL,
    validateSegmentRange,
    rangeLabel,
    findOverlap,
    unusedStepCount,
    segmentStatusLabel,
    segmentErrorMessage,
    canConfirmSegment
} from "../../utils/automationV3.js";

/*
 V3SegmentMappingPanel — "Gắn bản ghi testcase" + "Gán đoạn thao tác" (Bước 5C-0, wireframe đã duyệt).

 Một màn hình gộp:
   - Timeline các bước đã ghi (parser sinh order theo thứ tự thao tác).
   - Chọn Start step → End step → loại (Dùng chung / Testcase) → testcase → [Xác nhận đoạn].
   - "Các đoạn đã gán": xác nhận / sửa / xóa / sắp xếp ↑↓ (nhiều đoạn của 1 testcase).
   - Bước chưa thuộc đoạn nào: hiển thị thông tin, KHÔNG chặn (quyết định đã duyệt).

 Nguyên tắc cứng:
   - Mapping bằng testCaseId do tester gán — KHÔNG theo thứ tự/index.
   - Không dùng AI cho mapping.
   - Sửa đoạn đã xác nhận → tự quay về Nháp (quyết định đã duyệt).
*/

function stepRowKey(step) {
    return `s-${step.order ?? step.sourceLine ?? "?"}`;
}

export default function V3SegmentMappingPanel({
    workspaceId,
    recordingId,
    testCases = [],
    initialTestCaseId = null,
    onChanged,
    onClose,
    onError
}) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [localError, setLocalError] = useState("");

    // Form gán đoạn
    const [range, setRange] = useState(null); // { start, end }
    const [segType, setSegType] = useState("TESTCASE");
    const [testCaseId, setTestCaseId] = useState(initialTestCaseId ?? "");
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [saving, setSaving] = useState(false);

    const steps = useMemo(() => (detail?.steps ?? []), [detail]);
    const segments = useMemo(() => (detail?.segments ?? []), [detail]);

    const refresh = useCallback(async () => {
        const d = await getRecordingDetail(workspaceId, recordingId);
        setDetail(d);
        return d;
    }, [workspaceId, recordingId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLocalError("");
            try {
                const d = await getRecordingDetail(workspaceId, recordingId);
                if (!cancelled) setDetail(d);
            } catch (e) {
                if (!cancelled) setLocalError(e?.message ?? "Không tải được bản ghi.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [workspaceId, recordingId]);

    const unused = useMemo(() => unusedStepCount(steps, segments), [steps, segments]);

    const filteredTestCases = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = Array.isArray(testCases) ? testCases : [];
        if (!q) return list;
        return list.filter(tc =>
            String(tc.testCaseId ?? "").toLowerCase().includes(q)
            || String(tc.title ?? "").toLowerCase().includes(q)
        );
    }, [testCases, search]);

    const rangeInfo = useMemo(() => {
        if (!range || !Number.isInteger(range.start)) return null;
        return validateSegmentRange(steps.length, range.start, range.end);
    }, [range, steps]);

    const submitAllowed = canConfirmSegment({
        range: rangeInfo,
        segType,
        testCaseId,
        stepsCount: steps.length
    });

    const selectStep = order => {
        setLocalError("");
        if (!range || range.end) {
            setRange({ start: order, end: null });
            return;
        }
        setRange({ start: Math.min(range.start, order), end: Math.max(range.start, order) });
    };

    const resetForm = () => {
        setRange(null);
        setSegType("TESTCASE");
        setTestCaseId(initialTestCaseId ?? "");
        setEditingId(null);
        setDeletingId(null);
    };

    const handleSubmit = async () => {
        if (!submitAllowed || saving) return;
        setSaving(true);
        setLocalError("");
        try {
            const overlap = findOverlap(segments, rangeInfo.startStep, rangeInfo.endStep, editingId);
            if (overlap) {
                setLocalError(`Đoạn thao tác trùng với đoạn đã gán (${rangeLabel(overlap.startStep, overlap.endStep)}).`);
                return;
            }
            const payload = {
                startStep: rangeInfo.startStep,
                endStep: rangeInfo.endStep,
                type: segType,
                testCaseId: segType === "TESTCASE" ? testCaseId : null
            };
            if (editingId) {
                await updateSegment(workspaceId, recordingId, editingId, payload);
            } else {
                await createSegment(workspaceId, recordingId, payload);
            }
            await refresh();
            resetForm();
            onChanged?.();
        } catch (e) {
            setLocalError(segmentErrorMessage(e?.code, e?.message));
        } finally {
            setSaving(false);
        }
    };

    const handleConfirm = async seg => {
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await confirmSegment(workspaceId, recordingId, seg.segmentId);
            await refresh();
            onChanged?.();
        } catch (e) {
            setLocalError(segmentErrorMessage(e?.code, e?.message));
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = seg => {
        setLocalError("");
        setEditingId(seg.segmentId);
        setRange({ start: seg.startStep, end: seg.endStep });
        setSegType(seg.type);
        setTestCaseId(seg.testCaseId ?? "");
    };

    const handleDelete = async seg => {
        if (deletingId !== seg.segmentId) {
            setDeletingId(seg.segmentId);
            return;
        }
        if (saving) return;
        setSaving(true);
        setLocalError("");
        try {
            await deleteSegment(workspaceId, recordingId, seg.segmentId);
            await refresh();
            setDeletingId(null);
            onChanged?.();
        } catch (e) {
            setLocalError(segmentErrorMessage(e?.code, e?.message));
        } finally {
            setSaving(false);
        }
    };

    const handleMove = async (segmentsOfTc, index, dir) => {
        if (saving) return;
        const next = [...segmentsOfTc];
        const target = index + dir;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setSaving(true);
        setLocalError("");
        try {
            const tcId = next[0]?.testCaseId;
            await reorderTestCaseSegments(workspaceId, tcId, next.map(s => s.segmentId));
            await refresh();
            onChanged?.();
        } catch (e) {
            setLocalError(segmentErrorMessage(e?.code, e?.message));
        } finally {
            setSaving(false);
        }
    };

    const isStepInRange = order => Boolean(rangeInfo && rangeInfo.ok && order >= rangeInfo.startStep && order <= rangeInfo.endStep);
    const isStepInAnySegment = order => segments.some(seg => order >= seg.startStep && order <= seg.endStep);

    // Nhóm đoạn đã gán: Dùng chung trước, rồi từng testcase (theo thứ tự tester sắp xếp).
    const segmentGroups = useMemo(() => {
        const setup = segments.filter(s => s.type === "SETUP").sort((a, b) => a.startStep - b.startStep);
        const tcIds = [...new Set(segments.filter(s => s.type === "TESTCASE").map(s => s.testCaseId).filter(Boolean))].sort();
        const groups = [];
        if (setup.length > 0) groups.push({ key: "__setup", label: "Dùng chung", items: setup });
        for (const tcId of tcIds) {
            const items = segments
                .filter(s => s.type === "TESTCASE" && s.testCaseId === tcId)
                .sort((a, b) => (a.orderInTestCase ?? 0) - (b.orderInTestCase ?? 0));
            const tc = (Array.isArray(testCases) ? testCases : []).find(t => t.testCaseId === tcId);
            groups.push({ key: tcId, label: tc ? `${tcId} — ${tc.title}` : tcId, items });
        }
        return groups;
    }, [segments, testCases]);

    if (loading) return <div className="v3-note">Đang tải bản ghi…</div>;

    return (
        <section className="v3-map" aria-label="Gắn bản ghi testcase và gán đoạn thao tác">
            <div className="v3-map__head">
                <div>
                    <h3 className="v3-map__title">Gắn bản ghi testcase</h3>
                    <p className="v3-map__sub">
                        Bản ghi {detail?.recordingId ?? recordingId} · {steps.length} bước · {segments.length} đoạn
                    </p>
                </div>
                <button type="button" className="v3-btn v3-btn--ghost" onClick={onClose} disabled={saving}>
                    Đóng
                </button>
            </div>

            {localError ? <div className="v3-banner v3-banner--error" role="alert">{localError}</div> : null}

            {steps.length === 0 ? (
                <div className="v3-empty">
                    <strong>Bản ghi chưa có bước nào</strong>
                    <span>Bản ghi rỗng — hãy ghi lại hoặc dán mã Playwright có thao tác.</span>
                </div>
            ) : (
                <>
                    {/* ---------- Timeline ---------- */}
                    <div className="v3-map__block">
                        <h4 className="v3-map__h">Các bước đã ghi (theo thứ tự thao tác)</h4>
                        <div className="v3-steps v3-map__steps">
                            {steps.map(step => {
                                const inRange = isStepInRange(step.order);
                                const inSeg = !inRange && isStepInAnySegment(step.order);
                                const classes = [
                                    "v3-step",
                                    "v3-map-step",
                                    inRange ? "v3-map-step--range" : "",
                                    inSeg ? "v3-map-step--seg" : ""
                                ].filter(Boolean).join(" ");
                                return (
                                    <button
                                        type="button"
                                        key={stepRowKey(step)}
                                        className={classes}
                                        onClick={() => selectStep(step.order)}
                                        aria-label={`Chọn bước ${step.order}`}
                                    >
                                        <span className="v3-step__n">{step.order}</span>
                                        <span className="v3-step__act">{ACTION_LABEL[step.actionType] ?? step.actionType}</span>
                                        <span className="v3-step__loc">{step.locator || step.target || "—"}</span>
                                        {step.recordedValue ? <span className="v3-step__val">{step.recordedValue}</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="v3-map__hint">
                            Cách chọn: bấm bước bắt đầu, rồi bấm bước kết thúc.{" "}
                            {rangeInfo?.ok ? (
                                <b>Đang chọn {rangeLabel(rangeInfo.startStep, rangeInfo.endStep)}</b>
                            ) : range ? (
                                <b>Bấm bước kết thúc…</b>
                            ) : (
                                "Chưa chọn khoảng bước."
                            )}
                        </p>
                        {range ? (
                            <button type="button" className="v3-btn v3-btn--ghost" onClick={() => setRange(null)}>
                                Bỏ chọn
                            </button>
                        ) : null}
                    </div>

                    {/* ---------- Form gán đoạn ---------- */}
                    <div className="v3-map__block">
                        <h4 className="v3-map__h">{editingId ? "Sửa đoạn thao tác" : "Đoạn thao tác mới"}</h4>
                        <div className="v3-map__form">
                            <fieldset className="v3-map__types">
                                <legend className="v3-map__legend">Loại</legend>
                                <label className="v3-radio">
                                    <input
                                        type="radio"
                                        name="seg-type"
                                        checked={segType === "TESTCASE"}
                                        onChange={() => setSegType("TESTCASE")}
                                    />
                                    <span>Testcase</span>
                                </label>
                                <label className="v3-radio">
                                    <input
                                        type="radio"
                                        name="seg-type"
                                        checked={segType === "SETUP"}
                                        onChange={() => setSegType("SETUP")}
                                    />
                                    <span>Dùng chung (đăng nhập, di chuyển đến màn hình chức năng)</span>
                                </label>
                            </fieldset>

                            {segType === "TESTCASE" ? (
                                <div className="v3-map__tc">
                                    <label className="v3-map__label" htmlFor="v3-map-tc">Testcase</label>
                                    <input
                                        id="v3-map-search"
                                        className="v3-input"
                                        type="text"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Gõ để tìm theo mã hoặc tên testcase"
                                        aria-label="Tìm testcase"
                                    />
                                    <select
                                        id="v3-map-tc"
                                        className="v3-input"
                                        value={testCaseId}
                                        onChange={e => setTestCaseId(e.target.value)}
                                    >
                                        <option value="">— Chọn testcase —</option>
                                        {filteredTestCases.map(tc => (
                                            <option key={tc.testCaseId} value={tc.testCaseId}>
                                                {tc.testCaseId} — {tc.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : null}

                            <div className="v3-map__actions">
                                <button
                                    type="button"
                                    className="v3-btn v3-btn--primary"
                                    disabled={!submitAllowed || saving}
                                    onClick={handleSubmit}
                                >
                                    {editingId ? "Cập nhật đoạn" : "Xác nhận đoạn"}
                                </button>
                                {editingId ? (
                                    <button type="button" className="v3-btn v3-btn--ghost" onClick={resetForm} disabled={saving}>
                                        Hủy sửa
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* ---------- Review Mapping ---------- */}
                    <div className="v3-map__block">
                        <h4 className="v3-map__h">Các đoạn đã gán</h4>
                        {segmentGroups.length === 0 ? (
                            <p className="v3-map__note">Chưa có đoạn nào được gán.</p>
                        ) : (
                            segmentGroups.map(group => (
                                <div key={group.key} className="v3-map-group">
                                    <div className="v3-map-group__head">
                                        {group.key === "__setup" ? <span>⚙ Dùng chung</span> : <span>✔ {group.label}</span>}
                                        {group.key !== "__setup" && group.items.length > 1 ? (
                                            <span className="v3-map-group__order">Thứ tự sinh test: {group.items.map(s => s.orderInTestCase).join(" → ")}</span>
                                        ) : null}
                                    </div>
                                    {group.items.map((seg, idx) => (
                                        <div className="v3-map-seg" key={seg.segmentId}>
                                            <span className="v3-map-seg__range">{rangeLabel(seg.startStep, seg.endStep)}</span>
                                            <span className={`v3-badge ${seg.status === "CONFIRMED" ? "v3-badge--ok" : "v3-badge--review"}`}>
                                                {segmentStatusLabel(seg.status)}
                                            </span>
                                            <div className="v3-map-seg__actions">
                                                {group.key !== "__setup" && group.items.length > 1 ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="v3-btn v3-btn--mini"
                                                            disabled={saving || idx === 0}
                                                            onClick={() => handleMove(group.items, idx, -1)}
                                                            aria-label="Lên trên"
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="v3-btn v3-btn--mini"
                                                            disabled={saving || idx === group.items.length - 1}
                                                            onClick={() => handleMove(group.items, idx, 1)}
                                                            aria-label="Xuống dưới"
                                                        >
                                                            ↓
                                                        </button>
                                                    </>
                                                ) : null}
                                                {seg.status === "DRAFT" ? (
                                                    <button
                                                        type="button"
                                                        className="v3-btn v3-btn--primary v3-btn--mini"
                                                        disabled={saving}
                                                        onClick={() => handleConfirm(seg)}
                                                    >
                                                        Xác nhận
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    className="v3-btn v3-btn--ghost v3-btn--mini"
                                                    disabled={saving}
                                                    onClick={() => handleEdit(seg)}
                                                >
                                                    Sửa
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`v3-btn v3-btn--mini ${deletingId === seg.segmentId ? "v3-btn--danger" : "v3-btn--ghost"}`}
                                                    disabled={saving}
                                                    onClick={() => handleDelete(seg)}
                                                >
                                                    {deletingId === seg.segmentId ? "Chắc chắn?" : "Xóa"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                        <p className={`v3-map__note ${unused > 0 ? "v3-map__note--warn" : ""}`}>
                            {unused > 0
                                ? `⚠ ${unused} bước chưa thuộc đoạn nào — các bước này sẽ không xuất hiện trong test sinh ra.`
                                : "Tất cả bước đã được gán vào đoạn."}
                        </p>
                    </div>
                </>
            )}
        </section>
    );
}
