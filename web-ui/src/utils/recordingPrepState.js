/*
 P0-1 — Recording context isolation (V3RecordingPreparationPanel, Phần II).

 "Analysis workspace" của Phần II = { startSel, endSel, name, proposals }
 (start/end → range preview + scoped assertions đều derive từ steps + startSel/endSel).

 - freshAnalysisWorkspace(): trạng thái RỖNG — dùng để RESET khi nội dung bản ghi đổi.
 - initializeAnalysisFromSteps(steps): khởi tạo LẠI hoàn toàn từ steps MỚI
   (start = order đầu, end = order cuối; name/proposals rỗng).
 - isStepInRange(order, startSel, endSel): step có nằm trong đoạn đang chọn không
   (P0-3 — highlight VISUAL bên cột trái; KHÔNG phải control).

 Component dùng các helper này trong resetRecordingContext / doParse / render steps.
 Tách thuần để regression test "A → parse → B → parse without F5" chạy được không cần browser,
 xác nhận Phần II chỉ chứa nội dung của B, và KHÔNG reset Library.
*/

export function freshAnalysisWorkspace() {
    return { startSel: null, endSel: null, name: "", proposals: [] };
}

export function initializeAnalysisFromSteps(steps) {
    const orders = (Array.isArray(steps) ? steps : [])
        .map(s => (Number.isInteger(s?.order) ? s.order : null))
        .filter(x => x !== null);
    return {
        startSel: orders.length > 0 ? orders[0] : null,
        endSel: orders.length > 0 ? orders[orders.length - 1] : null,
        name: "",
        proposals: []
    };
}

export function isStepInRange(order, startSel, endSel) {
    if (!Number.isInteger(order) || !Number.isInteger(startSel) || !Number.isInteger(endSel)) return false;
    return order >= Math.min(startSel, endSel) && order <= Math.max(startSel, endSel);
}

/** P0-3.3 — assertion thuộc range [startStep..endStep] (reuse scoping rule backend/UI cho manual range):
 *  - sourceStart/sourceEnd nằm TRONG phạm vi steps chọn;
 *  - HOẶC ngay sau step cuối (trailing ≤120 ký tự — expect liền sau action cuối).
 *  Assertion ngoài range KHÔNG được kèm. Dùng chung cho manual + AI proposal. */
export function scopedAssertionsInRange(assertions, steps, startStep, endStep) {
    const st = Array.isArray(steps) ? steps : [];
    const as = Array.isArray(assertions) ? assertions : [];
    if (as.length === 0) return [];
    if (!Number.isInteger(startStep) || !Number.isInteger(endStep)) return [];
    const selSteps = st.filter(s => Number.isInteger(s?.order) && s.order >= Math.min(startStep, endStep) && s.order <= Math.max(startStep, endStep));
    if (selSteps.length === 0) return [];
    const firstStart = Math.min(...selSteps.map(s => s.sourceStart ?? 0));
    const lastStart = Math.min(...selSteps.map(s => s.sourceStart ?? 0));
    const lastEnd = Math.max(...selSteps.map(s => s.sourceEnd ?? 0));
    return as.filter(a => {
        const astart = a.sourceStart ?? -1;
        const aend = a.sourceEnd ?? -1;
        if (astart >= firstStart && aend <= lastEnd) return true;
        if (astart >= lastStart && astart <= lastEnd + 120) return true;
        return false;
    });
}
