# WIREFRAME — CHECKPOINT 6C (ĐƠN GIẢN HÓA UX): Tester chỉ cần hiểu 3 thứ

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **CHỜ NGƯỜI DÙNG DUYỆT — CHƯA CODE.**
> Mental model duy nhất: **TESTCASE → THAO TÁC → KẾT QUẢ MONG ĐỢI / ĐIỀU KIỆN XÁC NHẬN → SINH AUTOMATION.**
> KHÔNG hiển thị: ActionBlock · Binding · Segment · Snapshot · PRIVATE · REUSABLE · sourceRange · Composition Path.

---

## MÀN HÌNH A — CARD TESTCASE

```
┌──────────────────────────────────────────────────────────────┐
│ TC001 — Thêm đơn vị tính hợp lệ       [ POSITIVE ] [Đã chọn] │
│ Kết quả mong đợi: Thêm đơn vị tính thành công                │
│ Automation: Chưa thiết lập                                    │
│                                        [ Tạo Automation ]    │
└──────────────────────────────────────────────────────────────┘
```

Primary action theo trạng thái (chỉ 1 nút):
- Chưa thiết lập → `[ Tạo Automation ]`
- Đang làm dở → `[ Tiếp tục Automation ]`
- Đã Generate → `[ Xem Automation ]`

Bấm vào → mở drawer **vẫn giữ header TC001** ở mọi bước (không chuyển màn hình recording global, không hỏi lại testcase).

---

## MÀN HÌNH B — CHỌN NGUỒN THAO TÁC

```
┌──────────────────────────────────────────────────────────────┐
│ TC001 — Thêm đơn vị tính hợp lệ                     [ ✕ ]   │
│ ──────────────────────────────────────────────────────────── │
│ THAO TÁC                                                     │
│                                                              │
│ Testcase này chưa có thao tác automation.                    │
│                                                              │
│ [ Dán bản ghi Playwright ]                                   │
│ [ Dùng thao tác đã có ]                                      │
└──────────────────────────────────────────────────────────────┘
```

Chỉ 2 lựa chọn. Không hiện thuật ngữ kỹ thuật.

---

## MÀN HÌNH C — SAU KHI DÁN RECORDING: DÙNG TOÀN BỘ / CHỌN MỘT PHẦN

```
┌──────────────────────────────────────────────────────────────┐
│ TC001 — Thêm đơn vị tính hợp lệ                     [ ✕ ]   │
│ ──────────────────────────────────────────────────────────── │
│ BẢN GHI PLAYWRIGHT                                           │
│  1. Mở trang đăng nhập                                       │
│  2. Nhập tài khoản                                           │
│  3. Nhập mật khẩu                                            │
│  4. Đăng nhập                                                │
│  5. Mở Danh mục                                              │
│  6. Mở Đơn vị tính                                           │
│  7. Click Thêm                                               │
│  8. Nhập Mã                                                  │
│  9. Nhập Tên                                                 │
│ 10. Click Lưu                                                │
│ 11. Click Sửa                                                │
│ 12. ...                                                      │
│                                                              │
│ Bạn muốn dùng phần nào cho TC001?                            │
│ (•) Dùng toàn bộ bản ghi                                     │
│ ( ) Chọn một phần                                            │
│                                                              │
│ ✓ Sử dụng toàn bộ 12 thao tác                     [ Xác nhận thao tác ] │
└──────────────────────────────────────────────────────────────┘
```

**Nếu chọn "Dùng toàn bộ":** không hỏi Start/End, không hỏi tên, không hỏi reuse — chỉ preview + `[Xác nhận thao tác]`. (Backend tạo thao tác private phía sau — tester không cần biết.)

**Nếu chọn "Chọn một phần"** — hiện dropdown + preview rõ:

```
│ Bắt đầu:  [ 7 — Click Thêm          ▼ ]                      │
│ Kết thúc: [ 10 — Click Lưu          ▼ ]                      │
│                                                              │
│ Đã chọn bước 7 → 10 · 4 thao tác                             │
│   7. Click Thêm                                              │
│   8. Nhập Mã                                                 │
│   9. Nhập Tên                                                │
│  10. Click Lưu                                               │
│                                                              │
│                                 [ Xác nhận thao tác ]        │
```

- Timeline highlight khối 7→10; `[Đổi phạm vi]` để chỉnh lại dropdown.
- Không dùng cơ chế "click step đầu → click step cuối" như UI cũ.

---

## MÀN HÌNH D — DANH SÁCH THAO TÁC CỦA TESTCASE + REUSE (TÙY CHỌN)

Sau khi xác nhận, hiện:

```
┌──────────────────────────────────────────────────────────────┐
│ TC020 — Nhập kho thiết bị                           [ ✕ ]   │
│ ──────────────────────────────────────────────────────────── │
│ THAO TÁC SẼ CHẠY                                            │
│  1. Vào Nhập kho                                             │
│     ↕ [ Thay thế ] [ Xóa ]                                   │
│  2. Nhập thông tin thiết bị                                  │
│     ↕ [ Thay thế ] [ Xóa ]                                   │
│  3. Thêm đơn vị tính                                         │
│     ↕ [ Thay thế ] [ Xóa ]                                   │
│  4. Tiếp tục Nhập kho                                        │
│     ↕ [ Thay thế ] [ Xóa ]                                   │
│  5. Thêm khách hàng                                          │
│     ↕ [ Thay thế ] [ Xóa ]                                   │
│  6. Hoàn tất Nhập kho                                        │
│     ↕ [ Thay thế ] [ Xóa ]                                   │
│                                                              │
│ [ + Thêm thao tác ]   [ + Dùng thao tác đã có ]              │
│                                                              │
│ ↑ ↓ để tự sắp thứ tự — hệ thống không tự đổi thứ tự.         │
└──────────────────────────────────────────────────────────────┘
```

- **Header vẫn luôn là TC020** — "Thêm đơn vị tính" / "Thêm khách hàng" chỉ là thao tác bên trong automation TC020, không đổi context sang testcase khác.
- `[Lưu thao tác để dùng lại]` là **tùy chọn phụ** (không bắt buộc) — nếu bấm:

```
│ Lưu thao tác để dùng lại                                     │
│ Tên thao tác: [ Thêm đơn vị tính                     ]      │
│ "Có thể dùng lại thao tác này cho testcase khác             │
│  mà không cần record lại."                                   │
│                                            [ Lưu ]           │
```

**"Dùng thao tác đã có"** (cho testcase khác — VD TC002):

```
│ THAO TÁC ĐÃ LƯU                                              │
│  Thêm đơn vị tính   · Đang dùng bởi 1 testcase   [ Xem ] [ Dùng ] │
│  Thêm khách hàng    · Đang dùng bởi 2 testcase   [ Xem ] [ Dùng ] │
│  Đăng nhập          · Đang dùng bởi 10 testcase  [ Xem ] [ Dùng ] │
│                                                              │
│ Tester tự chọn — không tự gợi ý theo tên testcase.           │
```

---

## MÀN HÌNH E — KẾT QUẢ MONG ĐỢI → ĐIỀU KIỆN XÁC NHẬN → SINH AUTOMATION

```
┌──────────────────────────────────────────────────────────────┐
│ TC001 — Thêm đơn vị tính hợp lệ                     [ ✕ ]   │
│ ──────────────────────────────────────────────────────────── │
│ KẾT QUẢ MONG ĐỢI                                            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Thêm đơn vị tính thành công                              │ │
│ └──────────────────────────────────────────────────────────┘ │
│ [ Chỉnh sửa kết quả mong đợi ]  (lưu trong workspace —      │
│                                  không đổi file đã duyệt)    │
│                                                              │
│ ĐỀ XUẤT ĐIỀU KIỆN KIỂM TRA                                  │
│ [ Đề xuất điều kiện xác nhận ]                               │
│   → hiện đề xuất → [ Áp dụng ] → Nháp → [ Xác nhận ]         │
│                                                              │
│ ĐIỀU KIỆN XÁC NHẬN                                          │
│  1. Hiển thị nội dung "Đã lưu thành công"   [ Đã xác nhận ✓ ]│
│     [ Chỉnh sửa ] [ Xóa ]                                    │
│   [ + Bổ sung điều kiện kiểm tra ]                           │
│                                                              │
│ ✓ Điều kiện xác nhận đã được tester xác nhận (1)             │
│                                                              │
│ ──────────────────────────────────────────────────────────── │
│ [ Đóng ]                              [ Sinh automation ]    │
└──────────────────────────────────────────────────────────────┘
```

- Giữ nguyên flow 5C: Expected Result (working copy) → Đề xuất (chủ động) → Áp dụng = Nháp → tester chỉnh → Xác nhận.
- **`[Sinh automation]` chỉ bật khi đủ:** testcase chọn Automation + có thao tác đã xác nhận + ≥1 điều kiện xác nhận TESTER_CONFIRMED.
- Generate chỉ xuất hiện ở đây (trong flow automation) — không rải rác nhiều nút.

---

## 3 CASE MINH HỌA

### CASE A — LOGIN ĐƠN GIẢN (gần như không cấu hình gì)
```
TC Login → [Tạo Automation] → [Dán bản ghi Playwright] → dán 4 bước
→ (•) Dùng toàn bộ bản ghi → ✓ Sử dụng toàn bộ 4 thao tác → [Xác nhận thao tác]
→ Expected Result → [Đề xuất điều kiện xác nhận] → Áp dụng → Xác nhận
→ [Sinh automation] → GENERATED
```
Không phải đặt tên, không chọn private/reusable, không hiểu binding.

### CASE B — THÊM ĐƠN VỊ TÍNH CÓ 4 TESTCASE (reuse chủ động)
```
TC01: dán recording → chọn phần 7→10 → xác nhận → [Lưu thao tác để dùng lại] → tên "Thêm đơn vị tính"
TC02/03/04: [Tạo Automation] → [Dùng thao tác đã có] → "Thêm đơn vị tính" → [Dùng]
→ mỗi TC có Expected Result / Điều kiện xác nhận riêng → [Sinh automation]
```
Không record 4 lần. LƯU Ý 6C: chưa giải Test Data khác nhau (checkpoint riêng sau).

### CASE C — NHẬP KHO CÓ CHỨC NĂNG LỒNG
```
TC Nhập kho: [Tạo Automation] → dán bản ghi dài → lần lượt tạo 6 thao tác:
  1. Vào Nhập kho · 2. Nhập thông tin thiết bị · 3. Thêm đơn vị tính
  · 4. Tiếp tục Nhập kho · 5. Thêm khách hàng · 6. Hoàn tất Nhập kho
→ ↑↓ sắp thứ tự nếu cần → Expected + Assertion riêng → [Sinh automation]
```
Header vẫn là **TC Nhập kho** — Thêm ĐVT / Thêm KH chỉ là thao tác 3 và 5 bên trong; không biến thành testcase chính.

---

## PHẠM VI CHECKPOINT 6C

- CHỈ wireframe/docs — **KHÔNG code** (không React/backend/database).
- CHƯA Test Data (không thêm tab placeholder nếu gây rối) — checkpoint riêng sau.
- CHƯA slots/parameterization/AI/Runner/function compiler/Page Object.

## CÂU HỎI CHỜ NGƯỜI DÙNG DUYỆT

1. 5 màn hình A–E + primary action `[Tạo Automation] / [Tiếp tục Automation] / [Xem Automation]` — đồng ý?
2. "Dùng toàn bộ bản ghi" là lựa chọn mặc định khi recording ngắn/đơn lẻ — đồng ý?
3. Reuse đặt là **tùy chọn phụ sau khi xác nhận** (`[Lưu thao tác để dùng lại]`) — đồng ý?
4. Library "Thao tác đã lưu" hiển thị "Đang dùng bởi N testcase" — đồng ý?
5. Test Data **không** xuất hiện trong 6C (bỏ tab placeholder) — đồng ý?
6. Sau duyệt, 6C implementation gồm: card/drawer context + dán recording → toàn bộ/một phần + danh sách thao tác + reuse + Expected/Assertion (gọi API 6B) — đồng ý phạm vi?
