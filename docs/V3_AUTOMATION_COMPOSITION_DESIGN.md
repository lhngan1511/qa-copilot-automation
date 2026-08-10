# DESIGN — V3 AUTOMATION COMPOSITION (Recording → Action Block → TestCase Binding)

> Branch: `arena/automation-record-by-testcase`
> Trạng thái: **ARCHITECTURE CORRECTION — THIẾT KẾ, CHƯA CODE.** Chờ người dùng duyệt (cùng wireframe `docs/v3-automation-composition-wireframe.md`) trước khi implementation.
> Ngày: 2026-08-10 · Thay thế dần `DESIGN_RECORD_MAPPING.md` (mô hình Segment) — xem mục 9 (Migration).
> Mốc hiện tại: 5C đã implementation tại `cccbcc8`; **TẠM DỪNG Step 6**; không Runner; không AI mapping; không vá lẻ UI 5C.

---

## 1. Bài toán thực tế (đã được làm rõ)

1. Recording có thể là một session liên tục **rất dài**.
2. Một recording có thể chứa **nhiều testcase**.
3. Một testcase có thể chỉ sử dụng **một phần** recording.
4. Một testcase có thể cần **nhiều đoạn** recording.
5. Nhiều testcase có thể có **cùng thao tác** nhưng khác **Test Data + Expected Result + Assertion**.
   - Ví dụ: THÊM có 4 testcase, SỬA có 4 testcase, XÓA có 2 testcase.
   - **Không được mặc định mỗi testcase phải record lại toàn bộ thao tác.**
6. Nghiệp vụ thực tế có **FLOW LỒNG NHAU**:

```
Nhập kho thiết bị
→ đăng nhập
→ vào chức năng Nhập kho
→ nhập thông tin
→ trong trường Đơn vị tính: mở chức năng Thêm đơn vị tính
→ quay lại Nhập kho
→ tại Khách hàng: mở chức năng Thêm khách hàng
→ quay lại Nhập kho
→ hoàn tất nhập kho
→ sau đó có thể tiếp tục Cấp phát thiết bị
```

- "Thêm đơn vị tính" vừa là **chức năng/testcase độc lập**, vừa là **flow con được gọi trong testcase Nhập kho**.

**Kết luận:** mô hình cũ `Recording → Segment → TestCase` **KHÔNG ĐỦ** cho V3 dài hạn:
- Segment bị gắn cứng 1-1 với testcase (`seg.testCaseId`), không thể dùng lại cho testcase khác;
- Không có khái niệm "block dùng chung / block lồng";
- Test Data, Expected Result, Assertion bị trói vào testcase nhưng thao tác thì thuộc recording → không tách được "thao tác chung" khỏi "ý nghĩa testcase".

---

## 2. Mô hình mới — 3 tầng abstraction

```
Recording Session          ← 1 take liên tục (nguồn bằng chứng thô: steps, source, hash)
        ↓
Action Block               ← khoảng thao tác CÓ Ý NGHĨA, đặt tên, CÓ THỂ DÙNG LẠI
        ↓
TestCase Automation Binding ← testcase compose các block theo thứ tự + Test Data + Expected Result + Assertion
```

### 2.1 Định nghĩa (tránh hiểu nhầm)

- **Action Block ≠ TestCase.**
- **Action Block** = bằng chứng/thao tác lấy từ recording (một khoảng steps liên tục, có tên nghiệp vụ do tester đặt, có thể được nhiều testcase dùng lại). Block thuộc về **Recording** (tài sản dùng chung của workspace).
- **TestCase** = đơn vị sở hữu:
  - automation decision;
  - danh sách block sử dụng + **thứ tự** (tester sắp xếp);
  - test data binding;
  - expected result;
  - confirmed assertions.
- **Reuse PHẢI DO TESTER QUYẾT ĐỊNH** — không AI mapping, không tự map theo tên, không map theo thứ tự JSON, không tự suy testcase từ recording.

### 2.2 Một Action Block được nhiều testcase dùng

Ví dụ: Action Block **"Thêm đơn vị tính"** (từ 1 recording) có thể được dùng bởi:
- testcase độc lập của chức năng Đơn vị tính;
- testcase Nhập kho (mở popup Thêm ĐVT trong form);
- testcase khác có popup/form Thêm ĐVT.

Mỗi testcase vẫn giữ Test Data / Expected Result / Assertion **riêng** của nó.

---

## 3. Data model đề xuất

### 3.1 RecordingSession (GIỮ từ 5C-0, bỏ ràng buộc testCaseId)

```json
{
  "recordingId": "REC-...",
  "workspaceId": "WS-...",
  "type": "TESTCASE",                 // giữ field cho tương thích; KHÔNG còn là nơi gắn testcase
  "testCaseId": null,                 // deprecated: luôn null trong luồng mới (liên kết qua Binding)
  "status": "RECORDED | APPROVED | REJECTED",
  "source": "...", "recordingHash": "...", "recordingVersion": 1,
  "steps": [ { order, actionType, locator, target, valueKind, recordedValue, sensitive, sourceStart, sourceEnd, sourceLine } ],
  "assertions": [],
  "blocks": [ /* ActionBlock[] — xem 3.2 */ ],
  "createdAt": "...", "updatedAt": "..."
}
```

### 3.2 ActionBlock (thay Segment — REFACTOR)

```json
{
  "blockId": "BLK-...",
  "recordingId": "REC-...",
  "label": "Thêm đơn vị tính",        // tên nghiệp vụ do TESTER đặt (mặc định: "Bước a → b")
  "kind": "SETUP | ACTION",           // SETUP = chuẩn bị (login/navigation); ACTION = thao tác nghiệp vụ
  "startStep": 6, "endStep": 8,       // khoảng steps liên tục trong recording (theo order)
  "status": "DRAFT | CONFIRMED",
  "inputSlots": [                     // DESIGN ONLY — CHƯA code parameterization (mục 3.4)
    { "slot": "{{unitCode}}", "field": "Mã", "stepOrder": 6 }
  ],
  "confirmedAt": null, "confirmedBy": null,
  "createdAt": "...", "updatedAt": "..."
}
```

- Block thuộc recording, **không gắn testcase** → nhiều testcase tham chiếu cùng blockId.
- Sửa block đã CONFIRMED → quay về DRAFT (giữ nguyên tắc đã chốt).

### 3.3 TestCaseAutomationBinding (THÊM — nằm trong workspace entry của testcase)

```json
{
  "testCaseId": "TC003",
  "automationDecision": "UNDECIDED | MANUAL_ONLY | AUTOMATED",
  "blocks": [                          // danh sách block theo đúng THỨ TỰ tester sắp xếp
    { "blockId": "BLK-login",   "order": 1 },
    { "blockId": "BLK-them-dvt", "order": 2 },
    { "blockId": "BLK-verify",  "order": 3 }
  ],
  "testDataBinding": { /* DESIGN ONLY — xem 3.4 */ },
  "expectedResult": "Thêm đơn vị tính thành công",
  "expectedResultEdited": null,
  "assertions": [ /* Assertion[] — giữ contract 5C */ ]
}
```

- Block có thể đến từ **nhiều recording khác nhau** (binding không giới hạn 1 recording).
- Thứ tự binding = thứ tự Generate (không theo thứ tự JSON/recording).
- **Generate**: ghép steps từ từng block theo `order` của binding; SETUP/`kind=SETUP` ghép trước (hoặc theo đúng vị trí tester đặt — tester quyết định).

### 3.4 TestDataBinding (DESIGN ONLY — chưa code parameterization)

- **Không nhập/sửa Test Data trong lúc chọn step.** Bước chọn recording chỉ trả lời: *"Những thao tác nào từ recording sẽ được sử dụng?"*
- Sau khi binding xong, testcase mới xử lý Test Data.
- **Action Block không hardcode test data** nếu muốn reuse → hỗ trợ **input slot**:

```
Action Block "Thêm đơn vị tính":
  Nhập Mã  → {{unitCode}}
  Nhập Tên → {{unitName}}
  Bấm Lưu

TC Positive:  unitCode = "Kg",  unitName = "Kilôgam"
TC Required:  unitName = ""     (bỏ trống → kiểm tra validation)
```

- Model (design only, chưa implement):
```json
{
  "slot": "{{unitCode}}",
  "field": "Mã",            // target của step FILL trong block
  "stepOrder": 6,
  "source": "TESTER_INPUT | TEST_DATA | SLOT"   // sau này
}
```
- Mỗi testcase có `testDataBinding: { "{{unitCode}}": "Kg", ... }` — renderer khi gặp step có slot sẽ thay bằng giá trị binding (hoặc `process.env` nếu sensitive) — **chỉ ở bước triển khai sau, không khóa thiết kế.**

### 3.5 Assertion (GIỮ nguyên contract 5C)

```json
{
  "id": "ASRT-...", "testCaseId": "TC003",
  "type": "URL | TEXT_VISIBLE | ROLE_VISIBLE | LOCATOR_VISIBLE | VALUE_EQUALS | ATTRIBUTE | COUNT",
  "target": "...", "locator": "page.getByText('...')", "expected": "...", "matcher": "toBeVisible | ...",
  "source": "SYSTEM_SUGGESTED | AI_SUGGESTED | TESTER_INPUT",
  "status": "SUGGESTED | DRAFT | TESTER_CONFIRMED | REJECTED | REMOVED",
  "reason": "...", "createdAt": "...", "confirmedAt": null
}
```

### 3.6 Quan hệ

```
RecordingSession 1 ── * ActionBlock (block thuộc recording, không gắn testcase)
TestCase 1 ── 1 TestCaseAutomationBinding (blocks[] tham chiếu blockId + thứ tự + data + expected + assertions)
ActionBlock * ── * TestCase (qua binding — reuse do tester quyết định)
```

---

## 4. Nguyên tắc cứng (KHÔNG đổi)

- **Tester-owned:** mọi decision (block nào, thứ tự, reuse, test data, expected, assertion) do tester xác nhận.
- **KHÔNG AI** cho: nhận diện testcase, mapping recording → testcase, xác định ranh giới testcase, quyết định reusable block, quyết định MAIN/SUB flow.
- **KHÔNG map theo** index / position / order JSON / row number; không tự suy testcase từ recording.
- Không hardcode testcase cụ thể (Login/Thêm/Sửa/Xóa...) — thiết kế tổng quát, form con lồng nhau là trường hợp thường.
- Legacy 5B = compatibility path (giữ tạm, không phát triển thêm).
- Generate gate giữ nguyên: chọn Automation + ≥1 block CONFIRMED + ≥1 assertion TESTER_CONFIRMED.

---

## 5. ROOT CAUSE 2 BUG (đã tái hiện bằng trace thật)

### BUG 1 — Card báo "đã gán 1 đoạn · 1 đã xác nhận" nhưng tab Recording báo "Chưa có recording để review"

**Trace:**
```
Card:  workspace.getSegmentRefs() → toItem.segments (đọc từ WORKSPACE entry)  → ✅ hiển thị đúng
Drawer tab Recording: listRecordings(workspaceId, testCaseId)
       → store.allByTestCase(testCaseId)
       → filter recording.testCaseId === testCaseId
       → recording 5C-0 có testCaseId = null (liên kết nằm ở segment) → trả []
       → V3RecordingTab detail = null → "Chưa có recording để review" ❌
```

**Root cause:** Tab Recording (5B) vẫn dùng **contract 1 recording = 1 testcase** (`store.allByTestCase`). Với mô hình Segment/binding mới, recording không gắn testCaseId → endpoint trả rỗng. Đúng như nghi ngờ ban đầu.

**Bằng chứng (trace thật):** card `segments=1, segConfirmed=1`, `recordingSummary.recordingId=null`; `GET /testcases/TC001/recordings → []`; recording thực tế `testCaseId=null, segments=1`.

**Hướng xử lý (thiết kế):** Drawer phải lấy recording **qua binding/block refs** của testcase (workspace) thay vì `allByTestCase` — hoặc endpoint mới `GET /testcases/:id/blocks` trả block + recording liên quan. Đây là REFACTOR bắt buộc khi code bước sau.

### BUG 2 — Tab "Kết quả mong đợi" hiển thị "(trống)" dù JSON có Expected Result

**Trace:**
```
approved-testcases.json (có expectedResult)
  → V3UploadPanel → AutomationV3Page.handleCreated
  → payload createWorkspace: { id, title, module, type, testData, reviewStatus }  ← THIẾU expectedResult
  → AutomationWorkspace.initTestCase: entry.expectedResult = tc.expectedResult ?? "" → ""
  → toItem: expectedResult = "" → Drawer "(trống)" ❌
```

**Root cause:** **Frontend data path mất field** — `handleCreated` không map `expectedResult` vào payload khi gọi API. Backend + contract đã hỗ trợ (payload đầy đủ → lưu đúng). Regression 9/9 PASS vì test gọi thẳng API với payload đầy đủ, **không đi qua page**.

**Bằng chứng (trace thật):** payload giống page (thiếu expectedResult) → `item.expectedResult = ""`; payload có expectedResult → `"Đăng nhập thành công"`.

**Hướng xử lý (thiết kế):** bổ sung `expectedResult` vào payload trong `handleCreated` (1 dòng) — nhưng để sau khi user duyệt architecture; không vá lẻ bây giờ.

> Cả 2 bug đều là **data path / contract** — không phải lỗi nghiệp vụ UI thuần. Thiết kế mới (binding) phải kèm quy tắc "mọi thông tin testcase đều đi qua một DTO thống nhất" để không tái diễn kiểu mất field.

---

## 6. Chứng minh 3 WORKFLOW (A / B / C)

### CASE A — Đơn giản: TC "Đăng nhập thành công"

```
Recording R1: [1] goto /login  [2] fill Tài khoản  [3] fill Mật khẩu  [4] click Đăng nhập  [5] thấy "Danh mục..."
Action Blocks (tester cắt):
  BLK-A1 "Đăng nhập"        = steps 1→4  (kind: ACTION)
  BLK-A2 "Vào màn hình chính" = step 5    (kind: ACTION)

Binding TC001:
  blocks: [ {BLK-A1, order 1}, {BLK-A2, order 2} ]
  expectedResult: "Đăng nhập thành công và hiển thị 'Danh mục phần mềm quản lý'"
  assertions: [ TEXT_VISIBLE "Danh mục phần mềm quản lý" → toBeVisible (TESTER_CONFIRMED) ]
Generate = steps(BLK-A1) + steps(BLK-A2) + assertion.
```

### CASE B — CRUD Đơn vị tính (Thêm 4 · Sửa 4 · Xóa 2) — KHÔNG record 10 lần

```
Recording R2 (1 take dài): login → mở Danh mục ĐVT → [Thêm: điền + Lưu] → [Sửa: điền + Lưu] → [Xóa: xác nhận]
Action Blocks (tester cắt theo nội dung):
  BLK-B1 "Đăng nhập" (1→4, SETUP)
  BLK-B2 "Mở Danh mục ĐVT" (5→6)
  BLK-B3 "Thêm ĐVT"        (7→10)   ← có inputSlots {{unitCode}}, {{unitName}} (DESIGN ONLY)
  BLK-B4 "Sửa ĐVT"         (11→14)
  BLK-B5 "Xóa ĐVT"         (15→16)

10 testcase:
  TC Thêm-01..04: blocks=[B1,B2,B3]  + testDataBinding khác nhau (unitCode/unitName) + expected/assertion riêng
  TC Sửa-01..04:  blocks=[B1,B2,B4]  + testDataBinding khác nhau + expected/assertion riêng
  TC Xóa-01..02:  blocks=[B1,B2,B5]  + expected/assertion riêng

→ CHỈ record 1 lần (R2); 10 testcase compose lại từ 5 block.
→ V1 (chưa code slot): nếu 2 TC "Thêm" cần data khác hẳn nhau, tester tạo 2 block "Thêm ĐVT (data A)" / "Thêm ĐVT (data B)" từ các đoạn tương ứng — vẫn KHÔNG phải record lại toàn bộ.
```

### CASE C — Flow lồng: Nhập kho thiết bị (Thêm ĐVT + Thêm KH + Cấp phát)

```
Recording R3 (1 take dài toàn luồng):
  login → Nhập kho → nhập thông tin → [mở Thêm ĐVT → thêm → đóng] → nhập tiếp
  → [mở Thêm KH → thêm → đóng] → nhập tiếp → hoàn tất → Cấp phát thiết bị

Action Blocks (tester cắt theo nội dung — KHÔNG theo testcase):
  BLK-C1 "Đăng nhập" (SETUP)
  BLK-C2 "Mở màn hình Nhập kho"
  BLK-C3 "Nhập thông tin chính"        (phần form chính)
  BLK-C4 "Thêm đơn vị tính (popup)"    ← REUSE — cũng là block của chức năng ĐVT
  BLK-C5 "Nhập thông tin chính tiếp"
  BLK-C6 "Thêm khách hàng (popup)"     ← REUSE — cũng là block của chức năng Khách hàng
  BLK-C7 "Hoàn tất Nhập kho"
  BLK-C8 "Cấp phát thiết bị"

Binding:
  TC "Nhập kho thiết bị (hợp lệ)":
    blocks = [C1, C2, C3, C4, C5, C6, C7]   ← MAIN FLOW = thứ tự block; nested blocks (C4, C6) nằm giữa
    testData riêng, expected riêng, assertions riêng
  TC "Thêm đơn vị tính" (độc lập):
    blocks = [C1, (mở Danh mục ĐVT), C4]     ← dùng LẠI block C4
  TC "Thêm khách hàng" (độc lập):
    blocks = [C1, (mở Danh mục KH), C6]
  TC "Cấp phát thiết bị":
    blocks = [C1, C2, C8]

→ MAIN FLOW + reusable/nested blocks được biểu diễn bằng THỨ TỰ binding; testcase chính (Nhập kho) không bị mất
  vì block con chỉ là 1 mắt xích trong danh sách block của nó.
→ Không cần khái niệm MAIN/SUB riêng — tester quyết định block nào nằm trong binding của testcase nào.
```

---

## 7. UX CORRECTION (bắt buộc cho design mới)

### 7.1 TESTER LUÔN GIỮ CONTEXT TESTCASE

- **Bỏ panel Recording GLOBAL đẩy lên đầu trang** (lỗi UX hiện tại: bấm "Gắn bản ghi" từ TC001 → panel mất context TC001).
- Thay bằng: bấm `[Gắn bản ghi]` trên card **TC001** → mở **Drawer/Panel của TC001** → chọn thao tác recording **ngay trong context TC001** → xác nhận → tiếp tục Expected Result/Assertion trong cùng drawer.
- Mở từ TC001: **không bắt chọn TC001 lần 2**, không cần dropdown testcase mặc định. Chỉ khi tester **chủ động** muốn gán block cho testcase khác mới mở lựa chọn khác.

### 7.2 STEP SELECTION UX (bỏ "bấm step đầu → bấm step cuối")

- Hiển thị rõ: **Step bắt đầu**, **Step kết thúc**; vùng chọn **highlight thành một khối**; dòng trạng thái `"Đã chọn bước 3 → 8 (6 thao tác)"`.
- Điều khiển chính: `Start [3 ▼]` `End [8 ▼]` (+ click timeline chỉ là shortcut).
- Có `[Đổi phạm vi]` và `[Xác nhận thao tác]`.
- Không bắt tester hiểu từ kỹ thuật "segment".

### 7.3 Thuật ngữ UI (tester) ↔ Backend

| UI (ngôn ngữ tester) | Backend |
|---|---|
| Thao tác / Đoạn thao tác | ActionBlock |
| Bước chuẩn bị | ActionBlock kind=SETUP |
| Dùng lại thao tác | Reuse block qua binding |
| Bản ghi | RecordingSession |
| Gán cho testcase / Thứ tự thao tác | TestCaseAutomationBinding.blocks[] |

---

## 8. Migration từ mô hình Segment hiện tại

| Hạng mục | Hiện tại (Segment) | Mới (Action Block + Binding) | Quyết định |
|---|---|---|---|
| `recording.segments[]` | khoảng steps, gắn `testCaseId` | `recording.blocks[]` — label, kind, **không gắn testcase**, inputSlots (design) | **REFACTOR** (đổi tên + thêm field + bỏ ràng buộc testCaseId) |
| Workspace `entry.segments[]` (refs) | ref segment + orderInTestCase | `entry.binding.blocks[]` (ref blockId + order) | **REFACTOR** (đổi chỗ lưu + đổi tên) |
| Session start không testCaseId | ✅ đã có | giữ | **GIỮ** |
| Parser steps/order/sourceRange | ✅ | giữ | **GIỮ** |
| Store version/hash/không overwrite | ✅ | giữ | **GIỮ** |
| `expectedResult` + `expectedResultEdited` | ✅ (5C) | giữ trong binding | **GIỮ** |
| Assertion contract 5C | ✅ | giữ | **GIỮ** |
| `automationDecision` | ✅ | giữ | **GIỮ** |
| Generate gate | segment CONFIRMED + assertion | block CONFIRMED + assertion | **GIỮ** (đổi tên điều kiện) |
| `suggestAssertions` deterministic | ✅ | giữ | **GIỮ** |
| `listRecordings`/drawer tab Recording theo `allByTestCase` | ❌ contract 5B | lấy recording qua binding/block refs | **REFACTOR (fix BUG 1)** |
| `handleCreated` payload thiếu expectedResult | ❌ | map đủ expectedResult | **REFACTOR (fix BUG 2)** |
| Panel Recording global đầu trang | ❌ | Drawer context testcase | **BỎ** (thay bằng drawer) |
| Dropdown testcase trong panel gán | ❌ | mặc định = testcase đang mở; chỉ mở khi chủ động | **BỎ / THÊM điều kiện** |
| "Bấm step đầu → bấm step cuối" | ❌ | Start/End dropdown + highlight khối | **BỎ** (thay UX) |
| Reuse block / block library | ❌ | binding tham chiếu blockId nhiều testcase + "Dùng lại thao tác" | **THÊM** |
| Test Data tách khỏi chọn step | ❌ | testDataBinding sau khi binding | **THÊM (design only)** |
| Input slot `{{unitCode}}` | ❌ | inputSlots + testDataBinding | **THÊM (design only — chưa code)** |
| Legacy 5B (recording gắn testCaseId) | compatibility | giữ tạm; migrate dữ liệu cũ → binding 1 block | **GIỮ (compatibility)** |

**Tóm tắt:** GIỮ (parser, store, session, expectedResult, assertion, decision, gate, suggester, legacy) · REFACTOR (segments→blocks, binding refs, drawer data path BUG 1, page payload BUG 2) · BỎ (panel global, dropdown testcase mặc định, cơ chế chọn step 2-click) · THÊM (reuse/library, block label/kind, Test Data tab, input slot design-only, endpoint blocks).

---

## 9. Phạm vi lần này — CHƯA CODE

- Chưa sửa production code, chưa sửa UI code, chưa Step 6, chưa Runner, chưa AI.
- Sau khi người dùng duyệt architecture + wireframe → mới triển khai theo thứ tự đề xuất:
  1. Fix BUG 2 (payload expectedResult) + BUG 1 (drawer qua binding) — ưu tiên vì là data path;
  2. Refactor Segment → ActionBlock + Binding (backend model + API);
  3. UI Drawer context + Step selection Start/End + Reuse;
  4. Test Data tab (design-only → triển khai sau); giữ nguyên Expected Result/Assertion 5C.

---

## 10. Tài liệu liên quan

- `v3-automation-composition-wireframe.md` — wireframe UX mới (chờ duyệt).
- `DESIGN_RECORD_MAPPING.md` — mô hình Segment (sẽ thay dần).
- `DESIGN_ASSERTION_CONFIRMATION.md`, `DESIGN_RECORD_BY_TESTCASE.md` — nền.
- `V3_HANDOFF.md` — mốc + hướng dẫn chat mới.
