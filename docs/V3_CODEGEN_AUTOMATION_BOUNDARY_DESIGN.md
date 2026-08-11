# DESIGN — BOUNDARY: CODEGEN ↔ ACTION LIBRARY ↔ AUTOMATION WORKSPACE

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **THIẾT KẾ — CHỜ NGƯỜI DÙNG DUYỆT. CHƯA CODE (kể cả AI).**
> Chốt kiến trúc chuẩn (người dùng): Codegen và Automation **độc lập**, chỉ **chia sẻ tài sản** qua Action Library / Recording Library. Foundation `RECORD ONCE → CUT MANY` (đã implement `e128d7e`) trở thành nền móng của Recording/Action Library.

---

## 1. KIẾN TRÚC CHUẨN (đóng băng)

```
CODEGEN — Công cụ hỗ trợ độc lập
│
├─ Ghi thao tác Playwright (Recorder)
├─ Dán / xem recording
├─ Parse locator, action, expect
├─ [Phân tích bản ghi] ← AI hỗ trợ ở đây (sau này)
│     ├─ Login · Mở chức năng ĐVT · Thêm · Tìm kiếm · Sửa · ...
└─ Tester xác nhận → Lưu thao tác có thể dùng lại
                         │
                         ▼
                  ACTION LIBRARY        ← tài sản DÙNG CHUNG
                         │
                         ▼
AUTOMATION WORKSPACE — Làm việc theo TESTCASE
│
├─ Chọn testcase
├─ [Dùng thao tác đã có]  ← lấy từ Action Library
├─ hoặc [Tạo từ bản ghi Playwright] ← khi tester thực sự cần
├─ Sắp xếp/composition  (Login → Mở ĐVT → Tìm → Sửa → Tìm)
├─ Xác nhận Expected Result / Assertion
├─ Sinh automation
└─ Chạy thử
```

**Nguyên tắc bất biến:**
1. Codegen **không phụ thuộc** Automation; Automation **không phụ thuộc bắt buộc** Codegen.
2. Chia sẻ qua **Action Library / Recording Library** — một nguồn tài sản, nhiều nơi dùng.
3. **Recording ≠ Testcase**; Recording chỉ là source evidence.
4. **AI chỉ ở Codegen** ([Phân tích bản ghi]) — đề xuất → tester xác nhận → lưu vào Library. AI không ở Automation, không tự map/persist.
5. Automation: tester **compose** từ Library + Expected/Assertion riêng của testcase.

---

## 2. BOUNDARY THỰC TẾ HIỆN TẠI (trace code)

| Khái niệm | Đang ở đâu (code) | Ghi chú |
|---|---|---|
| Codegen công cụ | `CodeGenPage.jsx` + `/api/codegen` (`codeGenRoutes` + `CodeGenSessionManager`) | Có sẵn — chủ yếu phục vụ luồng cũ (automation-workspace) |
| Recording (V3) | `recordingParser` + `CodeGenRecordingStore` (`data/codegen-recordings.json`) | **Dùng chung** (V3 mount cùng store) ✅ |
| ActionBlock | `workspace.actionBlocks[]` (trong `AutomationWorkspace`) | ⚠ **Hiện nằm TRONG workspace** — chưa phải Library độc lập |
| Binding/sequence | `entry.binding.sequence` (trong workspace) | Thuộc Automation — đúng |
| Automation UI | `AutomationV3Page` + `/api/automation-v3` | Đúng |

**Phát hiện chính:** `actionBlocks[]` hiện **gắn trong từng workspace** (`AutomationWorkspace`), chưa có **Action Library dùng chung** giữa Codegen ↔ Automation. Để đạt kiến trúc chuẩn, cần **tách ActionBlock thành tài sản chung** (Library) — workspace chỉ tham chiếu `blockId`.

---

## 3. THAY ĐỔI THIẾT KẾ (boundary) — ĐỀ XUẤT

### 3.1 Action Library (tài sản chung — mới)
- **Lưu:** `data/action-library.json` (hoặc mở rộng store dùng chung) — `{ blockId, label, kind, steps snapshot, recordedAssertions snapshot, sourceRecordingId, sourceRange, scope, status, version, hash, createdAt/updatedAt, usedByTestCases[] }`.
- **Chủ sở hữu:** Library (không thuộc workspace). Workspace binding chỉ giữ `{ blockId, order }`.
- **Ai tạo:** Codegen (dán/record → cắt/`[Phân tích bản ghi]` → xác nhận → lưu Library) **hoặc** Automation khi tester thực sự cần ("Tạo từ bản ghi Playwright") — cả 2 đều tạo cùng model.
- **Snapshot:** giữ nguyên (steps + recordedAssertions copy; xóa recording không ảnh hưởng).
- **Compatibility:** block cũ trong workspace (6B) → khi đọc, migrate thành Library block (adapter đọc qua) — không xóa dữ liệu cũ.

### 3.2 Recording Library (source evidence — đã có)
- `CodeGenRecordingStore` giữ recording (dùng chung) ✅ — chỉ cần UI Codegen hiển thị/lựa chọn rõ hơn.

### 3.3 Automation Workspace
- Giữ: binding sequence (repeated D→E→D ✅), Expected/Assertion, Generate gate, reuse qua Library.
- Bỏ UX chính "dán recording dài vào từng testcase để cắt" → thay bằng `[Dùng thao tác đã có]` (Library) / `[Tạo từ bản ghi Playwright]` (khi cần).

---

## 4. CASE ĐƠN VỊ TÍNH — KIỂM CHỨNG (reference)

```
Record 1 luồng dài (Codegen): Login → vào Danh mục → Đơn vị tính → Thêm → Tìm → Sửa → Tìm → Xóa
Codegen [Phân tích bản ghi] → 6 thao tác → tester xác nhận → LƯU ACTION LIBRARY:
  Login · Mở Đơn vị tính · Thêm ĐVT · Tìm kiếm · Sửa ĐVT · Xóa ĐVT

Automation compose (KHÔNG paste lại):
  TC Thêm:     [Login, Mở ĐVT, Thêm ĐVT]                     + expected/assertion riêng
  TC Tìm kiếm: [Login, Mở ĐVT, Tìm kiếm]                     + expected/assertion riêng
  TC Sửa:      [Login, Mở ĐVT, Tìm kiếm, Sửa ĐVT, Tìm kiếm]  + expected/assertion riêng   ← repeated Tìm kiếm ✅
```
→ 3 testcase chạy đúng chuỗi cần thiết, không record/paste lại → kiến trúc đứng vững.

---

## 5. ĐỐI CHIẾU CÁI GÌ ĐÃ / CHƯA

| Yêu cầu | Trạng thái |
|---|---|
| Codegen độc lập (record/dán/parse/analyze) | ⚠ Có UI/route, cần tách UX khỏi Automation |
| Action Library dùng chung | ❌ **Chưa có** — actionBlocks trong workspace |
| Recording Library (shared store) | ✅ có store chung |
| Automation compose từ Library | ⚠ có reuse trong workspace; cần nguồn Library chung |
| RECORD ONCE → CUT MANY (nền tảng) | ✅ implement `e128d7e` — giữ làm nền Library |
| Repeated D→E→D | ✅ implement |
| AI [Phân tích bản ghi] | 📐 design contract — chưa code |

---

## 6. WIREFRAME (CHƯA CODE) — xem file `v3-codegen-automation-boundary-wireframe.md`

- **Màn Codegen (công cụ):** Recording Panel + `[Phân tích bản ghi]` (AI sau) + "Đoạn đã cắt" → `[Lưu vào Thư viện thao tác]`.
- **Màn Automation:** card testcase → `[Dùng thao tác đã có]` (mở Action Library) / `[Tạo từ bản ghi Playwright]` → "Chuỗi thao tác sẽ chạy" (↑↓, lặp được) → Expected/Assertion → Generate.

---

## 7. FILES DỰ KIẾN (NẾU DUYỆT implement)

- **Mới:** `src/codegen/ActionLibrary.js` (hoặc extend store) · `src/routes/actionLibraryRoutes.js` (GET/POST/PATCH/DELETE /api/action-library) · `web-ui/src/pages/CodegenPage` (tách UI) · `web-ui/src/components/automationV3/V3ActionLibraryPanel.jsx`.
- **Sửa:** `AutomationWorkspace` (workspace.actionBlocks → tham chiếu Library + migrate adapter) · `AutomationWorkspaceApplicationService` (createBlock ghi Library; binding trỏ Library) · `V3ActionSetupPanel` (nguồn từ Library) · tests + docs.

## 8. CHƯA LÀM (checkpoint này)
- KHÔNG code (kể cả AI). KHÔNG 6D. KHÔNG Runner. KHÔNG migration lớn khi chưa duyệt.
