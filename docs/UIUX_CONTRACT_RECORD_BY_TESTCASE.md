# UI/UX CONTRACT — Record by Testcase (Architecture V3)

> Branch: `arena/automation-record-by-testcase`
> Trạng thái: **WIREFRAME + COMPONENT MAP + INTERACTION CONTRACT — CHƯA CODE PRODUCTION UI.**
> Chỉ được code UI sau khi bản này được duyệt.

---

## 1. Nguyên tắc giao diện (tóm tắt bắt buộc)

1. Một thời điểm chỉ có **MỘT hành động chính**.
2. Không hiển thị đồng thời: Ghi testcase / Review / Generate / Run / Export / Chạy lại trên cùng 1 card.
3. Mỗi card tối đa: checkbox + ID + tiêu đề + 1 trạng thái chính + 1 dòng phụ + 1 primary action + menu `...`.
4. Không hàng nút dài. 5. Không button HTML mặc định — dùng Design System.
6. Drawer chỉ mở khi tester chủ động (Xem chi tiết / Review recording / Xem kết quả). Không tự mở.
7. Không đặt Generate/Run đầu Drawer. 8. Không lặp hành động card/toolbar/Drawer/footer cùng lúc.
9. Không hiển thị thuật ngữ kỹ thuật (RecordingSession/IR/sourceRange/assertionMappings/allowlist/guard/fallback...). Chỉ ngôn ngữ tester.

---

## 2. Workflow giao diện — 5 bước chính (không hiển thị 7–8 step nhỏ)

```
① Workspace   ② Chọn testcase   ③ Record   ④ Review   ⑤ Generate & Run
```

Stepper (gọn, chỉ 5):
```
[① Workspace] → [② Chọn] → [③ Record] → [④ Review] → [⑤ Generate & Run]
```

- **④ Review gộp**: dữ liệu + recording + assertion + expected (không chia thêm tab nhỏ).
- **Banner "Đang ghi"** (global): luôn hiển thị đang record testcase nào — `[● Đang ghi] TC001 — Đăng nhập thành công`.

---

## 3. BƯỚC ① — MỞ WORKSPACE

```
┌────────────────────────────────────────────────────┐
│  Mở Workspace                                       │
│  [ Mở approved-testcases.json ]                     │
│                                                     │
│  ✓ Đã đọc: 6 testcase đã duyệt                      │
│  Module: Đăng nhập    Chức năng: Đăng nhập          │
│  (Hoặc: Mở workspace cũ / Import / Clone)           │
│                                                     │
│  (KHÔNG yêu cầu upload CodeGen ở bước này)          │
└────────────────────────────────────────────────────┘
```

Quy tắc:
- **Mở Workspace** (không phải chỉ upload): mở mới / mở cũ / import / clone — tất cả dùng chung Automation Workspace.
- Chỉ load testcase có `reviewStatus = APPROVED` (nghiệp vụ).
- **KHÔNG có `automationCandidate` trong approved-testcases.json** — trạng thái automation (`selectedForAutomation`, `recordingStatus`, `reviewStatus`, `generateStatus`, `runStatus`) do Workspace sinh.
- `executionReadiness = DATA_REQUIRED` → vẫn chọn được; cảnh báo "Cần bổ sung dữ liệu trước khi chạy".

---

## 4. BƯỚC ② — DANH SÁCH TESTCASE

### Card chuẩn (chưa chọn)
```
┌──────────────────────────────────────────────┐
│ ☐  TC001                                     │
│    Đăng nhập thành công                      │
│    Dữ liệu: Cần bổ sung Mã xác nhận          │   ← dòng phụ
│    Automation: Chưa chọn                     │   ← trạng thái chính (badge)
└──────────────────────────────────────────────┘
```

### Card sau khi tick (không mở Drawer)
```
┌──────────────────────────────────────────────┐
│ ☑  TC001                                     │
│    Đăng nhập thành công                      │
│    Automation: Đã chọn            [Ghi testcase]│  ← primary action
└──────────────────────────────────────────────┘
```

- Không mở Drawer khi tick.
- Bước ② không hiện Generate/Run.

### Action Bar batch (duy nhất một)
```
Đã chọn 2 testcase        [ Bắt đầu ghi testcase đầu tiên ]
```
Chỉ 1 nút chính; thao tác phụ trong menu `...`.

---

## 5. Trạng thái card + Primary action (mapping)

| Status | Hiển thị | Primary action |
|--------|----------|----------------|
| NOT_SELECTED | Chưa chọn | (không) |
| SELECTED / NOT_RECORDED | Chưa ghi | [Ghi testcase] |
| RECORDING | Đang ghi | [Dừng ghi] |
| RECORDED | Đã ghi | [Review] |
| UNDER_REVIEW | Đang duyệt | [Xác nhận / Duyệt recording] |
| APPROVED | Đã duyệt | [Sinh automation] |
| GENERATED | Đã sinh | [Chạy testcase] |
| RUNNING | Đang chạy | (disabled) [Đang chạy...] |
| PASSED | PASS | [Xem kết quả] |
| FAILED | FAIL | [Xem lỗi] |

- State machine V3: `NOT_SELECTED → SELECTED → RECORDING → RECORDED → UNDER_REVIEW → APPROVED → GENERATED → RUNNING → PASS/FAIL`.
- **Generate chỉ chạy khi Recording = APPROVED** (không dùng REVIEWED).
- Không hiển thị nhiều primary action cùng lúc.

---

## 6. Menu "..."

```
TC001  ⋮
  ├─ Ghi lại testcase
  ├─ Xóa recording
  ├─ Bỏ chọn automation
  ├─ Xem nguồn recording
  ├─ Xuất riêng
  └─ Đánh dấu chưa tự động hóa
```
Không đặt các thao tác này thành button riêng trên card.

---

## 7. Drawer chi tiết

- Desktop width 440–520px; mobile full width.
- Header cố định: `TC001 · Đăng nhập thành công   [×]`
- **Không** có khối "Luồng testcase này" lớn trên tab.
- Tabs gọn (pill/underline): `Thông tin | Dữ liệu | Recording | Kết quả mong đợi | Kết quả chạy`
- Chưa recorded → ẩn tab "Kết quả chạy".
- Chưa generated → ẩn nút Run.
- Footer cố định: `[Đóng]  [Hành động chính]` — action đổi theo trạng thái (Lưu dữ liệu / Duyệt recording / Xác nhận assertion / Sinh automation / Chạy testcase / Chạy lại).
- Không đặt Generate/Run trên đầu Drawer.

---

## 8. TAB THÔNG TIN (read-only)

```
ID:      TC001
Loại:    POSITIVE
Module:  Đăng nhập
Chức năng: Đăng nhập
Tiêu đề: Đăng nhập hoạt động thành công với dữ liệu hợp lệ
Mục tiêu: Kiểm tra chức năng hoạt động đúng theo yêu cầu
```
Không dùng input textbox cho thông tin chỉ đọc.

---

## 9. TAB DỮ LIỆU

```
Tài khoản     [ admin ]
Mật khẩu      [ ******** ]   [Hiện]
Mã xác nhận   [ Nhập giá trị ]

(purpose=EMPTY)
Mã xác nhận   [ Để trống theo testcase ]   ← không gắn badge "Thiếu"

Footer:  [Đóng]  [Lưu dữ liệu]
Sau Save:  ✓ Đã lưu   (không đóng Drawer, không nhập lại)
```

---

## 10. TAB RECORDING (không đổ code dài mặc định)

```
Recording: Đã ghi
Số bước: 8    Assertions: 1    Thời gian: 45 giây

 1. Mở trang đăng nhập
 2. Nhập Tài khoản
 3. Nhập Mật khẩu
 4. Nhập Mã xác nhận
 5. Chọn Đăng nhập
 6. Xác nhận trang chính
 [ Xem mã nguồn ]   ← trong menu phụ / expandable

Footer: [Đóng]  [Duyệt recording]
```

**Review KHÔNG readonly** — có quyền sửa (trong Workspace, không đụng approved-testcases):
```
Sửa locator | Xóa bước | Đổi assertion | Thêm assertion | Ghi lại
```
Các thao tác sửa nằm trong menu `...` hoặc inline nhỏ theo từng bước.

---

## 11. TAB KẾT QUẢ MONG ĐỢI

```
A. Kết quả mong đợi nghiệp vụ
   "Hệ thống không cho phép hoàn tất đăng nhập khi Tài khoản để trống."

B. Điều kiện xác thực automation
   1. Hiển thị thông báo: "Tài khoản không được để trống"
      Trạng thái: Đã xác nhận        [Chỉnh sửa]  [...]
   2. URL vẫn ở trang đăng nhập
      Trạng thái: Nháp               [Xác nhận] [Chỉnh sửa]  [...]

C. [+ Bổ sung điều kiện xác thực]   ← 1 nút duy nhất
```
Không hiển thị các khối cũ "Sao chép đoạn mã / Áp dụng khuyến nghị".

---

## 12. Luồng bổ sung assertion

Khi bấm `[+ Bổ sung điều kiện xác thực]` → form nhỏ (modal/drawer):
```
Bạn muốn xác nhận bằng gì?
○ URL   ○ Nội dung hiển thị   ○ Phần tử / Locator
○ Giá trị / Thuộc tính        ○ Hình ảnh hỗ trợ

(ví dụ URL)
URL mong đợi [ __________________ ]
So sánh: ○ Chính xác   ○ Chứa một phần
[ Hủy ]  [ Tạo điều kiện nháp ]
```
Sau đó:
```
URL = http://172.16.1.100:9230/
Trạng thái: Nháp   [Chỉnh sửa] [Xác nhận]   (Xóa trong menu "...")
```
Chỉ `TESTER_CONFIRMED` mới dùng khi Generate.

---

## 13. AI trong giao diện

AI chỉ hiển thị:
- "Đã tìm thấy bằng chứng phù hợp"
- "Chưa có bằng chứng"
- "Cần tester cung cấp URL/text/locator"
- "Có điểm chưa khớp"

AI không hiện code dài nếu tester chưa mở "Xem chi tiết kỹ thuật". AI không tự áp dụng. Không dùng "Áp dụng khuyến nghị" sửa spec trực tiếp. Luồng: AI hỏi → tester nhập → tạo nháp → tester xác nhận → lưu.

---

## 14. TAB KẾT QUẢ CHẠY

```
PASS:
  ✓ PASS   Thời gian: 2.4 giây
  [ Xem log ]  [ Xem screenshot ]

FAIL:
  ✕ FAIL
  Lý do: Không tìm thấy thông báo mong đợi.
  Bước lỗi: Xác nhận thông báo
  Expected: "Tài khoản không được để trống"
  Actual: Không tìm thấy phần tử.
  Primary: [Chạy lại]
```
Log kỹ thuật trong expandable section — không đổ stdout/stderr mặc định.

---

## 15. Action Bar hàng loạt

Chỉ xuất hiện khi có testcase chọn:
```
Đã chọn 3 testcase    [ Ghi testcase tiếp theo ]   [ ... ]
   ... → Sinh các testcase đã duyệt
        → Chạy các testcase đã sinh
        → Bỏ chọn tất cả
```
Không hiển thị 3 nút lớn cạnh nhau.

---

## 16. Design System

- Màu xanh enterprise hiện tại, border-radius thống nhất, spacing 8/12/16/24, font ≥14px, tab pill/underline rõ active, button cao ≥40px, card đủ khoảng trắng, badge gọn.
- Không dùng: button mặc định, input lệch hàng, label chồng input, text cắt không tooltip, path dài vỡ card, drawer vượt ngang.

---

## 17. Responsive

- Desktop: danh sách giữ chiều rộng; Drawer overlay (không ép co danh sách).
- Mobile: Drawer full screen, footer sticky, primary action full width.

---

## 18. Wireframe bắt buộc (đã có ở trên: §3–§15)

1. Upload: §3
2. Danh sách testcase: §4
3. Card từng trạng thái (NOT_RECORDED/RECORDED/GENERATED/PASS/FAIL): §5
4. Drawer từng tab: §7–§14
5. Luồng bổ sung assertion: §12
6. Action Bar batch: §15
7. Mobile layout: §17

---

## 19. Component map

| Component | Vị trí | Props/State | Hành động |
|-----------|--------|-------------|-----------|
| `WorkspacePanel` | Bước ① | `onOpen`, `mode` (new/open/import/clone), `summary` | mở workspace, hiển thị ✓ |
| `RecordingBanner` | Global (khi RECORDING) | `testCaseId`, `title` | luôn hiển thị "Đang ghi TC001 — ..." |
| `TestcaseCard` | Bước ② | `testCase`, `selected`, `status`, `primaryAction` | checkbox, ⋮, primary |
| `BatchActionBar` | Bước ② | `selectedCount`, `onPrimary` | 1 nút chính + ⋮ |
| `Drawer` | detail | `testCase`, `activeTab`, `footerAction` | header cố định, footer cố định |
| `TabInfo` | Drawer | `testCase` | read-only |
| `TabData` | Drawer | `fields`, `draft`, `confirmed` | Lưu dữ liệu |
| `TabRecording` | Drawer | `recording`, `steps`, `assertions`, `editable` | Duyệt recording; sửa locator/xóa bước/đổi assertion |
| `TabExpected` | Drawer | `expectedResult`, `automationAssertions` | [+ Bổ sung] |
| `AssertionForm` | modal | `type` (URL/Text/...) | tạo nháp |
| `AssertionItem` | TabExpected | `assertion`, `status` | Xác nhận/Chỉnh sửa/⋮ Xóa |
| `TabRunResult` | Drawer | `result` | PASS/FAIL, Xem log/screenshot, Chạy lại |

---

## 20. Interaction contract (test UX)

| # | Hành động | Kỳ vọng |
|---|-----------|---------|
| 1 | Tick checkbox | KHÔNG mở Drawer |
| 2 | Lưu dữ liệu | KHÔNG đóng Drawer; trạng thái cập nhật ngay; "✓ Đã lưu" |
| 3 | Mỗi card | tối đa 1 primary action |
| 4 | Generate & Run | KHÔNG xuất hiện đồng thời |
| 5 | Drawer | không có nút "trên trời"; không button mặc định |
| 6 | Popup | không popup lồng popup |
| 7 | Horizontal scroll | không có |
| 8 | Long path | không vỡ layout |
| 9 | AI suggestion | không tự sửa spec |
| 10 | Assertion sai | có thể xóa |
| 11 | Assertion đúng | có thể xác nhận |

---

## 21. Việc đã tạo trong lượt này (KHÔNG code production UI)

- `docs/UIUX_CONTRACT_RECORD_BY_TESTCASE.md` — wireframe + component map + interaction contract.

**Chờ duyệt wireframe trước khi code UI.**
