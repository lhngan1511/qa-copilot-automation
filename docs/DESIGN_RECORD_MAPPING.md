# DESIGN — Record Mapping V3 (Recording Session → Segment → Tester Mapping)

> Branch: `arena/automation-record-by-testcase`
> Trạng thái: **ĐÃ DUYỆT 2026-08-10 — đã triển khai Bước 5C-0.** Wireframe `docs/v3-record-mapping-wireframe.md` đã được người dùng duyệt kèm các quyết định bổ sung (mục 0.1).
> Ngày: 2026-08-10 · Bổ sung/chỉnh cho `DESIGN_RECORD_BY_TESTCASE.md`, `DESIGN_ASSERTION_CONFIRMATION.md`, `UIUX_CONTRACT_RECORD_BY_TESTCASE.md`.

---

## 0. Bối cảnh — vì sao phải đóng băng Record Mapping

Phiên demo đã chứng minh cơ chế mapping cũ **sai khi thứ tự testcase trong JSON không trùng thứ tự thao tác trong recording**:

```
Testcase JSON (thứ tự duyệt):  4 → 3 → 2 → 1
Recording (thứ tự thao tác):   1 → 2 → 4 → 3
```

Lỗi thiết kế gốc: hệ thống ngầm giả định **"recording đầu = testcase đầu"**, **"đoạn thứ N = testcase thứ N"**. Khi hai thứ tự lệch nhau, mọi đối chiếu đều sai.

**Quyết định đóng băng:** thứ tự trong JSON (thứ tự duyệt của người duyệt) và thứ tự trong recording (thứ tự thao tác của tester) là **hai thứ độc lập**. Cấm mọi suy diễn mapping dựa trên vị trí/thứ tự. Mapping chỉ do **tester gán trực tiếp theo nội dung**.

---

## 0.1. Các quyết định người dùng ĐÃ DUYỆT (2026-08-10)

1. **Gộp "Gắn bản ghi" + "Gán đoạn" trong cùng một màn hình** (wireframe mục A+B gộp).
2. **Segment đã CONFIRMED mà đổi range/loại/testcase → tự quay về DRAFT** chờ xác nhận lại.
3. **Sắp xếp nhiều segment dùng nút ↑/↓ cho MVP** (không cần kéo-thả).
4. **Trạng thái testcase gồm 3 nhãn:** `Chưa quyết định` (UNDECIDED, mặc định) · `Có automation` (AUTOMATED, tự đặt khi có segment TESTCASE đã xác nhận) · `Chỉ kiểm thử thủ công` (MANUAL_ONLY, tester đặt chủ động).
5. **Recording được phép có step không sử dụng** — step chưa thuộc đoạn nào KHÔNG phải lỗi, chỉ hiển thị thông tin và không xuất hiện trong spec sinh ra.
6. **Generate chỉ kiểm tra testcase đang Generate** — không yêu cầu toàn bộ recording phải được mapping.
7. **Hai nguyên tắc cứng giữ nguyên:** mapping bằng `testCaseId` do tester xác nhận, tuyệt đối không theo thứ tự/index; **AI không tham gia testcase ↔ recording mapping**.

## 1. Nguyên tắc đóng băng (7 điểm)

1. **Recording Session ≠ TestCase.** Tester có thể record liên tục một luồng dài (đăng nhập → vào phân hệ → mở chức năng → thêm → form con → lưu → sửa → xóa). Một Recording Session phục vụ **nhiều testcase**. Bỏ giả định `1 Recording = 1 TestCase`.

2. **Segment là đơn vị mapping.** Segment = một khoảng steps **liên tục** trong Recording Session (metadata tham chiếu `startStep`/`endStep`). Không cắt, không phá source recording gốc. Tận dụng `order`, `sourceStart`, `sourceEnd`, `sourceLine` parser đã có.

3. **Mapping thuộc quyền tester (hard rule).** Tester trực tiếp: chọn start step → chọn end step → chọn loại (SETUP/TESTCASE) → chọn đúng `testCaseId` → xác nhận. Mapping lưu bằng `testCaseId` — **không bao giờ** bằng array index / position / order / row number.

4. **Không dùng AI cho Record Mapping.** Mapping phải **deterministic + tester-confirmed**. Không thiết kế: AI Match, AI Suggest TestCase, Auto Mapping, Best Matching TestCase. Text/locator tương tự giữa recording và testcase **chỉ được dùng để hỗ trợ hiển thị/search** — không preselect, không auto assign, không lưu mapping tự động.

5. **SETUP tách khỏi testcase.** Steps đăng nhập + di chuyển đến màn hình chức năng là **SETUP dùng chung**, không gắn testcase. Giữ tinh thần `setupRecordingId` của GenerateService. Không bắt mọi testcase phải chứa lại login/navigation.

6. **Testcase không bắt buộc phải automation.** Một testcase có thể ở trạng thái: `Manual only` / `Automation chưa quyết định` / `Automation candidate` / `Automated`. **Testcase chưa có segment KHÔNG phải lỗi hệ thống** — chỉ cảnh báo khi tester cố Generate mà thiếu dữ liệu cần thiết.

7. **Một testcase có thể có nhiều Segment.** Không giả định `1 TestCase = 1 Segment`. Nếu nhiều segment: phải lưu **thứ tự segment rõ ràng**, tester có quyền sắp xếp, Generate dùng đúng thứ tự đã xác nhận. (Các segment của 1 testcase có thể đến từ **nhiều recording session** — ví dụ bổ sung đoạn sau khi re-record riêng lẻ.)

---

## 2. Mô hình dữ liệu

### 2.1 Recording Session (điều chỉnh từ hiện tại)

- **Giữ nguyên:** 1 session = 1 take CodeGen liên tục (1 source, 1 hash, 1 version, không overwrite); parser sinh `steps[]` có `order / actionType / locator / target / recordedValue / sourceStart / sourceEnd / sourceLine`.
- **Thay đổi:** session **không còn gắn cứng một `testCaseId`**. `testCaseId` chỉ tồn tại ở mức **Segment**.
- **Tương thích:** giữ field `testCaseId` ở recording cho dữ liệu cũ (đọc được, đánh dấu deprecated) — không phá data đã có.
- **Bổ sung:** `segments: Segment[]` tham chiếu khoảng steps của chính session.

### 2.2 Segment (mới — metadata thuần)

```json
{
  "segmentId": "SEG-...",
  "recordingSessionId": "SES-...",
  "startStep": 6,
  "endStep": 8,
  "type": "SETUP" | "TESTCASE",
  "testCaseId": "TC003" | null,
  "status": "DRAFT" | "CONFIRMED",
  "confirmedAt": "ISO-8601 | null",
  "confirmedBy": "tester"
}
```

- `startStep`/`endStep` tham chiếu `steps[].order` (1-based trong session) — có thể nối `sourceStart/sourceEnd` để highlight trong UI.
- Segment là **metadata**: không tạo recording mới, không cắt source, không đổi hash/version của session.
- `type=TESTCASE` bắt buộc `testCaseId`; `type=SETUP` có `testCaseId=null`.
- `status`: chỉ tester xác nhận mới thành `CONFIRMED`. Hệ thống/AI không được tự đặt `CONFIRMED`.

### 2.3 Workspace ("bộ não") — bổ sung (đã triển khai)

Mỗi entry `selectedTestCases[i]` bổ sung (tên field theo code thật):

```json
{
  "automationDecision": "UNDECIDED" | "MANUAL_ONLY" | "AUTOMATED",
  "segments": [
    { "segmentId": "SEG-...", "recordingId": "REC-...", "orderInTestCase": 1 },
    { "segmentId": "SEG-...", "recordingId": "REC-...", "orderInTestCase": 2 }
  ]
}
```

- **Mapping testcase ↔ segment lưu ở Workspace** (vì 1 testcase có thể nhận segment từ nhiều session). Khoảng steps (`startStep/endStep`) lưu ở session.
- `segments[]` theo đúng **thứ tự tester sắp xếp** → Generate dùng đúng thứ tự này.
- Không đụng `approved-testcases.json` (chỉ đọc).

### 2.4 Quan hệ

```
Recording Session 1 ──── * Segment * ──── 1 TestCase (qua Workspace)
        │                    │
        └─ steps[] (order/sourceStart/sourceEnd/sourceLine)
```

- SETUP: Segment không gắn testcase, dùng chung cho mọi testcase trong workspace.
- Một testcase: 0..n segment, từ 1..n session.

---

## 3. Luồng thao tác tester (bắt buộc)

```
Record (1 take dài) 
  → Parser sinh Timeline steps
  → Tester chọn Start step → End step
  → Tester chọn loại: SETUP | TESTCASE
  → Nếu TESTCASE: chọn đúng testCaseId (tìm theo tên/bước, KHÔNG tự chọn sẵn)
  → Xác nhận Segment (DRAFT → CONFIRMED)
  → Review Mapping (nhìn rõ testcase nào dùng đoạn nào, sắp xếp nhiều đoạn)
  → Expected Result → Tester-confirmed Assertion (Bước 5C — sau khi Record Mapping được duyệt)
  → Generate (validate theo segment)
```

---

## 4. Validation trước Generate (message chuẩn — không fallback, đã triển khai)

| Tình huống | errorCode | HTTP | Message |
|---|---|---|---|
| Testcase chưa có segment nào (và không có recording legacy) | `RECORDING_MAPPING_REQUIRED` | 409 | `Không có bản ghi thao tác cho testcase này.` |
| Có segment nhưng còn `DRAFT` | `SEGMENT_NOT_CONFIRMED` | 409 | `Bản ghi thao tác chưa được xác nhận.` |
| Mapping không hợp lệ (thiếu segment, sai testcase, segment đã bị xóa) | `SEGMENT_MAPPING_INVALID` | 422 | `Chưa xác định đầy đủ đoạn thao tác cho testcase.` |

- **Generate chỉ kiểm tra testcase đang Generate** — recording còn step chưa gán KHÔNG chặn Generate (quyết định #6).
- **Cấm fallback:** không tự đoán, không tìm testcase gần nhất, không tự lấy segment đầu tiên, không tự gán.
- Tương thích ngược: testcase KHÔNG có segment nhưng có recording APPROVED kiểu cũ (gắn thẳng `testCaseId`) vẫn generate theo luồng 5B (legacy).

---

## 5. Generate với nhiều segment (đã triển khai)

- GenerateService nhận `segments` (danh sách ref `{segmentId, recordingId, orderInTestCase}` từ Workspace), ghép steps theo `orderInTestCase` do tester xác nhận; metadata giữ từng segment (id/recording/start/end) để truy vết.
- SETUP segments ghép **trước** TESTCASE segments (setup = segment `type=SETUP` CONFIRMED trong chính các recording mà testcase đang dùng; hoặc theo `setupRecordingId` nếu truyền).
- Renderer vẫn **thuần, deterministic, không AI** — nhận một recording view đã ghép steps, không đổi logic render.

---

## 6. Đối chiếu với code (đã triển khai 5C-0) — delta

| Hạng mục | Trạng thái 5C-0 |
|---|---|
| Parser steps có `order/sourceStart/sourceEnd/sourceLine` | ✅ có sẵn (dùng để cắt segment) |
| Store: `testCaseId` nullable, `testcaseIds`, `type SETUP/TESTCASE`, version/hash, không overwrite | ✅ có sẵn |
| Store: `segments[]` trong recording + CRUD segment (metadata, không cắt source) | ✅ thêm mới |
| `CurrentRecordingSession.start` cho phép TESTCASE **chưa gán testCaseId** | ✅ thay đổi |
| Workspace: `segments[]` ref + `automationDecision` + add/remove/reorder | ✅ thêm mới |
| Service: create/update/confirm/delete segment, reorder, automation-decision | ✅ thêm mới |
| `GenerateService` ghép nhiều segment theo thứ tự tester + SETUP chung + legacy fallback | ✅ thay đổi |
| Renderer | ✅ không đổi (nhận recording view đã ghép) |
| UI: Timeline + gán đoạn + Review Mapping (một màn hình, ↑/↓, step chưa dùng hiển thị thông tin) | ✅ thêm mới |
| Validation gating Generate theo segment (mục 4) | ✅ thêm mới |
| Test: `tests/automation-v3-record-mapping-test.js` | ✅ thêm mới |

**KHÔNG đổi:** contract `approved-testcases.json` (chỉ đọc), nguyên tắc Renderer thuần, error contract V3 (`{ success, errorCode, message, details }`), kiến trúc Route → AppService → Domain/Store/GenerateService → Renderer.

---

## 7. Guardrail — KHÔNG làm

- Không AI mapping: không tự đoán testcase, không đề xuất candidate, không tự chia recording theo testcase, không tự gán segment, không dùng thứ tự JSON/recording để suy testcase, không sửa mapping đã xác nhận.
- Không map theo index / position / order / row number.
- Không hardcode testcase cụ thể (Login, Thêm, Sửa, Xóa...) — thiết kế tổng quát cho mọi chức năng và form con lồng nhau.
- Không sửa Test Design V2. Không refactor toàn framework. Không sửa production ngoài phạm vi V3.
- Không code implementation trước khi người dùng duyệt wireframe.

---

## 8. Tổng quát hóa (dùng lâu dài, không chỉ 1 danh mục)

- Segment **không biết nghiệp vụ** — chỉ là khoảng steps: form con lồng nhau = segment dài hơn; testcase nhiều thao tác = nhiều segment; luồng dài có setup chung = 1 session nhiều segment. Mọi danh mục/chức năng đều dùng chung một cơ chế.
- Testcase nhỏ/độc lập vẫn hoạt động tự nhiên: 1 segment 1 testcase — không phải trường hợp đặc biệt.

---

## 9. Tài liệu liên quan

- `DESIGN_RECORD_BY_TESTCASE.md` — kiến trúc V3 (đóng băng).
- `DESIGN_ASSERTION_CONFIRMATION.md` — Expected Result → assertion (Bước 5C, làm **sau** Record Mapping).
- `UIUX_CONTRACT_RECORD_BY_TESTCASE.md` — contract UI chung.
- `v3-record-mapping-wireframe.md` — wireframe text **đã duyệt** (kèm quyết định mục F).
- `V3_HANDOFF.md`, `backlog.md`.
