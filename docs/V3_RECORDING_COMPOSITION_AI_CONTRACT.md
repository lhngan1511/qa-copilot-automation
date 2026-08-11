# DESIGN — UNIT TYPE AUTOMATION: RECORDING COMPOSITION + AI ANALYSIS CONTRACT

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **MANUAL FOUNDATION ĐÃ IMPLEMENT (RECORD ONCE → CUT MANY + repeated D→E→D). AI: CHỈ CONTRACT + WIREFRAME — CHƯA CODE, chưa gọi Gemini.**
> Nguyên tắc: Playwright Codegen = **source evidence** (actions + locators + recorded values + expect()/verification). Framework deterministic biến nó thành automation có cấu trúc. AI chỉ **đề xuất**, tester quyết định.

---

## 1. Kiến trúc trách nhiệm

```
Playwright Codegen → thu thập evidence (actions, locators, values, expect())
Framework deterministic → parse → lưu recording → CẮT/LƯU thao tác → compose sequence → generate → run
AI → hiểu recording → đề xuất cấu trúc/ngữ nghĩa → giảm thao tác manual
Tester → xác nhận / chỉnh / bỏ qua → quyết định nghiệp vụ cuối cùng
```

**AI KHÔNG được:** tự map recording → testcase · tự tạo automation cuối cùng · tự quyết định prerequisite · tự xác nhận assertion PASS.

---

## 2. MANUAL FOUNDATION — ĐÃ HOẠT ĐỘNG (implement checkpoint này)

### 2.1 RECORD ONCE → CUT MANY ✅
- Paste 1 recording dài → cắt N đoạn **liên tiếp KHÔNG paste lại**:
  - Sau `[Xác nhận thao tác]`, panel **giữ recording** (steps + recordingId), quay lại màn cắt, hiện **"Đoạn đã lưu từ bản ghi này"** + `[Xong]`.
  - `[+ Lấy thêm từ bản ghi]` trong danh sách → mở lại đúng recording đã dán (lastRecording), không tạo RecordingSession mới.
- Files: `V3ActionSetupPanel.jsx` (giữ recordingId/steps + lastRecording + saved list + Xong), CSS.

### 2.2 Repeated block D → E → D ✅
- `bindBlockToTestCase` bỏ guard unique → cùng blockId xuất hiện nhiều lần trong `binding.sequence`.
- `reorderBinding` xử lý **multiset** (không dùng Set/Map làm mất occurrence trùng).
- `unbindBlockFromTestCase(blockId, order)` → xóa **đúng 1 occurrence** (D→E→D: xóa Search thứ 2 không mất Search thứ 1).
- Generate (resolveBlockFlow) lặp theo order → giữ chính xác D→E→D.
- Test: `automation-v3-workflow-test.js` test I (bind 2 lần → 2 occurrence; reorder giữ 2; unbind theo order → còn 1). PASS.

### 2.3 Assertion per block ✅ (đã đúng từ 6C.2)
- Trace: Login→adminButton, Add→"Thêm thành công", Search→"KG" — snapshot đúng từng block qua source-range mapping (trailing ≤120 ký tự sau action cuối).

---

## 3. AI RECORDING ANALYSIS — CONTRACT (DESIGN ONLY)

### 3.1 Input (framework cung cấp cho AI)
```
{
  recordingId, workspaceId,
  steps: [ { order, actionType, locator, target, valueKind, recordedValue(sanitized), sourceStart, sourceEnd, sourceLine } ],
  assertions: [ { order, statement, locator, matcher, expected, sourceStart, sourceEnd, sourceLine } ],
  context: { module, testCases: [{ testCaseId, title, expectedResult }] }  // CHỈ để gợi ý ngữ cảnh — KHÔNG map
}
```

### 3.2 Output — PROPOSAL có thể hành động (không phải mô tả)
```json
{
  "recordingId": "REC-...",
  "proposals": [
    {
      "suggestedName": "Đăng nhập",
      "startStep": 1,
      "endStep": 4,
      "evidence": ["fill textbox Tài khoản", "fill textbox Mật khẩu", "click button Đăng nhập"],
      "recordedAssertions": [{ "matcher": "toBeVisible", "locator": "page.getByRole('button', { name: 'adminButton' })" }],
      "confidence": 0.9,
      "needsTesterConfirmation": true
    },
    {
      "suggestedName": null,                    // KHÔNG đủ evidence → không tự đặt tên nghiệp vụ
      "startStep": 27,
      "endStep": 31,
      "evidence": ["click button", "click button"],
      "recordedAssertions": [],
      "confidence": 0.3,
      "needsTesterConfirmation": true,
      "insufficientEvidence": true              // "Không đủ bằng chứng để xác định rõ cụm thao tác."
    }
  ]
}
```
- `insufficientEvidence: true` khi không đủ bằng chứng → UI hiện **"Không đủ bằng chứng..."** và bắt tester đặt tên.
- **AI PROPOSAL ≠ PERSISTED AUTOMATION.** Không bao giờ tự persist block.

### 3.3 Flow bắt buộc
```
[Phân tích bản ghi] → AI Proposal → Tester [Xác nhận] / [Chỉnh phạm vi] / [Đổi tên] / [Bỏ qua]
→ CHỈ khi tester Xác nhận: framework tạo ActionBlock snapshot thật
  (steps + sourceRange + recordedAssertions + label tester đã duyệt)
```

### 3.4 Persist sau xác nhận
- Tạo block qua `POST /blocks` (như manual) với `startStep/endStep` = phạm vi tester chốt, `label` = tên tester chốt, `recordedAssertions` = snapshot từ recording (tính lại qua `recordedAssertionsInRange` — KHÔNG tin AI output).

---

## 4. AI TESTCASE COMPOSITION ANALYSIS — CONTRACT (DESIGN ONLY)

### 4.1 Input
```
{
  testCaseId, workspaceId,
  confirmedBlocks: [ { blockId, label, kind, startStep, endStep, sourceRecordingId, recordedAssertions } ],
  currentSequence: [ { blockId, order } ],
  recordingContext: [ { recordingId, blocks theo thứ tự source } ]  // để AI thấy quan hệ trước/sau trong recording
}
```

### 4.2 Output
```json
{
  "testCaseId": "TC-...",
  "suggestedSequence": [
    { "blockId": "BLK-login", "order": 1, "reason": "Edit xuất hiện sau Search trong recording; Search trước Edit tìm đối tượng cần sửa" },
    { "blockId": "BLK-open",  "order": 2 },
    { "blockId": "BLK-search","order": 3 },
    { "blockId": "BLK-edit",  "order": 4 },
    { "blockId": "BLK-search","order": 5, "reason": "Search sau Edit có verification dùng để quan sát kết quả" }
  ],
  "evidence": ["Edit xuất hiện sau Search trong recording", "Search trước Edit tìm đối tượng cần sửa", "..."],
  "needsTesterConfirmation": true
}
```
- UI: `[Áp dụng đề xuất]` / `[Chỉnh chuỗi]` / `[Bỏ qua]`.
- **AI KHÔNG tự ghi binding.sequence** — chỉ khi tester `[Áp dụng đề xuất]` → framework persist.

### 4.3 Prerequisite suggestion (tách riêng, chỉ gợi ý)
```
"Thao tác Tìm kiếm có thể chưa đủ để chạy độc lập.
 Trong bản ghi, trước thao tác này có: Đăng nhập → Mở chức năng Đơn vị tính.
 Bạn có muốn bổ sung vào chuỗi?"
[Thêm vào chuỗi] [Chọn lại] [Bỏ qua]
```
- KHÔNG auto prepend. KHÔNG dependency engine lớn.

---

## 5. PHÂN BIỆT 2 TẦNG AI (KHÔNG gộp)

| | A. Recording Analysis | B. Testcase Composition Analysis |
|---|---|---|
| Input | Recording (steps + assertions) | Testcase context + blocks đã xác nhận |
| Hỏi | "Có những cụm hành vi nào?" | "Cần chuỗi thao tác nào?" |
| Output | Proposals (đoạn + tên gợi ý + evidence) | suggestedSequence + evidence |
| Persist | ActionBlock (sau tester confirm) | binding.sequence (sau tester confirm) |
| Không được | Tự map block vào testcase | Tự ghi sequence |

---

## 6. PROGRESSIVE UX (cùng canonical model)

- **Manual:** Dán → tự chọn đoạn → xác nhận (đã hoạt động).
- **AI-assisted:** Dán → `[Phân tích bản ghi]` → proposal → xác nhận/chỉnh/bỏ.
- Cả hai tạo **cùng ActionBlock model** sau khi tester xác nhận — không hai architecture.

---

## 7. WIREFRAME (CHƯA CODE)

### 7.1 Manual cut-many (đã implement)
```
BẢN GHI PLAYWRIGHT (30 bước)
  ...
Đoạn đã lưu từ bản ghi này:
  ✓ Đăng nhập         bước 1 → 4
  ✓ Mở Đơn vị tính    bước 5 → 7
[ + Chọn đoạn tiếp theo ]   (giữ bản ghi — không paste lại)
[Xong]
```

### 7.2 [Phân tích bản ghi] — AI proposal review
```
PHÂN TÍCH BẢN GHI
Đề xuất:
1. Đăng nhập            Bước 1 → 4
   Evidence: nhập Tài khoản · nhập Mật khẩu · click Đăng nhập
   Verification: adminButton hiển thị
   [Xác nhận] [Chỉnh phạm vi] [Đổi tên] [Bỏ qua]
2. Mở chức năng ĐVT     Bước 5 → 7
   Evidence: mở menu Danh mục · chọn Đơn vị tính
   Verification: không tìm thấy
   [Xác nhận] [Chỉnh phạm vi] [Đổi tên] [Bỏ qua]
3. ⚠ Không đủ bằng chứng  Bước 27 → 31
   Evidence: click · click
   [Đặt tên] [Bỏ qua]
[ Lưu các đoạn đã xác nhận ]
```

### 7.3 Composition proposal
```
CHUỖI ĐỀ XUẤT CHO TC — Sửa đơn vị tính
1. Đăng nhập → 2. Mở ĐVT → 3. Tìm kiếm → 4. Sửa → 5. Tìm kiếm
Lý do: Search trước Edit tìm đối tượng; Search sau Edit quan sát kết quả.
[Áp dụng đề xuất] [Chỉnh chuỗi] [Bỏ qua]
```

---

## 8. Case Đơn vị tính — reference design (đã chứng minh)

```
Recording dài: Login → OpenUnitType → Add → Search → Edit → Search/Delete...
CASE A TC Login:        [Login]
CASE B TC Thêm:         [Login, OpenUnitType, Add]
CASE C TC Tìm kiếm:     [Login, OpenUnitType, Search]
CASE D TC Sửa:          [Login, OpenUnitType, Search, Edit, Search]   ← repeated Search (đã support)
CASE E TC Xóa:          [Login, OpenUnitType, Search, Delete, Search]
```
- Manual foundation đã chứng minh D→E→D qua test I (workflow-test).

---

## 9. Đối chiếu — CÁI GÌ ĐÃ/CHƯA

| Yêu cầu | Trạng thái |
|---|---|
| 1 recording → N thao tác (cut-many) | ✅ implement (2.1) |
| Repeated D→E→D trong binding | ✅ implement (2.2) |
| Assertion per block đúng | ✅ (6C.2) |
| Reuse nhiều testcase | ✅ (REUSABLE + reverse dep) |
| AI Recording Analysis (contract) | 📐 design — chưa code |
| AI Composition Analysis (contract) | 📐 design — chưa code |
| Prerequisite gợi ý | 📐 design — chưa code |
| AI persist | ❌ không bao giờ |

---

## 10. FILES

**Đã sửa (checkpoint này):**
- `src/codegen/AutomationWorkspace.js` (nới unique + reorder multiset + unbind theo order)
- `src/services/AutomationWorkspaceApplicationService.js` (unbind nhận order)
- `src/routes/automationV3Routes.js` (query order)
- `web-ui/src/api/automationV3Api.js` (unbindBlock order)
- `web-ui/src/components/automationV3/V3ActionSetupPanel.jsx` (continue-cutting + lastRecording + Xong + Lấy thêm từ bản ghi + saved list)
- `web-ui/src/styles/automationV3.css`
- `tests/automation-v3-workflow-test.js` (test I: repeated block)
- `tests/automation-v3-ui-test.js` (asserts continue-cutting)

**Dự kiến khi duyệt AI implement:**
- `src/codegen/recordingAnalysis.js` (contract mapper) + provider gợi ý (AI) — sau foundation vững
- `src/services/...` (POST /recordings/:id/analyze → proposals; POST /testcases/:id/composition-analyze)
- `web-ui/src/components/automationV3/V3RecordingAnalysisPanel.jsx` (proposal review)
- tests + docs
