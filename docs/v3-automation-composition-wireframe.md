# WIREFRAME (TEXT) — UX mới: Testcase Context → Gắn bản ghi → Thao tác (Action Block) → Binding → Data → Expected → Assertion → Generate

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **6 QUYẾT ĐỊNH ĐÃ CHỐT (mục 8) — đang Checkpoint 6A (fix data bugs).** Kèm theo `docs/V3_AUTOMATION_COMPOSITION_DESIGN.md` (data model + CASE A/B/C + checkpoint 6A→6D).
> Nguyên tắc: **TESTER LUÔN GIỮ CONTEXT TESTCASE** · Thao tác (Action Block) ≠ TestCase · reuse do tester quyết định · không AI · không theo thứ tự/index.

---

## 0. Luồng tổng thể (KHÔNG đảo — chỉ sửa cách hiển thị)

```
Card TC001 → [Gắn bản ghi] → Drawer TC001 (context giữ nguyên)
  → tab "Thao tác": chọn bản ghi → chọn Start/End → [Xác nhận thao tác] (tùy chọn "Lưu để dùng lại")
  → (tùy chọn) [Dùng lại thao tác] từ toàn workspace
  → danh sách "Các thao tác sẽ chạy" (binding, ↑↓ sắp xếp — KHÔNG tự reorder)
  → tab "Test Data" (giữ chỗ — chưa implement, design only)
  → tab "Kết quả mong đợi" → tab "Điều kiện xác nhận" → [Sinh automation] (drawer footer)
```

### 0.1 PROGRESSIVE COMPLEXITY — Simple Path / Composition Path

- **SIMPLE PATH (mặc định):** testcase đơn giản (VD Login) — UI gần như cũ: TC001 → [Gắn bản ghi] → hiển thị thao tác trong context TC001 → xác nhận → Expected → Assertion → Generate. Backend vẫn tạo private thao tác + binding nhưng tester **không thấy** thuật ngữ ActionBlock/Slot/Binding/Composition. Nếu toàn recording chỉ phục vụ testcase hiện tại → UI có nút **"Chọn toàn bộ bản ghi"** (vẫn cần xác nhận).
- **COMPOSITION PATH (chỉ khi cần):** reuse / nhiều đoạn / nested flow → UI mở thêm "Dùng lại thao tác", "Thao tác đã lưu", sắp xếp sequence.
- **COMPLEXITY CHỈ XUẤT HIỆN KHI TESTER CẦN.**

---

## 1. CARD TESTCASE (context + trạng thái tóm tắt)

```
┌──────────────────────────────────────────────────────────────┐
│ ☑ TC001 · Đăng nhập thành công          [ POSITIVE ] [Đã chọn]│
│ Tự động hóa: Có automation                                   │
│ Thao tác: 2 đoạn đã xác nhận                                 │
│ Điều kiện xác nhận: 1 đã xác nhận                            │
│ [ Gắn bản ghi ]  ···                                         │
└──────────────────────────────────────────────────────────────┘
```

- `[Gắn bản ghi]` (chưa có block) / `[Xem thao tác]` (đã có block) → mở **Drawer TC001**.
- Không có nút Generate trên card (giữ quyết định 5C #6).

---

## 2. DRAWER TC001 — mở từ card, KHÔNG mất context

```
┌──────────────────────────────────────────────────────────────────────┐
│ TC001 · Đăng nhập thành công                                [ ✕ ]    │
│ Tabs: [Thao tác] [Test Data] [Kết quả mong đợi] [Điều kiện xác nhận] │
│ ───────────────────────────────────────────────────────────────────── │
│ (Nội dung tab — xem bên dưới)                                        │
│ ───────────────────────────────────────────────────────────────────── │
│ [ Đóng ]                                    [ Hành động chính ]      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Không có panel ghi global đầu trang.** Bản ghi được quản lý ngay trong drawer của TC đang mở.
- Nếu tester mở từ TC001 → mọi thao tác đều gắn TC001 mặc định (không hỏi lại testcase).

---

## 3. TAB "THAO TÁC" — chọn Action Block từ bản ghi

```
┌──────────────────────────────────────────────────────────────────────┐
│ Bản ghi:  [ Bản ghi #01 · 16 bước · 2 đoạn đã cắt      ▼ ]          │
│           [ + Dán bản ghi mới ]  [ Ghi mới ] (Recorder sau này)      │
│                                                                      │
│ Timeline (theo thứ tự thao tác — click = shortcut chọn nhanh):       │
│  [1] Mở /login                        [9] Mở Thêm ĐVT (popup)        │
│  [2] Nhập Tài khoản                   [10] Nhập Mã ĐVT               │
│  [3] Nhập Mật khẩu                    [11] Nhập Tên ĐVT              │
│  [4] Bấm Đăng nhập                    [12] Bấm Lưu (popup)           │
│  [5] Bấm Danh mục ĐVT                 [13] Nhập tiếp (Nhập kho)      │
│  [6] Bấm Thêm ĐVT                     [14] ...                       │
│  [7] Nhập Mã ĐVT                      [15] ...                       │
│  [8] Nhập Tên ĐVT                     [16] ...                       │
│                                                                      │
│ Đoạn thao tác mới:                                                   │
│   Bắt đầu:  [ 6 ▼ ]   Kết thúc:  [ 8 ▼ ]                            │
│   ▓▓▓▓▓▓▓▓▓▓ (highlight khối bước 6 → 8 trên timeline)               │
│   Đã chọn bước 6 → 8 (3 thao tác)                                    │
│   Tên thao tác: [ Thêm đơn vị tính                  ]  (tùy chọn)     │
│   ☐ Lưu để dùng lại (bắt buộc đặt tên khi chọn)                      │
│   Loại: (•) Thao tác   ( ) Bước chuẩn bị (đăng nhập/di chuyển)       │
│   [ Đổi phạm vi ]                          [ Xác nhận thao tác ]     │
│                                                                      │
│ Dùng lại thao tác đã có:                                             │
│   [ + Dùng lại thao tác ]  → ưu tiên thao tác của bản ghi hiện tại,  │
│      rồi "Thao tác đã lưu" trong toàn workspace (không tự chọn)      │
└──────────────────────────────────────────────────────────────────────┘
```

**Các thao tác sẽ chạy (binding của TC001 — thứ tự tester sắp xếp):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Các thao tác sẽ chạy (theo thứ tự):                                  │
│  1. Đăng nhập                        (Bước chuẩn bị · Bản ghi #01)   │
│     ↕ [Thay thế] [Xóa]                                               │
│  2. Thêm đơn vị tính                 (Thao tác · Dùng lại · Bản ghi #01) │
│     ↕ [Thay thế] [Xóa]                                               │
│  3. Nhập kho — hoàn tất              (Thao tác · Bản ghi #01)        │
│     ↕ [Thay thế] [Xóa]                                               │
│  [ + Thêm thao tác từ bản ghi khác ]                                 │
│  ⚠ 3 bước trong bản ghi #01 chưa thuộc thao tác nào (không dùng)     │
└──────────────────────────────────────────────────────────────────────┘
```

- ↑/↓ để đổi thứ tự (MVP) — thứ tự này = thứ tự Generate.
- **KHÔNG tự reorder** "Bước chuẩn bị" lên đầu (quyết định #5): SETUP chỉ là metadata; tester quyết định sequence (nested flow cần Main → Sub → Main → Sub).
- "Dùng lại" chỉ thêm **tham chiếu blockId** vào binding — không copy steps; tester xác nhận reuse từng lần (guardrail — tên giống nhau không phải bằng chứng mapping).
- Bước chưa dùng: thông tin, không chặn (giữ quyết định đã chốt).

---

## 4. TAB "TEST DATA" — SAU khi binding (design only — chưa code)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Test Data cho TC001 (chỉ hiển thị khi đã có thao tác được xác nhận)  │
│                                                                      │
│ Các giá trị thay thế trong thao tác (input slot — thiết kế, chưa code)│
│   {{unitCode}}  → [ Kg                    ]  (nút: từ testcase / nhập tay)│
│   {{unitName}}  → [ Kilôgam               ]                           │
│   Mật khẩu      → (dùng env TESTDATA_PASSWORD)                       │
│                                                                      │
│ [ Lưu Test Data ]   · Ghi chú: bước triển khai sau — UI này chưa code│
└──────────────────────────────────────────────────────────────────────┘
```

> Ở giai đoạn design: tab này chỉ xác nhận **vị trí** (sau binding, trước Expected) — không nhập data lúc chọn step.

---

## 5. TAB "KẾT QUẢ MONG ĐỢI" + "ĐIỀU KIỆN XÁC NHẬN" (giữ UX 5C đã duyệt)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Kết quả mong đợi (nghiệp vụ)                                         │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Đăng nhập thành công và hiển thị "Danh mục phần mềm quản lý"      │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ [ Chỉnh sửa kết quả mong đợi ]                                       │
│                                                                      │
│ Đề xuất điều kiện kiểm tra:  [ Đề xuất điều kiện xác nhận ] (chủ động)│
│   (deterministic — giữ nguyên từ 5C)                                 │
│                                                                      │
│ Điều kiện xác nhận:                                                  │
│  1. Hiển thị nội dung "Danh mục phần mềm quản lý"  [Đã xác nhận ✓]   │
│     [Chỉnh sửa] [Xóa]                                                │
│  2. ...                                                              │
│   [ + Bổ sung điều kiện kiểm tra ]                                   │
│ ✓ Điều kiện xác nhận đã được tester xác nhận (1)                     │
└──────────────────────────────────────────────────────────────────────┘

Footer drawer: [ Đóng ]  [ Sinh automation ]  ← chỉ bật khi đủ gate:
   chọn Automation + ≥1 block CONFIRMED + ≥1 assertion TESTER_CONFIRMED
```

---

## 6. Sơ đồ binding cho 3 CASE (minh họa wireframe)

### CASE A — Đăng nhập
```
TC001: [1 Đăng nhập] [2 Vào màn hình chính] → assertion "Danh mục..." toBeVisible
```

### CASE B — CRUD ĐVT (1 bản ghi, 5 block, 10 TC — không record 10 lần)
```
BLK-B1 Đăng nhập · BLK-B2 Mở Danh mục ĐVT · BLK-B3 Thêm ĐVT ({{unitCode}},{{unitName}})
BLK-B4 Sửa ĐVT · BLK-B5 Xóa ĐVT
TC Thêm-01: [B1,B2,B3] data {Kg, Kilôgam}  → expected/assertion riêng
TC Thêm-02: [B1,B2,B3] data {Tấn, Tấn}     → expected/assertion riêng
TC Sửa-01:  [B1,B2,B4] ...
TC Xóa-01:  [B1,B2,B5] ...
```

### CASE C — Nhập kho lồng nhau
```
TC Nhập kho: [C1 Đăng nhập][C2 Mở Nhập kho][C3 Nhập chính][C4 Thêm ĐVT (DÙNG LẠI)]
             [C5 Nhập tiếp][C6 Thêm KH (DÙNG LẠI)][C7 Hoàn tất]
TC Thêm ĐVT (độc lập): [C1][Mở Danh mục ĐVT][C4]   ← C4 dùng lại
TC Cấp phát: [C1][C2][C8]
```

---

## 7. Điều CHƯA làm / phạm vi

- Chưa code Test Data/Slot/function compiler/Runner/AI (checkpoint 6A→6D — xem design doc mục 9).
- Thuật ngữ UI: **"Thao tác"** / **"Nhóm thao tác"** / **"Bước chuẩn bị"** / **"Dùng lại thao tác"** — KHÔNG hiển thị ActionBlock/Segment/Binding/Composition cho tester thông thường (quyết định #1).

## 8. 6 QUYẾT ĐỊNH ĐÃ CHỐT (người dùng — dùng làm nguồn thiết kế chính thức)

1. **Thuật ngữ UI:** dùng **"Thao tác"**; nhóm = **"Nhóm thao tác"**. Không hiển thị ActionBlock / Segment / Binding / Composition cho tester thông thường.
2. **Tab Test Data:** đặt sau "Thao tác", trước "Kết quả mong đợi" (thứ tự dài hạn: Thao tác → Test Data → Kết quả mong đợi → Điều kiện xác nhận → Generate). **CHƯA implementation ở checkpoint này** — chỉ giữ chỗ/data model/design.
3. **"Dùng lại thao tác" lấy từ:** có thể reuse **trong TOÀN WORKSPACE**; UI ưu tiên A) thao tác của recording hiện tại, B) "Thao tác đã lưu" trong workspace. **Không tự chọn** — tester quyết định reuse; không AI matching; có thể thêm search/filter sau.
4. **Đặt tên:** KHÔNG bắt buộc nếu thao tác chỉ dùng cho testcase hiện tại. Nếu tester chọn **"Lưu để dùng lại" → TÊN BẮT BUỘC** (VD "Thêm đơn vị tính", "Đăng nhập"). Private/single-use block không ép đặt tên.
5. **SETUP:** **KHÔNG tự reorder** — tester quyết định sequence. SETUP chỉ là metadata/meaning (nested workflow cần Main → Sub → Main → Sub; auto reorder có thể phá workflow).
6. **Thứ tự implementation:** đồng ý fix BUG 1 + BUG 2 trước, chia checkpoint: **6A** (chỉ fix 2 bug → regression → commit/push → STOP) → **6B** (refactor Segment → ActionBlock + Binding, giữ compatibility → STOP) → **6C** (UX testcase-context + chọn range + reuse → STOP) → **6D** (verify 3 workflow A/B/C trên UI thật → chỉ khi PASS mới coi hoàn tất). CHƯA Step 6 Runner.
