# VALIDATION — Chức năng Đơn vị tính: Recording → Action → Testcase Composition

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **TRACE + PHÂN TÍCH + WIREFRAME — CHƯA CODE.** Chờ người dùng duyệt.
> Nền: P0 Drawer Context fix `2dbec56` · Model 6B (RecordingSession → ActionBlock snapshot → TestCaseAutomationBinding).

---

## 1. Case thực tế

MỘT phiên Playwright Codegen liên tục cho Danh mục Đơn vị tính:

```
A. Đăng nhập                    B. Mở chức năng (Danh mục → Đơn vị tính)
C. Thêm (click Thêm → nhập → Lưu → verification)   D. Tìm kiếm (nhập → Tìm → verification)
E. Sửa (chọn record → Sửa → đổi → Lưu → verification)   F. Tìm lại sau sửa
G. Xóa (tìm record → Xóa → xác nhận → verification)
```

→ Đây là **MỘT recording dài**, KHÔNG phải 7 testcase, KHÔNG bắt paste lại 7 lần.

Compose mong muốn:
- TC Thêm thành công: `A → B → C`
- TC Tìm kiếm có kết quả: `A → B → D`
- TC Sửa thành công: `A → B → D → E → D`  ⚠ D lặp 2 lần
- TC Xóa thành công: `A → B → D → G → D`

---

## 2. KẾT QUẢ TRACE 5 CÂU BẮT BUỘC (bằng code thật)

### Câu 1 — MULTIPLE BLOCKS FROM ONE RECORDING

- **Backend: SUPPORT.** `POST /blocks` với cùng `recordingId` nhiều lần (range khác nhau) → tạo nhiều block từ 1 recording; `recordedAssertionsInRange` tính lại từng block. (Đã trace: cắt 1–4, 7–10, 11–12 từ cùng recording → 3 block riêng, mỗi cái recordedAssertionCount=1.)
- **UI: KHÔNG hỗ trợ continue-cutting.** `V3ActionSetupPanel.confirmAction` kết thúc bằng `setSteps([]); setSource(""); setScreen("list")` — **recording bị reset khỏi UI**; `[+ Thêm thao tác]` → mở lại màn paste → **bắt dán lại** (tạo RecordingSession mới).
- **Kết luận:** backend đủ, UI thiếu "giữ recording để cắt đoạn tiếp theo".

### Câu 2 — CONTINUE CUTTING SAME RECORDING

- **KHÔNG.** Sau khi lưu block đầu, UI đóng/reset recording; tester phải paste lại (mỗi lần paste = 1 RecordingSession mới). Trace: `openPaste()` luôn `setSource(""); setSteps([])`; sau confirm `setSteps([]); setSource("")`.
- Đây là **UX P0 của checkpoint này**: recording dài phải ở lại (giữ `recordingId` trong state/panel) để tester tiếp tục cắt block 2, 3... mà không paste lại.

### Câu 3 — REPEATED BLOCK IN ONE TESTCASE (D → E → D)

- **KHÔNG được phép (hiện tại).** Trace thật: bind cùng blockId lần 2 → `binding.sequence` vẫn 1 item.
- Nguyên nhân code: `AutomationWorkspace.bindBlockToTestCase` có guard `if (!seq.some(ref => ref.blockId === blockId))` → bỏ qua lần bind trùng.
- Ngoài ra `reorderBinding` dùng `new Set(blockIds)` + `byId = new Map(...)` → **sẽ làm mất ref trùng** khi sắp xếp (Map giữ 1 entry). `GenerateService.resolveBlockFlow` lặp từng ref theo order → **đã sẵn sàng xử lý duplicate** nếu model cho phép.
- **Kết luận:** cần nới guard ở `bindBlockToTestCase` + sửa `reorderBinding` để sequence cho phép **cùng blockId nhiều lần** (D→E→D) — đây là thay đổi nhỏ, model 6B không đổi (sequence vẫn `[{blockId, order}]`, chỉ bỏ ràng buộc unique).

### Câu 4 — RECORDED ASSERTION PER BLOCK

- **ĐÚNG.** Trace với recording 12 steps + 3 expect:
  - Block Login (1–4) → `recordedAssertions = [adminButton toBeVisible]`
  - Block Add (7–10) → `[Thêm thành công toBeVisible]`
  - Block Search (11–12) → `[KG toBeVisible]`
- Source-range mapping (trailing ≤120 ký tự sau action cuối) gán đúng assertion cho từng block; không bị lẫn A↔C↔D. Parser tách steps/assertions riêng (`sourceStart/sourceEnd`) nên không phụ thuộc step index.
- Lưu ý: nếu 2 expect sát nhau (không có action giữa) và tester cắt range chỉ lấy action đầu → trailing window có thể kéo cả expect thứ 2 vào block. Cần test thêm khi implement (hoặc siết trailing window khi có assertion khác ngay sau).

### Câu 5 — PREREQUISITE COMPLETENESS

- **KHÔNG có khái niệm prerequisite/dependency** trong hệ thống (chỉ có reverse dependency `blockId → testcaseIds[]` phục vụ impact analysis, không phải prerequisite).
- Theo yêu cầu: **KHÔNG code dependency engine.** Thiết kế tối thiểu (mục 5 dưới) chỉ là **gợi ý UI**, tester quyết định.

---

## 3. Trả lời 11 câu

1. **Kiến trúc hiện tại support gì?** 1 recording → nhiều block (backend); block snapshot kèm recordedAssertions; binding sequence theo thứ tự tester; Generate ghép theo sequence; ghi nhận expect không tính là action.
2. **UI hiện tại support gì?** Dán 1 recording → cắt 1 block → lưu → binding; `[+ Thêm thao tác]` (nhưng phải dán lại); reuse block đã lưu; reorder ↑↓; Expected/Assertion.
3. **Chính xác phần nào đang thiếu?** (a) continue-cutting cùng recording (UI reset); (b) repeated block trong 1 testcase (model chặn unique); (c) gợi ý prerequisite nhẹ; (d) nút `[+ Lấy thêm từ bản ghi]` hiện chỉ qua đường paste lại.
4. **Có cần thay data model 6B không?** KHÔNG. Model đúng; chỉ nới ràng buộc unique blockId trong sequence (cho phép lặp).
5. **Có cần thay ActionBlock không?** KHÔNG. Giữ snapshot + recordedAssertions + sourceRange.
6. **Có cần thay binding.sequence không?** Cần **sửa nhỏ**: bỏ guard unique ở `bindBlockToTestCase`; sửa `reorderBinding` xử lý duplicate blockId (không dùng Map/Set làm mất ref trùng).
7. **Có support D → E → D không?** HIỆN CHƯA (trace chứng minh bind lần 2 bị bỏ). Sau khi nới guard + fix reorder → sẽ support.
8. **Assertion mapping nhiều block có đúng không?** ĐÚNG với case đã trace (3 block/3 expect khớp từng cái). Cần thêm test edge (expect sát nhau).
9. **Thiết kế prerequisite tối thiểu là gì?** Không dependency engine. Khi tester mở `[+ Lấy thêm từ bản ghi]`, UI hiển thị **các block cùng recording** (group theo `sourceRecordingId`), kèm gợi ý nhẹ:
   `"Thao tác Tìm kiếm có thể chưa đủ để chạy độc lập. Bản ghi có các thao tác trước: Đăng nhập → Mở Đơn vị tính. Bạn có muốn thêm vào chuỗi chạy không?"` → Tester tự thêm/không.
10. **Wireframe đề xuất** — mục 4.
11. **Files dự kiến sửa (NẾU duyệt):** `src/codegen/AutomationWorkspace.js` (bỏ guard unique + fix reorder) · `src/codegen/GenerateService.js` (kiểm tra duplicate không phá) · `web-ui/src/components/automationV3/V3ActionSetupPanel.jsx` (giữ recordingId + continue-cutting + `[+ Lấy thêm từ bản ghi]`) · `web-ui/src/utils/automationV3.js` (helper group block theo recording) · `tests/automation-v3-workflow-test.js` hoặc test mới (repeat D→E→D, continue-cutting, assertion per block) · `docs/V3_HANDOFF.md`.

---

## 4. WIREFRAME (CHƯA CODE)

### 4.1 Bản ghi Playwright → nhiều thao tác (continue cutting)

```
┌──────────────────────────────────────────────────────────────────┐
│ TC001 — Sửa đơn vị tính thành công                       [ ✕ ]   │
│ ──────────────────────────────────────────────────────────────── │
│ BẢN GHI PLAYWRIGHT (30 bước)                                     │
│  1. Mở trang đăng nhập                                           │
│  ...                                                             │
│ 16. Nhập từ khóa                                                 │
│ 17. Bấm Tìm kiếm                                                 │
│ 18. Kết quả hiển thị                                             │
│  ...                                                             │
│ 30. ...                                                          │
│                                                                  │
│ Đoạn đã lưu (từ bản ghi này):                                    │
│   ✓ Đăng nhập                  bước 1 → 4                        │
│   ✓ Mở Đơn vị tính             bước 5 → 6                        │
│   ✓ Thêm đơn vị tính           bước 7 → 15                       │
│   ✓ Tìm kiếm                   bước 16 → 19                      │
│                                                                  │
│ [ + Chọn đoạn tiếp theo ]   ← KHÔNG đóng bản ghi — tiếp tục cắt   │
│                                                                  │
│ (khi bấm):                                                       │
│   Bắt đầu: [ 20 — chọn record ▼ ]                                │
│   Kết thúc: [ 25 — kết quả sau sửa ▼ ]                           │
│   Tên thao tác: [ Sửa đơn vị tính                     ]          │
│   Verification tìm thấy:  ✓ row ... toBeVisible()                │
│                                              [ Lưu đoạn ]        │
└──────────────────────────────────────────────────────────────────┘
```

- Sau `[Lưu đoạn]`: **bản ghi vẫn ở lại**, quay về `[+ Chọn đoạn tiếp theo]` — không paste lại.

### 4.2 Testcase Composition (D → E → D)

```
┌──────────────────────────────────────────────────────────────────┐
│ TC001 — Sửa đơn vị tính thành công                       [ ✕ ]   │
│ ──────────────────────────────────────────────────────────────── │
│ Chuỗi thao tác sẽ chạy:                                          │
│  1. Đăng nhập                          ↑ ↓ [Xóa]                 │
│  2. Mở Đơn vị tính                     ↑ ↓ [Xóa]                 │
│  3. Tìm kiếm                           ↑ ↓ [Xóa]                 │
│  4. Sửa đơn vị tính                    ↑ ↓ [Xóa]                 │
│  5. Tìm kiếm                           ↑ ↓ [Xóa]   ← cùng thao tác lặp lại │
│                                                                  │
│ [ + Dùng thao tác đã lưu ]   [ + Lấy thêm từ bản ghi ]           │
│                                                                  │
│ ⓘ "Tìm kiếm" có thể chưa đủ để chạy độc lập. Bản ghi có thao tác │
│   trước: Đăng nhập → Mở Đơn vị tính. Bạn có muốn thêm vào chuỗi?  │
│   [ Thêm ] [ Bỏ qua ]                                            │
│                                                                  │
│ Điều kiện xác nhận cuối: ...                                     │
│ ──────────────────────────────────────────────────────────────── │
│ [ Đóng ]                                    [ Sinh automation ]  │
└──────────────────────────────────────────────────────────────────┘
```

- Không hiển thị: ActionBlock / Binding / Segment / PRIVATE / REUSABLE.

---

## 5. AI — CHỈ DESIGN (chưa implement)

- Với recording dài, có thể thêm `[ Phân tích bản ghi ]`:
```
AI gợi ý (chỉ GỢI Ý):
  1→4    Có vẻ là "Đăng nhập"
  5→6    Có vẻ là "Mở Đơn vị tính"
  7→15   Có vẻ là "Thêm đơn vị tính"
  16→19  Có vẻ là "Tìm kiếm"
Tester: [Xác nhận] [Chỉnh phạm vi] [Bỏ qua]
```
- AI KHÔNG được: tự gắn block vào testcase, tự quyết định prerequisite, tự map TC001/TC002, tự quyết định assertion PASS. Tester-owned.

---

## 6. Kết luận

- Kiến trúc 6B **không cần thay** — chỉ cần **nới unique blockId** trong binding (cho D→E→D) + **UI giữ recording để continue-cutting** + **gợi ý prerequisite nhẹ**.
- Assertion per block **đã đúng** (source-range mapping).
- CHƯA CODE — chờ người dùng duyệt.
