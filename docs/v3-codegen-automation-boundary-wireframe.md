# WIREFRAME — CODEGEN ↔ ACTION LIBRARY ↔ AUTOMATION WORKSPACE (boundary)

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **CHỜ NGƯỜI DÙNG DUYỆT — CHƯA CODE.**
> Ngôn ngữ tester: "Thư viện thao tác" = Action Library · "Bản ghi" = Recording · "Chuỗi thao tác" = binding.

---

## A. CODEGEN — CÔNG CỤ ĐỘC LẬP (không cần mở Automation)

```
┌──────────────────────────────────────────────────────────────────┐
│ CODEGEN — Thu thập thao tác Playwright                  [ ✕ ]   │
│ ──────────────────────────────────────────────────────────────── │
│ Bản ghi: [ + Ghi mới (Recorder) ]  [ + Dán Playwright ]         │
│                                                                  │
│ BẢN GHI PLAYWRIGHT (30 bước)                                    │
│  1. Mở trang đăng nhập                                           │
│  ...                                                             │
│  8. Click Thêm                                                   │
│  9. Nhập Mã                                                      │
│  ...                                                             │
│  30. ...                                                         │
│                                                                  │
│ Đoạn đã cắt (từ bản ghi này):                                   │
│   ✓ Đăng nhập            bước 1 → 4                              │
│   ✓ Mở Đơn vị tính       bước 5 → 7                              │
│   ✓ Thêm đơn vị tính     bước 8 → 14                             │
│   ✓ Tìm kiếm             bước 15 → 18                            │
│                                                                  │
│ [ + Chọn đoạn tiếp theo ]   [ Xong ]                             │
│                                                                  │
│ [ Phân tích bản ghi ]  ← AI (sau này): đề xuất các đoạn →       │
│   [Xác nhận] [Chỉnh phạm vi] [Đổi tên] [Bỏ qua]                  │
│                                                                  │
│ [ Lưu các đoạn vào Thư viện thao tác ]  ← tài sản DÙNG CHUNG    │
└──────────────────────────────────────────────────────────────────┘
```

- Codegen đứng riêng: tester record/dán/phân tích/cắt **mà không cần vào Automation**.
- `[Lưu vào Thư viện thao tác]` → Action Library (label bắt buộc cho REUSABLE).

---

## B. ACTION LIBRARY — TÀI SẢN DÙNG CHUNG

```
┌──────────────────────────────────────────────────────────────────┐
│ THƯ VIỆN THAO TÁC                                                │
│                                                                  │
│  Đăng nhập          · Bước chuẩn bị · Dùng bởi 3 testcase  [Chọn]│
│  Mở Đơn vị tính     · Bước chuẩn bị · Dùng bởi 3 testcase  [Chọn]│
│  Thêm đơn vị tính   · Thao tác       · Dùng bởi 2 testcase  [Chọn]│
│  Tìm kiếm           · Thao tác       · Dùng bởi 4 testcase  [Chọn]│
│  Sửa đơn vị tính    · Thao tác       · Dùng bởi 1 testcase  [Chọn]│
│  Xóa đơn vị tính    · Thao tác       · Dùng bởi 1 testcase  [Chọn]│
│                                                                  │
│ (Nguồn: Bản ghi #01 · 30 bước)                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## C. AUTOMATION WORKSPACE — LÀM VIỆC THEO TESTCASE

```
┌──────────────────────────────────────────────────────────────────┐
│ TC001 · Sửa đơn vị tính thành công                       [ ✕ ]   │
│ ──────────────────────────────────────────────────────────────── │
│ Chuỗi thao tác sẽ chạy:                                          │
│  1. Đăng nhập                        ↑ ↓ [Xóa]                   │
│  2. Mở Đơn vị tính                   ↑ ↓ [Xóa]                   │
│  3. Tìm kiếm                         ↑ ↓ [Xóa]                   │
│  4. Sửa đơn vị tính                  ↑ ↓ [Xóa]                   │
│  5. Tìm kiếm                         ↑ ↓ [Xóa]   ← dùng lại, lặp │
│                                                                  │
│ [ + Dùng thao tác đã có ]   [ + Tạo từ bản ghi Playwright ]      │
│                                                                  │
│ ⓘ "Tìm kiếm" có thể chưa đủ để chạy độc lập. Bản ghi có thao tác │
│   trước: Đăng nhập → Mở Đơn vị tính. [Thêm] [Bỏ qua]             │
│                                                                  │
│ KẾT QUẢ MONG ĐỢI: Sửa đơn vị tính thành công                    │
│ ĐIỀU KIỆN XÁC NHẬN: 1 đã xác nhận                               │
│ ──────────────────────────────────────────────────────────────── │
│ [ Đóng ]                                  [ Sinh automation ]    │
└──────────────────────────────────────────────────────────────────┘
```

- `[+ Dùng thao tác đã có]` → mở **Action Library** (màn B) — không paste lại.
- `[+ Tạo từ bản ghi Playwright]` → chỉ khi tester thực sự cần (nhúng flow cắt ngay trong context, giữ cut-many).
- Repeated (5. Tìm kiếm) ✅ — cùng blockId lặp trong sequence.

---

## D. CHỐT

- UX chính của Automation: **compose từ Library**; UX "dán+dán+dán" không còn là luồng chính.
- Codegen ↔ Automation độc lập, chia sẻ Action Library / Recording Library.
- Case Đơn vị tính: 1 recording → 6 thao tác → Library → compose TC Thêm / Tìm / Sửa (Sửa có Tìm→Sửa→Tìm) — không record lại.
