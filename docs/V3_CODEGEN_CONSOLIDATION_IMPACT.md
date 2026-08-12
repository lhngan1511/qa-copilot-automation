# IMPACT — CODEGEN CONSOLIDATION (A–E duyệt; F correction theo trace) — CHƯA CODE

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Duyệt: wireframe A–E. Phương án F chỉnh theo trace: **CodeGen lưu confirmed action TRỰC TIẾP vào ActionLibrary** (không qua workspace, không block workspaceId=null, không hidden workspace, không orphan block).

---

## 1. Kiến trúc mục tiêu (đã xác nhận khả thi)

```
Record (Inspector)  OR  Paste
        │
        ▼
GLOBAL Recording (RecordingStore — workspaceId=null, KHÔNG thuộc workspace)
        │
        ▼
Parse → steps + locators + verification/expect
        │
        ▼
Candidate Segment (UI state — chưa persist)
        │
        ▼
Tester Confirm
        │
        ▼
ActionLibrary.create()  ← lưu TRỰC TIẾP shared Library (data/action-library.json)
        │
        ▼
Automation Workspace consume LIB-* qua binding (không paste lại)
```

## 2. TRẢ LỜI 5 CÂU IMPACT (trace code thật)

### 2.1 RecordingStore cần thay gì để recording global?
**KHÔNG cần thay.** `CodeGenRecordingStore.create({ ..., workspaceId = null })` đã mặc định null; `CodeGenSessionManager.start` gọi `store.create(...)` **không truyền workspaceId** → recording global đã hoạt động qua `/api/codegen`.

### 2.2 API start/stop/detail cần thay gì?
- **CodeGen dùng `/api/codegen`** (start/stop/get/recordings) — **không workspace** ✓ (routes đã có: `POST /start`, `POST /stop`, `GET /recordings/:recordingId`).
- `GET /recordings/:recordingId` → `manager.get` → `CodeGenRecordingStore.sanitize` giữ `steps`/`assertions` → đủ cho preview/cut.
- **Cần xác minh/bổ sung:** `manager.stop` phải parse steps+assertions vào recording (giống `CurrentRecordingSession.stop`). Nếu chưa parse → bổ sung parse trong codegen stop (tái dùng `recordingParser`).

### 2.3 Có thể bỏ hoàn toàn `createBlock` khỏi CodeGen path không?
**CÓ.** CodeGen path sẽ KHÔNG gọi `createBlock` (vốn tạo block trong workspace + `ensureWorkspace`). Thay bằng **API mới không-workspace** gọi `ActionLibrary.addBlock` trực tiếp. `createBlock` (workspace) **giữ nguyên** cho luồng Automation compatibility.

### 2.4 `ActionLibrary.addBlock` đã đủ dữ liệu chưa?
**ĐÃ ĐỦ:** nhận `label` (bắt buộc), `kind`, `steps` (snapshot), `recordedAssertions` (snapshot), `sourceRecordingId`, `sourceRange` → status CONFIRMED + hash. CodeGen cần:
- `steps` = slice theo range tester chốt (từ recording global);
- `recordedAssertions` = recordedAssertionsInRange (source-range mapping — tái dùng service logic);
- `sourceRecordingId` = recording global id.
→ **Thêm 1 API:** `POST /api/codegen/library` (hoặc `/api/action-library`) — body `{ recordingId, startStep, endStep, label, kind? }` → service: slice steps + recordedAssertionsInRange từ recording global → `actionLibrary.addBlock(...)` → trả `LIB-*`.

### 2.5 Automation fallback reuse cùng global flow được không?
**ĐƯỢC.** `V3RecordingPreparationPanel` đổi: dùng **recording global** (không workspace) + **ActionLibrary.create** (API mới) thay cho `startRecording/createBlock` (workspace); riêng **Automation fallback** sau confirm gọi thêm `bindLibraryBlock(testcase, LIB-*)` (cần workspace của testcase — có sẵn). Codegen (owner) không bind. → **Cùng một component, cùng global flow; không duplicate.**

## 3. "ĐỐI CHIẾU TESTCASE" — TRACE + ĐỀ XUẤT

- **Endpoint:** `POST /api/codegen/recordings/:recordingId/link` → `controller.linkTestcases` → gắn `testcaseIds[]` vào recording (metadata).
- **Component:** `CodeGenPage` modal "Đối chiếu testcase" (`linkOpen`, `selectedTestcaseIds`, `actions.link`).
- **Vai trò trong V3:** KHÔNG có — V3 mapping testcase ↔ thao tác qua **binding (LIB-* → sequence)**, không qua `recording.testcaseIds`. Field `testcaseIds` chỉ legacy CodeGen→testcase.
- **Đề xuất:** **REMOVE khỏi CodeGen V3** (bỏ nút + modal khỏi main flow). Backend `linkTestcases` giữ nguyên (legacy compatibility, không phá dữ liệu cũ) nhưng không nằm trong UI V3.

## 4. THAY ĐỔI CẦN THIẾT (khi được duyệt code)

| Hạng mục | Thay đổi |
|---|---|
| `CodeGenSessionManager.stop` | xác minh/parse steps+assertions (nếu chưa) |
| Service | thêm `createLibraryActionFromRecording({ recordingId, startStep, endStep, label, kind })` (slice + recordedAssertionsInRange + `actionLibrary.addBlock`) |
| Route | thêm `POST /api/codegen/library` (không workspace) |
| `V3RecordingPreparationPanel` | đổi sang recording global + API mới; prop `onConfirmedSegment(blockId)` (fallback bind); không dùng createBlock |
| `CodeGenPage` | consolidate main flow (wireframe A–E): 1 input Playwright; bỏ textarea 2; Advanced Tools (Chạy thử/Lưu file); **bỏ "Đối chiếu testcase"**; dùng shared panel |
| `V3ActionSetupPanel` fallback | giữ reuse shared panel (workspace chỉ cho bind) |
| Tests | codegen global recording → cut → library; fallback bind LIB-*; regression |

## 5. XÁC NHẬN KHÔNG LÀM

- KHÔNG tạo ActionBlock `workspaceId=null` (chỉ Library `LIB-*`).
- KHÔNG hidden/fake workspace; KHÔNG orphan block (mọi block CodeGen → thẳng Library).
- KHÔNG migration workspace block cũ (giữ compatibility).
- KHÔNG AI/analyze; KHÔNG Runner; KHÔNG 6D.
- Chưa code — chờ duyệt impact này.
