/*
 P0-3.2 — Working actions (THAO TÁC ĐÃ TẠO) = WORKING SET trước khi persist Library.

 - appendWorkingAction(list, { label, startStep, endStep }): thêm action vào working set.
   KHÔNG gọi API; KHÔNG duplicate cùng range (chống accidental double-click/add trùng proposal).
   blockId tạm `WORK-*` — thay bằng blockId LIB-* thật khi tester bấm "Lưu ... vào Thư viện".
 - removeWorkingAction(list, id): xóa đúng 1 action (để tester có thể add lại proposal tương ứng).
 - proposalStatus(proposal, workingList): trạng thái proposal so với working set —
   { added } khi đã có action cùng range (nút → "✓ Đã thêm"),
   { blocked, overlapLabel } khi overlap với action khác (chặn add trùng phạm vi).

 Component dùng các helper này (qua functional update) — tách thuần để regression test
 CASE A–F chạy được không cần browser. Library chỉ tăng khi tester chủ động bấm Lưu
 (createLibraryAction trong saveAllToLibrary) — AI/manual add KHÔNG tự persist.
*/

export function appendWorkingAction(list, { label, startStep, endStep, groupName = null }) {
    const l = Array.isArray(list) ? list : [];
    if (!Number.isInteger(startStep) || !Number.isInteger(endStep)) return l;
    const rangeKey = `${Math.min(startStep, endStep)}:${Math.max(startStep, endStep)}`;
    if (l.some(x => `${Math.min(x.startStep, x.endStep)}:${Math.max(x.startStep, x.endStep)}` === rangeKey)) {
        return l; // chống duplicate cùng range (CASE E — accidental duplicate)
    }
    return [...l, {
        blockId: `WORK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: String(label ?? "").trim() || `Bước ${startStep}→${endStep}`,
        groupName: String(groupName ?? "").trim() || null,
        startStep: Math.min(startStep, endStep),
        endStep: Math.max(startStep, endStep),
        stepCount: Math.abs(endStep - startStep) + 1,
        assertionCount: 0
    }];
}

export function removeWorkingAction(list, id) {
    return (Array.isArray(list) ? list : []).filter(x => x.blockId !== id);
}

export function proposalStatus(proposal, workingList) {
    const l = Array.isArray(workingList) ? workingList : [];
    const p = proposal ?? {};
    if (!Number.isInteger(p.startStep) || !Number.isInteger(p.endStep)) {
        return { added: false, blocked: false, overlapLabel: null };
    }
    const added = l.some(x => x.startStep === Math.min(p.startStep, p.endStep) && x.endStep === Math.max(p.startStep, p.endStep));
    const overlapItem = !added
        ? l.find(x => x.startStep <= Math.max(p.startStep, p.endStep) && x.endStep >= Math.min(p.startStep, p.endStep))
        : null;
    return { added, blocked: Boolean(overlapItem), overlapLabel: overlapItem?.label ?? null };
}
