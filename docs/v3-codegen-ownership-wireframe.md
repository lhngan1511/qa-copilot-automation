# WIREFRAME — P0 OWNERSHIP CORRECTION: CODEGEN / ACTION LIBRARY / AUTOMATION

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **CHỜ NGƯỜI DÙNG DUYỆT — CHƯA CODE.**

---

## MÀN 1 — CODEGEN (RECORDING TOOL) — owner của Recording Preparation

```
┌──────────────────────────────────────────────────────────────────┐
│ CODEGEN — Thu thập thao tác Playwright                  [ ✕ ]   │
│ ──────────────────────────────────────────────────────────────── │
│ [ + Ghi mới (Recorder) ]   [ + Dán Playwright ]                 │
│                                                                  │
│ BẢN GHI PLAYWRIGHT (24 bước)                                    │
│  1. Mở trang đăng nhập                                           │
│  2. Nhập Tài khoản                                               │
│  ...                                                             │
│  8. Click Thêm                                                   │
│  ...                                                             │
│ 24. ...                                                          │
│                                                                  │
│ [ Phân tích bản ghi ]   ← AI đề xuất phân đoạn (sau này)        │
│                                                                  │
│ ĐỀ XUẤT (candidate action — review được):                      │
│  1. Đăng nhập              Bước 1 → 4                            │
│     Evidence: nhập Tài khoản · nhập Mật khẩu · click Đăng nhập   │
│     Verification: adminButton hiển thị                          │
│     [Xác nhận] [Chỉnh phạm vi] [Đổi tên] [Bỏ qua]               │
│  2. Mở Đơn vị tính         Bước 5 → 7                            │
│     Evidence: mở menu Danh mục · chọn Đơn vị tính                │
│     Verification: không tìm thấy                                │
│     [Xác nhận] [Chỉnh phạm vi] [Đổi tên] [Bỏ qua]               │
│  3. ⚠ Không đủ bằng chứng  Bước 21 → 24                          │
│     Evidence: click · click                                      │
│     [Đặt tên] [Bỏ qua]                                          │
│                                                                  │
│ [ Lưu vào thư viện thao tác ]  ← chỉ sau khi tester xác nhận    │
│ (mỗi proposal xác nhận → thành candidate; bấm Lưu → Library)     │
└──────────────────────────────────────────────────────────────────┘
```

- Manual cut vẫn tồn tại (chọn range tay) — cùng tạo candidate như AI proposal sau xác nhận.
- AI không tự map testcase; không tự persist.

---

## MÀN 2 — ACTION LIBRARY (shared asset — tái sử dụng màn hiện có)

```
┌──────────────────────────────────────────────────────────────────┐
│ THƯ VIỆN THAO TÁC                                                │
│                                                                  │
│  Đăng nhập           · Bước chuẩn bị · Dùng bởi 3 testcase [Chọn]│
│  Mở Đơn vị tính      · Bước chuẩn bị · Dùng bởi 3 testcase [Chọn]│
│  Thêm đơn vị tính    · Thao tác       · Dùng bởi 2 testcase [Chọn]│
│  Tìm kiếm đơn vị tính· Thao tác       · Dùng bởi 4 testcase [Chọn]│
│  Sửa đơn vị tính     · Thao tác       · Dùng bởi 1 testcase [Chọn]│
│  Xóa đơn vị tính     · Thao tác       · Dùng bởi 1 testcase [Chọn]│
└──────────────────────────────────────────────────────────────────┘
```

- Khi `[Chọn]` → thêm vào "Chuỗi thao tác sẽ chạy" của testcase đang mở (context giữ).

---

## MÀN 3 — AUTOMATION WORKSPACE — tab "Thao tác" (owner của Composition)

```
┌──────────────────────────────────────────────────────────────────┐
│ TC001 · Sửa đơn vị tính thành công                       [ ✕ ]   │
│ ──────────────────────────────────────────────────────────────── │
│ Chuỗi thao tác sẽ chạy:                                          │
│  1. Đăng nhập                          ↑ ↓ [Xóa]                 │
│  2. Mở danh mục Đơn vị tính            ↑ ↓ [Xóa]                 │
│  3. Tìm kiếm đơn vị tính               ↑ ↓ [Xóa]                 │
│  4. Sửa đơn vị tính                    ↑ ↓ [Xóa]                 │
│  5. Tìm kiếm đơn vị tính               ↑ ↓ [Xóa]  ← lặp lại     │
│                                                                  │
│ [ + Thêm thao tác từ thư viện ]        ← PRIMARY                 │
│                                                                  │
│ ──────────────────────────────────────────────────────────────── │
│ Không có thao tác phù hợp?                                       │
│ [ Tạo thao tác mới từ bản ghi ]        ← SECONDARY fallback      │
│ ──────────────────────────────────────────────────────────────── │
│                                                                  │
│ KẾT QUẢ MONG ĐỢI: Sửa đơn vị tính thành công                    │
│ ĐIỀU KIỆN XÁC NHẬN: 1 đã xác nhận                               │
│ ──────────────────────────────────────────────────────────────── │
│ [ Đóng ]                                  [ Sinh automation ]    │
└──────────────────────────────────────────────────────────────────┘
```

- **Primary = `[+ Thêm thao tác từ thư viện]`**; "Dán bản ghi Playwright" không còn ngang hàng (chuyển thành fallback "Tạo thao tác mới từ bản ghi" — mở Codegen tool, hoặc nhúng tối thiểu).
- Repeated `D→E→D` giữ; reorder ↑↓ giữ.

---

## TÓM TẮT THAY ĐỔI UX

| Hiện tại (sai ownership) | Sau (đúng ownership) |
|---|---|
| Tab Thao tác có `[Dán bản ghi Playwright]` + `[Dùng thao tác đã có]` ngang hàng | Primary `[+ Thêm thao tác từ thư viện]`; `[Tạo thao tác mới từ bản ghi]` fallback |
| Recording prep (paste/cut) nằm trong testcase | Chuyển sang **Codegen tool** (độc lập) |
| `[Lưu vào thư viện]` ngay tại testcase | Lưu chủ yếu ở Codegen sau khi xác nhận proposal; Workspace chỉ **dùng** |
| AI analysis "vài dòng mô tả" (trước) | **Proposal review được** → confirm → snapshot thật → chủ động lưu Library |
