# DESIGN — P0: CODEGEN → ACTION LIBRARY OWNERSHIP CORRECTION

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **THIẾT KẾ + WIREFRAME + IMPACT ANALYSIS — CHỜ NGƯỜI DÙNG DUYỆT. CHƯA CODE.**
> Vấn đề: Action Library đã có (shared asset), nhưng **UX ownership sai** — `V3ActionSetupPanel` vẫn làm cả recording preparation lẫn testcase composition trong cùng một panel (screen `source/paste/library/list`).

---

## 1. KIẾN TRÚC BẮT BUỘC (ownership)

```
CODEGEN / RECORDING TOOL
  Record/Paste → Parse → [Phân tích bản ghi] → chia đoạn → Tester review/chỉnh/tên
  → xác nhận → [Lưu Action Library]
        │
        ▼
ACTION LIBRARY (shared reusable actions)
        │
        ▼
AUTOMATION WORKSPACE
  Testcase → [Chọn action từ Library] → Compose/reorder/repeat
  → Expected Result → Assertion → Generate → Run
```

- **Codegen = owner của Recording Preparation** (quay/dán/parse/phân tích/cắt/review/lưu Library).
- **Automation Workspace = owner của Testcase Composition** (chọn từ Library, sắp xếp, lặp).
- **AI chỉ ở Codegen** ([Phân tích bản ghi] → đề xuất phân đoạn) — không tự map testcase.

---

## 2. THAY ĐỔI UX

### 2.1 Codegen (mới — tách khỏi Workspace)
- Record/paste Playwright → parse → `[Phân tích bản ghi]` (AI đề xuất Login/Mở ĐVT/Thêm/Tìm/Sửa...) hoặc **manual cut** (giữ cut-many).
- Tester review từng proposal: `[Xác nhận] [Chỉnh phạm vi] [Đổi tên] [Bỏ qua]`.
- Chỉ khi tester xác nhận → **candidate action**; tester **chủ động** `[Lưu vào thư viện thao tác]`.
- **AI output = proposal có thể review, KHÔNG phải text mô tả.** Sau confirm → framework **snapshot từ RecordingSession/parser thật** (KHÔNG tin step/locator AI sinh).

### 2.2 Automation Workspace (tab Thao tác)
- **Primary action:** `[+ Thêm thao tác từ thư viện]` → chọn nhiều action → compose/reorder/repeat:
```
TC Sửa đơn vị tính
1. Đăng nhập
2. Mở danh mục Đơn vị tính
3. Tìm kiếm đơn vị tính
4. Sửa đơn vị tính
5. Tìm kiếm đơn vị tính     ← repeated D→E→D (giữ)
```
- **Secondary fallback:** "Không có thao tác phù hợp? `[Tạo thao tác mới từ bản ghi]`" — KHÔNG ngang hàng với Library trong primary flow.
- Expected Result → Assertion → Generate (giữ).

---

## 3. KHÔNG PHÁ FOUNDATION

Giữ nguyên (không rewrite backend):
- Recording parser (steps/assertions/source positions) ✅
- ActionBlock snapshot + recordedAssertions ✅
- Action Library shared asset (`data/action-library.json`, `POST/GET /library`, bind) ✅
- Repeated block (D→E→D), reorder (multiset), unbind theo order ✅
- Generate compatibility (`resolveBlock` workspace → Library) ✅
- Manual cut-many ✅

**Chỉ thay ownership + UX flow** (component + nơi hiển thị), không đổi data model/API core.

---

## 4. STATE TRANSITION (recording → proposal → confirmed action → library)

```
Recording (RecordingSession)
  → parse → steps[] + assertions[] (source positions)
  → [Phân tích bản ghi] (AI)  HOẶC  manual cut
  → PROPOSAL { suggestedName, startStep, endStep, evidence[], recordedAssertions[], confidence, needsTesterConfirmation }
  → Tester: [Xác nhận] / [Chỉnh phạm vi] / [Đổi tên] / [Bỏ qua]
  → CONFIRMED ACTION (framework snapshot từ recording thật:
       steps = sliceSteps(recording, range tester chốt)
       recordedAssertions = recordedAssertionsInRange(recording, range)
       label = tên tester chốt)
  → Tester chủ động [Lưu vào thư viện thao tác]  → ActionLibrary.addBlock (label bắt buộc)
  → Workspace: [Dùng thao tác đã có] → bindLibraryBlock → binding.sequence
```

---

## 5. COMPONENT HIỆN TẠI — GIỮ / CHUYỂN / BỎ

| Component (hiện tại) | Quyết định | Lý do |
|---|---|---|
| `V3ActionSetupPanel` (screen source/paste/cut-many) | **CHUYỂN** phần recording preparation sang Codegen (component mới `V3CodegenTool`) | Ownership: recording prep thuộc Codegen |
| `V3ActionSetupPanel` (screen library) | **GIỮ** (chuyển thành primary `[+ Thêm thao tác từ thư viện]`) | Tái sử dụng màn list + `[Dùng]` đã có |
| `V3ActionSetupPanel` (screen list — "Thao tác sẽ chạy") | **GIỮ** (composition + ↑↓ + repeat + Xóa) | Thuộc Automation — đúng |
| `V3ExpectedResultTab` | GIỮ | Không đổi |
| `V3ReviewDrawer` | GIỮ (tab Thao tác) | Chỉ đổi primary action |
| `CodeGenPage` (cũ, luồng automation-workspace) | GIỮ (không đụng — không thuộc V3) | Tránh trộn |
| Panel recording global / banner | KHÔNG dùng (đã bỏ) | — |

---

## 6. API — REUSE / THÊM

**Reuse (không đổi):**
- `POST /recordings/start|stop` (paste → RecordingSession)
- `GET /recordings/:id` (steps/assertions detail)
- `POST /blocks` + `POST /blocks/:id/confirm` (tạo confirmed action từ recording)
- `GET /library` · `POST /library` (lưu) · `POST /testcases/:id/library/blocks` (dùng)
- `GET /testcases/:id/binding` · `POST /binding/blocks` · `POST /binding/reorder` · `DELETE /binding/blocks/:id?order=`
- Assertions/Generate (giữ)

**Thêm (khi duyệt implement):**
- `POST /recordings/:id/analyze` → trả `{ proposals[] }` (AI — contract đã có trong `V3_RECORDING_COMPOSITION_AI_CONTRACT.md`); chưa code AI, có thể trả deterministic placeholder trước.
- (Không cần API mới cho ownership — chỉ UI di chuyển.)

---

## 7. KHÔNG PHÁ DỮ LIỆU ACTION LIBRARY HIỆN CÓ

- Library lưu `data/action-library.json` — **không đổi schema**, không migrate.
- Block `LIB-*` đã bind trong workspace giữ nguyên (resolveBlock fallback).
- Chỉ UI đổi nơi hiển thị; dữ liệu hiện có (nếu tester đã lưu) vẫn dùng được.

---

## 8. WIREFRAME — xem `v3-codegen-ownership-wireframe.md`

- **Màn Codegen (mới):** bản ghi + `[Phân tích bản ghi]` + proposal review + `[Lưu vào thư viện]`.
- **Màn Action Library:** list + `[Dùng]` (tái sử dụng).
- **Màn Automation tab Thao tác:** primary `[+ Thêm thao tác từ thư viện]` + secondary `[Tạo thao tác mới từ bản ghi]` + composition/repeat.

## 9. AI — "PHÂN TÍCH XONG LÀM GÌ" (giữ câu hỏi)

- Output = **proposal có thể review** (Đề xuất 1 · Bước 1→4 · Tên: Đăng nhập · Evidence · `[Xác nhận][Chỉnh phạm vi][Đổi tên][Bỏ qua]`).
- Confirm proposal → framework **snapshot từ recording thật** → tester **chủ động** lưu Library.
- Không tin step/locator AI sinh; không tự persist; không tự map testcase.
