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

/** Chia thao tác trong một Chức năng theo ngày ghi; ngày mới nhất và thao tác mới nhất ở trước. */
export function groupLibraryActionsByCreatedDate(list, now = new Date()) {
    const items = Array.isArray(list) ? [...list] : [];
    const validTime = item => {
        const time = new Date(item?.createdAt ?? "").getTime();
        return Number.isFinite(time) ? time : null;
    };
    items.sort((a, b) => (validTime(b) ?? -Infinity) - (validTime(a) ?? -Infinity));

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const todayKey = dateKey(today);
    const yesterdayKey = dateKey(yesterday);
    const sections = new Map();

    for (const item of items) {
        const time = validTime(item);
        const date = time === null ? null : new Date(time);
        const key = date ? dateKey(date) : "unknown";
        if (!sections.has(key)) {
            const label = key === todayKey
                ? "Hôm nay"
                : key === yesterdayKey
                    ? "Hôm qua"
                    : date
                        ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
                        : "Không rõ ngày ghi";
            sections.set(key, { key, label, items: [] });
        }
        sections.get(key).items.push(item);
    }
    return [...sections.values()];
}
