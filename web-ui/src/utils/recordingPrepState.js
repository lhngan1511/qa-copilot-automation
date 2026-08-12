/*
 P0-1 — Recording context isolation (V3RecordingPreparationPanel, Phần II).

 "Analysis workspace" của Phần II = { startSel, endSel, name, proposals, expandedItem }
 (start/end → range preview + scoped assertions đều derive từ steps + startSel/endSel).

 - freshAnalysisWorkspace(): trạng thái RỖNG — dùng để RESET khi nội dung bản ghi đổi.
 - initializeAnalysisFromSteps(steps): khởi tạo LẠI hoàn toàn từ steps MỚI
   (start = order đầu, end = order cuối; name/proposals/edit state rỗng).

 Component dùng 2 helper này trong resetRecordingContext / doParse. Tách thuần
 để regression test "A → parse → B → parse without F5" chạy được không cần browser,
 xác nhận Phần II chỉ chứa nội dung của B, và KHÔNG reset Library.
*/

export function freshAnalysisWorkspace() {
    return { startSel: null, endSel: null, name: "", proposals: [], expandedItem: null };
}

export function initializeAnalysisFromSteps(steps) {
    const orders = (Array.isArray(steps) ? steps : [])
        .map(s => (Number.isInteger(s?.order) ? s.order : null))
        .filter(x => x !== null);
    return {
        startSel: orders.length > 0 ? orders[0] : null,
        endSel: orders.length > 0 ? orders[orders.length - 1] : null,
        name: "",
        proposals: [],
        expandedItem: null
    };
}
