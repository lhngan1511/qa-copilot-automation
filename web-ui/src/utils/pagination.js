/*
 P0-3.3 — Pagination (AI proposals + Thư viện thao tác).

 - totalPages(count, pageSize): tổng số trang (tối thiểu 1 — kể cả khi rỗng).
 - clampPage(page, count, pageSize): chặn page vào [0, totalPages-1];
   dùng để NORMALIZE page khi danh sách rút gọn (xóa item ở trang cuối → tự lùi trang).
 - paginate(list, page, pageSize): cắt items của trang; trả { items, page (đã clamp),
   totalPages, hasPrev, hasNext }. KHÔNG thay đổi state của item (added/blocked là
   derived từ working set — giữ nguyên khi đổi trang). KHÔNG gọi lại AI khi đổi page.

 Component dùng helper này (functional update) — tách thuần để regression test A–D
 chạy được không cần browser.
*/

export function totalPages(count, pageSize) {
    const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
    const c = Number.isInteger(count) && count > 0 ? count : 0;
    return Math.max(1, Math.ceil(c / size));
}

export function clampPage(page, count, pageSize) {
    const tp = totalPages(count, pageSize);
    if (!Number.isInteger(page)) return 0;
    return Math.min(Math.max(page, 0), tp - 1);
}

export function paginate(list, page, pageSize) {
    const items = Array.isArray(list) ? list : [];
    const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
    const tp = totalPages(items.length, size);
    const p = clampPage(page, items.length, size);
    return {
        items: items.slice(p * size, (p + 1) * size),
        page: p,
        totalPages: tp,
        hasPrev: p > 0,
        hasNext: p < tp - 1
    };
}
