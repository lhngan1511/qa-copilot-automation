# WIREFRAME — ACTION LIBRARY VIEWER (large modal, 2 cột)

> Trạng thái: **PROPOSAL — CHƯA CODE**. Feedback tester trên browser thật (drawer 480px làm bóp
> layout, detail quá hẹp, technical text wrap từng ký tự, hierarchy Chức năng/Action không rõ,
> recorded value khó đọc) → thiết kế lại container + layout. KHÔNG đổi API / data model /
> functionality. KHÔNG polish CSS trực tiếp trên layout cũ.

## 1. Mục tiêu thiết kế (map từng lỗi tester → quyết định)

| Lỗi trên UI thật | Quyết định thiết kế |
|---|---|
| Drawer 480px bóp layout | Bỏ drawer → **large modal / workspace overlay**: `width: min(90vw, 1400px)`, `max-height: 88vh`, backdrop mờ, bo góc, căn giữa |
| Detail column quá hẹp | 2 cột cố định: trái 320–360px (danh sách) · phải `1fr` (detail) — cột phải chiếm phần lớn màn hình |
| Technical text wrap từng ký tự | Technical (locator/target) nằm trong `<details>` **collapse mặc định**; block code có `white-space: pre-wrap; word-break: break-word; overflow: auto; max-height` — không vỡ layout |
| Hierarchy Chức năng/Action không rõ | Cây 2 tầng rõ: **Chức năng = header có nền + count badge**; **Action = item thụt lề + đường guide + badge số bước**; chọn Action → highlight |
| Recorded value khó đọc | Dòng riêng dưới semantic text: mono, nền tint riêng, border accent trái, `Giá trị bản ghi: "BBC"` (JSON-quoted); sensitive → `"••••" (nhạy cảm)` |

## 2. Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ THƯ VIỆN THAO TÁC                    [ 🔍 Tìm thao tác (tên / chức năng)… ] [⟳]  ✕ │
│ Đọc từ Action Library shared — CodeGen và Automation dùng chung (chỉ xem)          │
│ 5 thao tác · 3 chức năng                                                            │
├───────────────────────────┬────────────────────────────────────────────────────────┤
│ ▾ Đăng nhập                    (1)  │  ◀ Action Detail (khi đã chọn)               │
│   • Đăng nhập                     │                                                │
│ ▾ Danh mục đơn vị tính         (5)  │  Thêm mới đơn vị tính                        │
│   • Điều hướng đến Danh mục…    2b  │  [Danh mục đơn vị tính] [5 bước] [1 điều kiện]│
│   • Tìm kiếm đơn vị tính        3b  │  Nguồn: Bản ghi REC-xxx · Bước 5 → 9          │
│   • Thêm mới đơn vị tính   ◀ chọn │  ───────────────────────────────────────────  │
│   • Sửa đơn vị tính               │  1  Bấm     nút "Thêm"                          │
│   • Xóa đơn vị tính               │  2  Nhập    ô "Mã đơn vị tính"                  │
│ ▾ Chưa phân loại                (0)  │      Giá trị bản ghi: "BBC"                  │
│                                     │  3  Nhập    ô "Ghi chú"                       │
│                                     │      Giá trị bản ghi: "ghi chú"              │
│                                     │  4  Bấm     nút "Lưu"                         │
│                                     │  ▸ Xem kỹ thuật (collapse mặc định)          │
│                                     │  ───────────────────────────────────────────  │
│                                     │  Điều kiện kiểm tra (1):                      │
│                                     │  ✓ Đơn vị tính được tạo… hiển thị             │
│                                     │    ▸ Xem kỹ thuật                             │
├───────────────────────────┴────────────────────────────────────────────────────────┤
│ (nếu chưa chọn Action: cột phải hiện hint trung tâm "Chọn một thao tác…")            │
│ (nếu library rỗng: overlay hiện empty state thay cho 2 cột)                         │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Trạng thái

- **Empty library**: overlay hiện thông báo trung tâm "Thư viện chưa có thao tác nào…" (không vẽ 2 cột, không lỗi giả).
- **Chưa chọn Action**: cột phải = hint trung tâm (icon + "Chọn một thao tác để xem chi tiết").
- **Đang tải / lỗi**: dòng trạng thái trong header area (không thay đổi layout).

## 3. Cấu trúc component / layout proposal

### 3.1 Container (thay `.v3-drawer--wide`)

```
.v3-lib-overlay                 fixed inset:0; rgba(15,23,42,.5); z-index:60; display:grid; place-items:center
.v3-lib-modal                   width:min(90vw,1400px); max-height:88vh; display:flex; flex-direction:column;
                                background:var(--surface); border-radius:14px; box-shadow lớn
  .v3-lib-modal__header         padding 16–18px; border-bottom
  .v3-lib-modal__body           flex:1; min-height:0; display:grid; grid-template-columns: 340px 1fr;
                                gap: 0; (dưới 900px: 1 cột, list max-height 40%)
```

- Đóng: nút ✕ header + phím Escape + click backdrop (click trong modal không đóng).

### 3.2 Header (1 dòng + 1 dòng phụ)

- Dòng 1: title **THƯ VIỆN THAO TÁC** · search input (flex 1, max 360px) · nút ⟳ · nút ✕.
- Dòng 2 (sub): ghi chú shared source + thống kê `N thao tác · M chức năng` (derive từ list — không cần API mới).

### 3.3 Cột trái — Chức năng → Actions (cây 2 tầng)

- **Group header**: hàng đầy đủ, nền tint nhẹ, `▾/▸`, tên chức năng (bán đậm), badge count phải (`(N)`); click = collapse/expand.
- **Action item**: thụt lề dưới group, đường guide trái (tree line), dòng 1 = tên action, dòng 2 = `N bước · dùng bởi K testcase` (chữ nhỏ, xám); click = chọn → highlight nền + viền trái accent.
- **Mặc định**: mọi group expand (viewer là màn hình browse); search lọc cả tên lẫn chức năng (giữ logic hiện tại); khi search có kết quả → chỉ render group khớp (hành vi hiện tại).
- Nhóm "Chưa phân loại" giữ vị trí cuối (logic `groupLibraryActions` không đổi).

### 3.4 Cột phải — Action Detail (READ-ONLY)

- **Header detail**: tên Action (h2, lớn) + chips: `Chức năng: X` · `N bước` · `N điều kiện` · `Dùng bởi K testcase`; dòng nguồn: `Bản ghi <id> · Bước X → Y` (giữ `sourceRecordingId`/`sourceRange` hiện có).
- **Steps** (đúng thứ tự, `.v3-steps` cải tiến):
  - Mỗi step = 1 hàng grid: `[số thứ tự] [chip loại action] [semantic text]` + dòng **recorded value** bên dưới khi có:
    - `.v3-lib-viewer__value` → thiết kế lại: block mono `ui-monospace` 13px, nền `#ecfdf5`/tint, border-left 3px accent, padding 4–8px, margin-top 4px; hiển thị `Giá trị bản ghi: "BBC"` (JSON.stringify); sensitive: `"••••" (nhạy cảm — đã che)`.
  - **Technical detail**: `<details class="v3-act__tech">` collapse mặc định — `summary "Xem kỹ thuật"`; nội dung `<code>` block với `white-space: pre-wrap; word-break: break-word; overflow: auto; max-height: 160px` (fix wrap từng ký tự).
- **Recorded assertions**: section riêng "Điều kiện kiểm tra (N)" — readable + technical collapse mặc định.
- Cuối: ghi chú nhỏ `Chỉ xem (READ-ONLY) — sửa/xóa tại trang CodeGen`.

### 3.5 File/component

- Giữ 1 component: `web-ui/src/components/automationV3/V3LibraryViewer.jsx` (tái cấu trúc JSX bên trong; KHÔNG đổi props/API).
- Tách trình bày detail → sub-component `LibraryActionDetail` (cùng file hoặc file riêng) — thuần presentational, nhận block DTO như hiện tại.
- Pure helpers giữ nguyên: `utils/libraryViewer.js` (`libraryStepDetail`, `readableAssertion`) — không đổi chữ ký.
- CSS: THAY block `.v3-drawer--wide`/`.v3-lib-viewer*` hiện tại bằng block mới (`.v3-lib-overlay`/`.v3-lib-modal*`...) — xóa class cũ, không chồng vá.

## 4. Không đổi (ràng buộc)

- API: vẫn `GET /api/codegen/library` (codeGenApi.listLibrary) — không endpoint mới.
- Data model: DTO block giữ nguyên (label, groupName, steps[], recordedAssertions[], sourceRecordingId, sourceRange, stepCount, usedByTestCases).
- Functionality: READ-ONLY — không sửa/xóa/clone/reorder/AI; search + group + inspect giữ nguyên.
- Không đụng CodeGenPage layout khác ngoài nút mở viewer.

## 5. Acceptance sau khi triển khai (dự kiến)

1. Modal ≥ 80vw, max-height ≤ 90vh — layout không bị bóp trên browser thật (1366×768 trở lên).
2. Cột phải ≥ 55% chiều rộng modal; technical text không wrap từng ký tự (wrap theo word).
3. Hierarchy Chức năng → Actions phân biệt rõ (nền group, thụt lề, badge count).
4. Recorded value đọc được ngay (mono block tint, không lẫn vào semantic text).
5. Technical collapse mặc định; mở ra không vỡ layout (scroll nội bộ).
6. Empty state / chưa chọn / loading / error không vỡ layout.
7. Regression hiện có (automation-v3-library-viewer-test.js CASE 1–7) vẫn PASS — không đổi API/data.
