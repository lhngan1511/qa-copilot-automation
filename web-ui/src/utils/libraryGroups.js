/*
 P0 — ACTION LIBRARY GROUPING V1.

 groupLibraryActions(list): nhóm blocks theo groupName (null → "Chưa phân loại").
   - Thứ tự group: theo lần xuất hiện đầu tiên (preserve insertion);
     "Chưa phân loại" LUÔN ở cuối.
   - Mỗi group: { groupName (display), rawGroupName (null|string), count, items }.
   - Group rỗng tự biến mất (derive — xóa action cuối trong group → không còn group).

 groupDisplayName(name): "Chưa phân loại" khi null/''.

 KHÔNG đoán group từ label; KHÔNG AI; chỉ phân nhóm theo metadata tester gán.
 Component dùng helper này (tách thuần để test A–E không cần browser).
*/

export const UNGROUPED_LABEL = "Chưa phân loại";

export function groupDisplayName(name) {
    const n = String(name ?? "").trim();
    return n ? n : UNGROUPED_LABEL;
}

export function groupLibraryActions(list) {
    const items = Array.isArray(list) ? list : [];
    const order = [];
    const map = new Map(); // rawGroupName ('' cho null) → { raw, items }
    for (const b of items) {
        const raw = String(b?.groupName ?? "").trim();
        const key = raw; // null/'' → '' (gộp "Chưa phân loại")
        if (!map.has(key)) {
            map.set(key, { raw: raw || null, items: [] });
            order.push(key);
        }
        map.get(key).items.push(b);
    }
    // "Chưa phân loại" (key '') luôn cuối.
    const sortedKeys = order.filter(k => k !== "").concat(order.includes("") ? [""] : []);
    return sortedKeys.map(key => {
        const g = map.get(key);
        return {
            groupName: groupDisplayName(key),
            rawGroupName: g.raw,
            count: g.items.length,
            items: g.items
        };
    });
}
