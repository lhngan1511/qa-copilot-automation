# V3 — ACTION LIBRARY GROUPING: DESIGN ĐỀ XUẤT (chưa implement — chờ tester duyệt)

> Ngày: 2026-08-12 · Branch: `arena/automation-record-by-testcase` · Baseline: `2bc963d`
> Trạng thái: **DESIGN ONLY** — theo quy trình checkpoint, trace cho thấy schema hiện tại
> KHÔNG có metadata group đáng tin cậy → DỪNG sau design, chờ duyệt trước khi migration.

---

## 1. TRACE — Schema hiện tại

### Action Library block (`src/codegen/ActionLibrary.js` → `addBlock`)

```
blockId: LIB-<timestamp>-<rand>       label: string (bắt buộc)
kind: ACTION | SETUP                  steps: [] (SNAPSHOT)
recordedAssertions: [] (SNAPSHOT)     sourceRecordingId: string|null
sourceRange: { startStep, endStep }   status: CONFIRMED
version: 1                            hash: sha256(steps+assertions+range+label+kind)
createdAt / updatedAt
```

**KHÔNG có**: `module`, `feature`, `group`, `context`, `category` — không có metadata
nghiệp vụ nào để xác định "Đơn vị tính / Kho / Thiết bị / ...".

### Recording (`CodeGenRecordingStore.create`)

```
recordingId, mode, url, browser, context: object|null, status, scriptContent,
steps[], assertions[], recordedValues{}, testCaseId, segments[], ...
```

- `context` chỉ được set khi **start từ AI Test Design** (module/feature/artifactId từ URL params).
- **Paste path** (`createRecording({ url: "about:blank", ... })`) → `context = null`.
- Block Library **không copy context** từ recording (chỉ giữ `sourceRecordingId`).

### Kết luận

| Câu hỏi | Trả lời |
|---|---|
| Có `module/feature/group/context` trong block không? | **KHÔNG** |
| Có metadata đủ tin cậy để group "Đơn vị tính/Kho/Thiết bị"? | **KHÔNG** — context chỉ có ở 1 phần recording (AI Test Design path), paste path null, block không copy |
| Group được persist ở thời điểm nào? | **Chưa có khái niệm group** |
| Existing Library migrate được không? | Không an toàn nếu chỉ dựa vào label (cấm `label.includes(...)`) |

→ **KHÔNG implement grouping ở checkpoint này** (đúng yêu cầu: DỪNG sau design).

---

## 2. ĐỀ XUẤT SCHEMA (chờ duyệt)

### Nguyên tắc

- Group do **tester chủ động** gán — KHÔNG AI tự quyết định.
- Nguồn gợi ý (không tự áp): `context.module/feature` của recording khi có;
  nếu null → tester chọn từ danh sách có sẵn (Chức năng đã tạo) hoặc tạo mới.
- Backward-compatible: block cũ (không group) hiển thị trong group `(Chưa phân loại)`.

### Thêm field vào `ActionLibrary.addBlock` (optional, default null)

```js
{
  ...block,
  group: {                    // OPTIONAL — null nếu chưa phân loại
    module: string|null,      // VD "Đơn vị tính"
    feature: string|null      // VD "Thêm mới" (optional — nếu chỉ cần 1 cấp thì bỏ)
  }
}
```

- `updateBlock` cho phép PATCH `group` (tester sửa) — KHÔNG reset CONFIRMED (chỉ metadata).
- `listLibrary` DTO thêm `group`; UI grouping derive từ `group.module` (fallback `(Chưa phân loại)`).
- **Không thêm field nữa** nếu chỉ cần 1 cấp Chức năng → Action.

### Nguồn dữ liệu cho gợi ý (chỉ gợi ý)

- Khi tester bấm "Lưu ... vào Thư viện": working action được tạo từ recording đang mở —
  nếu recording có `context.module/feature` → điền sẵn vào group (tester có thể sửa).
- Recording hiện tại: `CodeGenPage` `incomingContext` (module/feature từ URL) → truyền xuống
  `createRecording`/`setScript` → sau đó `saveAllToLibrary` đọc `context` để prefill group.

### Migration (nếu duyệt)

- Không migrate dữ liệu cũ tự động. Block không có `group` → `(Chưa phân loại)`.
- Tester có thể gán group qua UI (sửa item Library) — checkpoint riêng nếu duyệt.

---

## 3. P0-4 — DUPLICATE ACTION ANALYSIS (đã trace — KHÔNG tự dedupe)

### Cơ chế phát sinh "trùng tên" hiện tại

- Cùng working set: `appendWorkingAction` chặn cùng range → không duplicate trong 1 lần cắt.
- **Nhiều lần paste/record** cùng nghiệp vụ → nhiều recording → tạo action cùng label
  → nhiều LIB-* cùng tên (hợp lệ — source khác nhau).
- Trước fix `00bad7b`: mỗi lần bấm Lưu có thể tạo LIB mới cho action `WORK-*` → trùng lặp lịch sử.

### Detector đáng tin cậy: `ActionLibrary.hash` (đã có sẵn)

`hash = sha256(steps + recordedAssertions + sourceRange + label + kind)` — **đã chứng minh bằng runtime trace**:

| Kịch bản | Kết quả |
|---|---|
| Cùng label + cùng steps (recording khác nhau) | **SAME hash** → duplicate SEMANTIC thật |
| Cùng label + steps khác | Khác hash → chỉ trùng tên, KHÔNG phải duplicate |
| Cùng steps + assertion khác | Khác hash → semantic khác (giữ cả 2) |

### Chiến lược đề xuất (chưa implement — chờ duyệt)

1. Màn Library: hiển thị badge nhỏ khi `hash` trùng block khác:
   `⚠ Trùng nội dung với <label cũ>` (không tự xóa).
2. `[Xóa]` vẫn do tester quyết định; không auto-dedupe.
3. Nếu duyệt grouping: group + hash giúp tester thấy trùng trong cùng Chức năng.

---

## 4. QUYẾT ĐỊNH CHECKPOINT NÀY

- **P0-3 grouping: KHÔNG implement** (schema thiếu metadata — chờ duyệt đề xuất mục 2).
- **P0-4 duplicate: KHÔNG tự dedupe** — báo cáo + đề xuất chiến lược (mục 3).
- **P1 layout: ĐÃ implement** (CSS tối thiểu — `.codegen-page` full content width; grid 60/40 có sẵn).
