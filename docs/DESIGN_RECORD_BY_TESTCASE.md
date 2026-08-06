# Architecture V3 — Automation Intelligence (CHỐT, sau 5 điểm chốt lại)

> Branch: `arena/automation-record-by-testcase`
> Trạng thái: **KIẾN TRÚC ĐÃ ĐÓNG BĂNG** — không thay đổi workflow nữa.
> Lượt này: cập nhật docs cho khớp **5 điểm chốt lại** (Workspace / automationCandidate / Record hiện tại / Review editable / APPROVED state).
> **KHÔNG sửa production.**

---

## 0. Nguyên tắc cốt lõi (đóng băng)

- **Mỗi testcase tự quay → tự sinh → tự chạy.** Không upload 1 file CodeGen rồi AI đoán/segment/map/sửa.
- **approved-testcases.json KHÔNG lưu trạng thái automation** — chỉ chứa testcase (title/steps/expected/testData) + `reviewStatus` nghiệp vụ.
- **Automation Workspace = "bộ não"** lưu mọi trạng thái automation.
- **AI chỉ hỗ trợ, tester quyết định cuối cùng.**
- **Một thời điểm chỉ MỘT hành động chính** (UI).

---

## 1. [CHỐT] GĐ1 = "MỞ WORKSPACE" (không phải "Upload testcase")

```
Mở Workspace
  ↓
Đọc approved-testcases.json
  ↓
Sinh Automation Workspace
  ↓
Hiển thị danh sách testcase
```

Lý do: user không chỉ upload — có thể mở Workspace cũ, tiếp tục làm dở, import, clone. Tất cả dùng chung Automation Workspace.

### Automation Workspace schema (đã chốt, tách hẳn khỏi approved-testcases)

```json
{
  "workspaceId": "ws-...",
  "source": "approved-testcases.json (ref) | import | clone",
  "selectedTestCases": [
    {
      "testCaseId": "TC001",
      "selectedForAutomation": true,
      "recordingId": "REC-...",
      "recordingStatus": "RECORDED",
      "reviewStatus": "APPROVED",
      "generateStatus": "GENERATED",
      "runStatus": "PASS",
      "generatedFile": "outputs/generated-tests/TC001.spec.js",
      "automationAssertions": [ /* xem DESIGN_ASSERTION_CONFIRMATION.md */ ]
    }
  ]
}
```

---

## 2. [CHỐT] automationCandidate KHÔNG nằm trong approved-testcases.json

- approved-testcases.json **chỉ cần** `reviewStatus: "APPROVED"` (trạng thái nghiệp vụ duy nhất để chọn hiển thị).
- **Bỏ `automationCandidate` khỏi approved-testcases.json** — nó là trạng thái automation, thuộc Workspace.
- Workspace tự sinh các trạng thái: `selectedForAutomation`, `recordingStatus`, `reviewStatus`, `generateStatus`, `runStatus`.

---

## 3. [CHỐT] Record = "Record HIỆN TẠI" (luôn biết đang ghi TC nào)

```
TC001 → Record → [Recording đang hoạt động] → Stop → Review → Generate
```

UI **luôn hiển thị đang ghi testcase nào**, không để user quên:

```
[● Đang ghi]  TC001 — Đăng nhập thành công
```

- Chỉ 1 testcase được record tại 1 thời điểm.
- Global banner "Đang ghi TC001" xuất hiện bất kể màn hình nào.

---

## 4. [CHỐT] Review Recording KHÔNG readonly — có quyền sửa

```
Review
  ↓
Sửa locator | Xóa bước | Đổi assertion | Thêm assertion | Ghi lại
```

Recording editable (trong Workspace, không đụng approved-testcases):
- Sửa locator, xóa bước, đổi/thêm assertion.
- Ghi lại toàn bộ nếu cần.

---

## 5. [CHỐT] State Machine V3 (bỏ "REVIEWED", dùng "UNDER_REVIEW" → "APPROVED")

```
NOT_SELECTED
   ↓
SELECTED
   ↓
RECORDING
   ↓
RECORDED
   ↓
UNDER_REVIEW
   ↓
APPROVED          ← "tôi đã xem VÀ đồng ý" (không phải chỉ xem)
   ↓
GENERATED
   ↓
RUNNING
   ↓
PASS  |  FAIL
```

- Không dùng `REVIEWED` (chỉ nghĩa "đã xem").
- **Generate chỉ chạy khi Recording = APPROVED** (GĐ5 gate).

---

## 6. Workflow giao diện — 5 bước (không hiển thị 7–8 step nhỏ)

```
① Workspace   ② Chọn testcase   ③ Record   ④ Review   ⑤ Generate & Run
```

- **Review (④) gộp**: dữ liệu + recording + assertion + expected — không chia thêm tab nhỏ.

---

## 7. Contract RecordingSession (giữ từ V3 trước)

```ts
interface RecordingSession {
  id, workspaceId, testCaseId, type: "SETUP"|"TESTCASE", source,
  startedAt, completedAt, status, browser, url,
  steps: RecordingStep[], assertions: Assertion[], recordedValues: Record<string,string>
}
```

---

## 8. GĐ3–GĐ7 (giữ từ V3, chỉ đổi tên state theo §5)

GĐ2 chọn testcase → GĐ3 record hiện tại → GĐ4 review editable → GĐ5 generate (gate: APPROVED + assertion TESTER_CONFIRMED) → GĐ6 run → GĐ7 hoàn thành.

---

## 9. Estimate triển khai (không đổi lớn)

≈ 6 ngày: Store extend 0.5 · Session/record 1 · Workspace 1 · API 0.5 · Renderer 1 · UI (5 bước + banner "đang ghi" + review editable) 1.5 · Test 0.5.

---

## 10. Tài liệu liên quan (cùng branch)

- `docs/DESIGN_ASSERTION_CONFIRMATION.md` — Expected → Tester-confirmed assertion.
- `docs/UIUX_CONTRACT_RECORD_BY_TESTCASE.md` — wireframe + component map (cần cập nhật nhẹ theo "Mở Workspace", banner "đang ghi", review editable).
