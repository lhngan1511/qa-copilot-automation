/*
 P0 — WORKING ACTION ↔ LIBRARY STATE RECONCILE (sau delete).

 Vấn đề: working action từng được lưu giữ `blockId = LIB-*`; nếu tester XÓA asset
 đó khỏi Library, `doDeleteLibrary` chỉ cập nhật library state — working action vẫn
 giữ LIB-* cũ → saveAllToLibrary skip mù theo prefix `startsWith("LIB-")` → không
 tạo lại → Library kẹt thiếu 1, dù UI báo "Đã lưu N".

 Rule (canonical = Library state):
   - Action được coi là "đã lưu" CHỈ KHI `blockId` bắt đầu `LIB-` VÀ block đó
     CÒN TỒN TẠI trong danh sách Library hiện tại.
   - Action có `LIB-*` nhưng không còn trong Library → coi là CHƯA lưu → phải
     tạo Library asset MỚI (nhận LIB id mới) khi tester Save lại.
   - Action `WORK-*` (chưa từng lưu) → tạo mới.

 planLibrarySave(workingActions, libraryList):
   trả { toCreate: [...actions cần persist], alreadySaved: số action đã tồn tại }.
   Component dùng để quyết định tạo + đếm số persist THẬT cho success feedback.
*/

export function planLibrarySave(workingActions, libraryList) {
    const acts = Array.isArray(workingActions) ? workingActions : [];
    const lib = Array.isArray(libraryList) ? libraryList : [];
    const toCreate = [];
    let alreadySaved = 0;
    for (const seg of acts) {
        const isLib = String(seg?.blockId ?? "").startsWith("LIB-");
        const exists = isLib && lib.some(b => b?.blockId === seg.blockId);
        if (exists) {
            alreadySaved += 1;
        } else {
            toCreate.push(seg);
        }
    }
    return { toCreate, alreadySaved };
}
