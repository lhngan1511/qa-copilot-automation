# WIREFRAME (TEXT) — CHECKPOINT 6C: UX CORRECTION — Testcase Context → Gắn thao tác → Xác nhận → Expected → Assertion → Sinh automation

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **WIREFRAME — CHỜ NGƯỜI DÙNG DUYỆT. CHƯA CODE (không sửa React/backend).**
> Nền: data model 6B đã duyệt (`1750a17`): RecordingSession → ActionBlock (snapshot) → TestCaseAutomationBinding.
> Mục tiêu: tester KHÔNG cần hiểu ActionBlock / Binding / Snapshot / Segment / sourceRange — chỉ hiểu **Testcase → Gắn thao tác đã record → Xác nhận → Kết quả mong đợi → Điều kiện xác nhận → Sinh automation**.

---

## 1. TESTCASE LUÔN LÀ CONTEXT CHÍNH

### 1.1 Card testcase — một primary action theo trạng thái

```
┌──────────────────────────────────────────────────────────────────┐
│ TC001 · Thêm đơn vị tính hợp lệ          [ POSITIVE ] [Đã chọn]  │
│ Kết quả mong đợi: Thêm đơn vị tính thành công                   │
│ Tự động hóa: Chưa hoàn tất                                      │
│                                    [ Thiết lập Automation ]     │
└──────────────────────────────────────────────────────────────────┘
```

Primary action đổi theo trạng thái (chỉ MỘT nút — không đầy nút):

| Trạng thái automation | Primary action |
|---|---|
| Chưa có thao tác nào | `[ Thiết lập Automation ]` |
| Đã có thao tác nhưng thiếu điều kiện xác nhận | `[ Hoàn tất Automation ]` |
| Đã đủ (thao tác + assertion TESTER_CONFIRMED) | `[ Xem Automation ]` |

### 1.2 Drawer — header testcase luôn hiện

Mở từ card → Drawer của đúng TC, header cố định ở mọi tab:

```
┌──────────────────────────────────────────────────────────────────────┐
│ TC001 — Thêm đơn vị tính hợp lệ                             [ ✕ ]   │
│ Kết quả mong đợi: Thêm đơn vị tính thành công                       │
│ Tự động hóa: Chưa hoàn tất                                          │
│ ──────────────────────────────────────────────────────────────────── │
│ Tabs: [ Thao tác ]  [ Test Data ]  [ Kết quả mong đợi ]             │
│ ──────────────────────────────────────────────────────────────────── │
│ (nội dung tab — bên dưới)                                           │
│ ──────────────────────────────────────────────────────────────────── │
│ [ Đóng ]                                        [ Hành động chính ] │
└──────────────────────────────────────────────────────────────────────┘
```

- Tester luôn thấy **"Tôi đang làm automation cho TC001"** — không bao giờ bị đẩy sang màn hình global mất context.
- Không bao giờ hỏi lại "chọn testcase nào" khi mở từ TC001.

---

## 2. SIMPLE PATH — RẤT NGẮN (mặc định)

Testcase đơn giản (VD Login / TC độc lập):

```
TC001 → [Thiết lập Automation]
  → Drawer tab "Thao tác": [ Gắn bản ghi ] → dán source (hoặc chọn bản ghi có sẵn)
  → chọn phần cần dùng (Start/End — mục 3)
  → [ Xác nhận thao tác ]
  → tab "Kết quả mong đợi" → Đề xuất → Áp dụng → Xác nhận
  → [ Sinh automation ]
```

- Tester **không cần biết**: đặt tên block, PRIVATE/REUSABLE, binding, segment, snapshot.
- Hệ thống âm thầm tạo "thao tác private" phía sau (ActionBlock scope=PRIVATE) và gắn vào TC đang mở.
- Nếu toàn bộ bản ghi chỉ phục vụ testcase này → nút phụ `[ Chọn toàn bộ bản ghi ]` (vẫn phải xác nhận).

---

## 3. CHỌN THAO TÁC — Start/End DROPDOWN + HIGHLIGHT KHỐI

Bỏ UX "click step đầu → click step cuối". Điều khiển chính là dropdown:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Bản ghi:  [ Bản ghi #01 · 12 bước · (nguồn: dán mã) ▼ ]              │
│           [ + Dán bản ghi mới ]   [ Ghi mới (Recorder sau này) ]     │
│                                                                      │
│ Timeline (theo thứ tự thao tác):                                     │
│  [1] Mở /login                          [7] Nhập Mã                  │
│  [2] Nhập Tài khoản                     [8] Nhập Tên                 │
│  [3] Nhập Mật khẩu                      [9] Click Trạng thái         │
│  [4] Click Đăng nhập                    [10] Click Lưu               │
│  [5] Mở Danh mục ĐVT                    [11] ...                     │
│  [6] Click nút Thêm                     [12] ...                     │
│                                                                      │
│ Bắt đầu:   [ 6 — Click nút Thêm ▼ ]                                  │
│ Kết thúc:  [ 10 — Click Lưu ▼ ]                                      │
│                                                                      │
│ ✓ Đã chọn bước 6 → 10 · 5 thao tác                                   │
│  6  Click "Thêm"                                                     │
│  7  Fill "Mã"                                                        │
│  8  Fill "Tên"                                                       │
│  9  Click "Trạng thái"                                               │
│  10 Click "Lưu"                                                      │
│                                                                      │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (highlight khối 6→10 trên timeline)           │
│                                                                      │
│ ☐ Lưu thao tác này để dùng lại cho testcase khác                    │
│   (nếu chọn → hiện ô: Tên thao tác: [ Thêm đơn vị tính        ] )    │
│                                                                      │
│                        [ Đổi phạm vi ]   [ Xác nhận thao tác ]       │
└──────────────────────────────────────────────────────────────────────┘
```

- Dropdown hiển thị `số — mô tả` (VD `6 — Click nút Thêm`) để tester chọn đúng.
- Highlight toàn bộ vùng chọn trên timeline + danh sách steps đã chọn hiện rõ.
- `[ Đổi phạm vi ]` quay lại chỉnh dropdown. `[ Xác nhận thao tác ]` là primary.
- Click timeline vẫn là shortcut chọn nhanh, nhưng không phải cách duy nhất.
- **Reuse là TÙY CHỌN:** `☐ Lưu thao tác này để dùng lại` **mặc định KHÔNG chọn**. Chỉ khi chọn mới yêu cầu đặt tên (tên bắt buộc). Không tự phát hiện, không AI, không tự reuse theo tên testcase.

---

## 4. SAU KHI XÁC NHẬN — "Các thao tác sẽ chạy" (Composition Path)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Các thao tác sẽ chạy (theo thứ tự):                                  │
│                                                                      │
│ 1. Đăng nhập                          (Bước chuẩn bị · Bản ghi #01) │
│    ↕ [ Thay thế ] [ Xóa ]                                            │
│ 2. Thêm đơn vị tính                   (Bản ghi #01 · Dùng lại)      │
│    ↕ [ Thay thế ] [ Xóa ]                                            │
│ 3. Nhập thông tin thiết bị            (Bản ghi #01)                  │
│    ↕ [ Thay thế ] [ Xóa ]                                            │
│ 4. Thêm khách hàng                    (Bản ghi #01 · Dùng lại)      │
│    ↕ [ Thay thế ] [ Xóa ]                                            │
│ 5. Hoàn tất nhập kho                  (Bản ghi #01)                  │
│    ↕ [ Thay thế ] [ Xóa ]                                            │
│                                                                      │
│ [ + Thêm thao tác từ bản ghi ]    [ + Dùng lại thao tác đã lưu ]     │
│                                                                      │
│ ⚠ 2 bước trong bản ghi #01 chưa thuộc thao tác nào (không dùng)      │
└──────────────────────────────────────────────────────────────────────┘
```

- ↑ / ↓ để tester tự sắp thứ tự — **KHÔNG tự đẩy "Bước chuẩn bị" lên đầu** (SETUP chỉ là nhãn, thứ tự do tester).
- Mỗi thao tác hiển thị nguồn bản ghi + đánh dấu "Dùng lại" nếu là block REUSABLE.

### 4.1 "Dùng lại thao tác đã lưu" — library đơn giản

```
┌──────────────────────────────────────────────────────────────────────┐
│ Dùng lại thao tác đã lưu (toàn workspace):                           │
│                                                                      │
│  Thêm đơn vị tính                                                    │
│  Nguồn: Bản ghi #01     Đang được dùng bởi: 4 testcase     [ Chọn ] │
│                                                                      │
│  Thêm khách hàng                                                     │
│  Nguồn: Bản ghi #02     Đang được dùng bởi: 2 testcase     [ Chọn ] │
│                                                                      │
│  Đăng nhập                                                           │
│  Nguồn: Bản ghi #01     Đang được dùng bởi: 10 testcase    [ Chọn ] │
│                                                                      │
│  (số "đang được dùng bởi" lấy từ reverse dependency 6B — hiển thị   │
│   để tester biết impact trước khi chọn; không tự chọn sẵn)           │
└──────────────────────────────────────────────────────────────────────┘
```

- Ưu tiên hiển thị thao tác của bản ghi đang mở trước, rồi đến "Thao tác đã lưu" trong workspace.
- **Tester quyết định** — không AI matching, không tự chọn.

---

## 5. TAB "TEST DATA" — GIỮ CHỖ (chưa implement)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Test Data cho TC001                                                  │
│                                                                      │
│   Test Data sẽ được cấu hình ở bước tiếp theo.                      │
│                                                                      │
│   (Không lấy giá trị đã record làm Test Data chính thức.            │
│    Bước này chỉ dành vị trí — chưa implement.)                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. TAB "KẾT QUẢ MONG ĐỢI" — GIỮ FLOW 5C ĐÃ DUYỆT

```
┌──────────────────────────────────────────────────────────────────────┐
│ Kết quả mong đợi (nghiệp vụ)                                         │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Thêm đơn vị tính thành công                                      │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ [ Chỉnh sửa kết quả mong đợi ]   (working copy — không đổi approved)│
│                                                                      │
│ Đề xuất điều kiện kiểm tra:  [ Đề xuất điều kiện xác nhận ] (chủ động)│
│   (deterministic — không AI; không bịa khi chưa đủ thông tin)        │
│                                                                      │
│ Điều kiện xác nhận:                                                  │
│  1. Hiển thị nội dung "Đã lưu thành công"   [ Đã xác nhận ✓ ]        │
│     [ Chỉnh sửa ] [ Xóa ]                                            │
│   [ + Bổ sung điều kiện kiểm tra ]                                   │
│ ✓ Điều kiện xác nhận đã được tester xác nhận (1)                     │
└──────────────────────────────────────────────────────────────────────┘

Footer drawer: [ Đóng ]  [ Sinh automation ]  ← chỉ bật khi đủ gate:
   chọn Automation + ≥1 thao tác CONFIRMED + ≥1 assertion TESTER_CONFIRMED
```

---

## 7. PRIMARY ACTION + VỊ TRÍ GENERATE

- **Generate chỉ xuất hiện ở nơi hoàn tất flow** (drawer footer khi đủ gate) — không đặt nhiều nút Generate rải rác.
- Card chỉ có 1 primary theo trạng thái (mục 1.1).
- Các thao tác phụ (Xóa/Thay thế/Đổi phạm vi) dạng link/menu nhỏ — không hàng loạt nút lớn.

---

## 8. CHỨNG MINH 3 CASE

### CASE A — Login đơn giản (SIMPLE PATH)

```
TC001 "Đăng nhập thành công" → [Thiết lập Automation]
  → tab Thao tác → [Gắn bản ghi] → dán source (4 bước)
  → Bắt đầu [1 — Mở /login ▼] · Kết thúc [4 — Click Đăng nhập ▼]
  → ✓ Đã chọn bước 1 → 4 (4 thao tác) → [Xác nhận thao tác]
  → "Các thao tác sẽ chạy: 1. Đăng nhập"   (không hỏi tên/private/reusable)
  → tab Kết quả mong đợi → Đề xuất → Áp dụng → Nháp → Xác nhận
  → [Sinh automation] → GENERATED
```

### CASE B — Thêm ĐVT có 4 testcase (REUSE do tester chủ động)

```
Lần đầu (TC "Thêm ĐVT - hợp lệ"):
  → cắt bước 6→10, tích ☑ "Lưu thao tác này để dùng lại" → Tên: "Thêm đơn vị tính"
  → [Xác nhận thao tác] → thao tác xuất hiện trong library (đang dùng bởi: 1)

3 testcase còn lại (khác expected/assertion):
  → [Thiết lập Automation] → tab Thao tác → [+ Dùng lại thao tác đã lưu]
  → library: "Thêm đơn vị tính · Đang được dùng bởi: 1 testcase · [Chọn]"
  → [Chọn] → thao tác xuất hiện trong "Các thao tác sẽ chạy"
  → Expected/Assertion riêng → [Sinh automation]

→ KHÔNG record 4 lần. KHÔNG tự gợi ý reuse — tester chủ động [Chọn].
→ LƯU Ý 6C: chưa giải Test Data khác nhau của 4 TC (để checkpoint Test Data sau).
```

### CASE C — Nhập kho nested flow (COMPOSITION PATH)

```
TC "Nhập kho thiết bị (hợp lệ)" → [Thiết lập Automation]
  → tab Thao tác: gắn bản ghi dài → cắt lần lượt 7 thao tác:
      1. Đăng nhập (Bước chuẩn bị)
      2. Vào màn hình Nhập kho
      3. Nhập thông tin thiết bị
      4. Thêm đơn vị tính        ← dùng lại (hoặc cắt mới + ☑ lưu)
      5. Tiếp tục nhập kho
      6. Thêm khách hàng         ← dùng lại
      7. Hoàn tất nhập kho
  → sắp xếp ↑↓ (nếu cần) — KHÔNG tự đẩy SETUP lên đầu
  → Expected Result: "Nhập kho thành công" + Assertion riêng
  → [Sinh automation]

→ Header vẫn là "TC Nhập kho thiết bị" — nested function (Thêm ĐVT/Thêm KH)
  chỉ là thao tác 4 và 6 trong list, KHÔNG biến thành testcase chính.
→ Tester nhìn rõ: đây vẫn là automation của TC Nhập kho.
```

---

## 9. THUẬT NGỮ UI (tester) ↔ Backend (6B)

| UI | Backend |
|---|---|
| Bản ghi | RecordingSession |
| Thao tác | ActionBlock |
| Bước chuẩn bị | ActionBlock kind=SETUP |
| Lưu thao tác để dùng lại | scope=REUSABLE (label bắt buộc) |
| Các thao tác sẽ chạy | TestCaseAutomationBinding.sequence |
| Đang được dùng bởi N testcase | reverse dependency (getBlockUsage) |
| Dán bản ghi / Ghi mới | tạo RecordingSession |

**KHÔNG hiển thị cho tester:** ActionBlock · Binding · Snapshot · Segment · sourceRange · PRIVATE/REUSABLE (chỉ hiện "Dùng lại" khi đã lưu).

---

## 10. ĐIỀU CHƯA LÀM Ở 6C (giới hạn checkpoint)

- CHƯA code (không sửa React/backend).
- CHƯA Test Data thật (tab chỉ giữ chỗ).
- CHƯA slot/parameterization/function compiler.
- CHƯA Runner / AI / Step 6.

## 11. CÂU HỎI CHỜ NGƯỜI DÙNG DUYỆT

1. Primary action theo trạng thái `[Thiết lập Automation] / [Hoàn tất Automation] / [Xem Automation]` — đồng ý?
2. "Lưu thao tác này để dùng lại" đặt ngay trong form xác nhận thao tác (như mục 3) — đồng ý?
3. Library reuse hiển thị "Đang được dùng bởi N testcase" (từ reverse dependency 6B) — đồng ý?
4. Tab "Test Data" đặt giữa "Thao tác" và "Kết quả mong đợi" với placeholder — đồng ý?
5. Simple Path: nút phụ `[ Chọn toàn bộ bản ghi ]` khi bản ghi chỉ phục vụ 1 TC — có cần không?
6. Sau duyệt, 6C implementation sẽ: UI card/drawer context + Start/End dropdown + binding UI (gọi API 6B) — đồng ý phạm vi này?
