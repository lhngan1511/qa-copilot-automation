# WIREFRAME (TEXT) — Bước 5C: Expected Result → Điều kiện xác nhận (Assertion) → Generate

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **CHỜ NGƯỜI DÙNG DUYỆT — chưa code.**
> Bổ sung cho `docs/DESIGN_ASSERTION_CONFIRMATION.md` (giữ nguyên contract/trạng thái assertion ở đó) và nối tiếp `docs/DESIGN_RECORD_MAPPING.md` (5C-0 đã xong, `16c3b04`).
> Ngôn ngữ UI dùng cho tester: "Kết quả mong đợi" = Expected Result · "Điều kiện kiểm tra / Điều kiện xác nhận" = assertion · "Đề xuất" = suggestion.

---

## 0. Bối cảnh & nguyên tắc nền

- Luồng chuẩn từ 5C-0: `Recording → Segment → tester mapping → confirmed segment → (5C) Expected Result → Tester-confirmed Assertion → Generate`.
- **Legacy 5B = compatibility path** — không phát triển thêm trên giả định `1 recording = 1 testcase`.
- **Expected Result do tester sở hữu**: hệ thống/AI chỉ ĐỀ XUẤT, tester xác nhận, Generate deterministic.
- **5C chưa dùng AI thật** — nhưng UI phải thiết kế sao cho sau này cắm AI suggestion vào **không phải phá lại workflow** (mục 6).
- Giữ cứng bài học demo: không bịa assertion; nếu thiếu điều kiện xác nhận phù hợp → chặn Generate với message chuẩn.

---

## 1. Vị trí UI: Tab "Kết quả mong đợi" trong Drawer

- Drawer hiện có (5B): tabs `Thông tin | Recording`. 5C thêm tab **`Kết quả mong đợi`** (sau này thêm `Kết quả chạy` khi Bước 6).
- Mở drawer khi:
  - Card testcase có segment CONFIRMED → primary action **`[Điều kiện xác nhận]`**.
  - Hoặc từ menu card "Kết quả mong đợi".
- Footer drawer: `[Đóng] [Hành động chính]` — action đổi theo trạng thái (Chỉnh sửa kết quả mong đợi / Xác nhận điều kiện / Sinh automation).
- Chỉ hiển thị khối này cho testcase `automationDecision ≠ MANUAL_ONLY` và có segment CONFIRMED.

---

## 2. MÀN HÌNH A — Expected Result quá chung (tình huống TC001 "Đăng nhập thành công")

```
┌──────────────────────────────────────────────────────────────────┐
│ Kết quả mong đợi (nghiệp vụ)                                     │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Đăng nhập thành công                                         │ │
│ │ · Nguồn: testcase đã duyệt (approved-testcases.json)         │ │
│ │ · Bản chỉnh sửa lưu trong workspace — KHÔNG sửa file approved│ │
│ └──────────────────────────────────────────────────────────────┘ │
│ [ Chỉnh sửa kết quả mong đợi ]                                   │
│                                                                  │
│ ⚠ Chưa đủ thông tin để xác định điều kiện kiểm tra.              │
│   → Hãy mô tả cụ thể hơn, ví dụ:                                 │
│     "Đăng nhập thành công và hiển thị 'Danh mục phần mềm quản lý'"│
│                                                                  │
│ Điều kiện xác nhận                                               │
│   (chưa có điều kiện nào)                                        │
│   [ + Bổ sung điều kiện kiểm tra ]                               │
│                                                                  │
│                                           [ Đóng ]  [ Sinh automation ] (mờ) │
└──────────────────────────────────────────────────────────────────┘
```

- Warning hiện khi: **chưa có điều kiện TESTER_CONFIRMED** VÀ `analyzeExpectedResult()` đánh giá **thiếu dấu hiệu cụ thể** (mục 5).
- `[Sinh automation]` bị mờ (disabled) — chưa đủ điều kiện. Không có nút "tự tìm giúp" (không fallback/đoán).

---

## 3. MÀN HÌNH B — Sau khi tester sửa Expected Result

Tester bấm `[Chỉnh sửa kết quả mong đợi]` → ô nhập (mặc định = bản approved; lưu working copy vào workspace khi lưu):

```
┌──────────────────────────────────────────────────────────────────┐
│ Chỉnh sửa kết quả mong đợi                                       │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Đăng nhập thành công và hiển thị "Danh mục phần mềm quản lý"  │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ · Lưu trong workspace — file approved-testcases.json không đổi.  │
│ · Xóa trống → quay về bản gốc đã duyệt + hiện warning.           │
│                                 [ Hủy ]  [ Lưu ]                 │
└──────────────────────────────────────────────────────────────────┘
```

Sau khi lưu, hệ thống chạy lại `analyzeExpectedResult()` + bộ đề xuất deterministic:

```
┌──────────────────────────────────────────────────────────────────┐
│ Kết quả mong đợi                                                 │
│ Đăng nhập thành công và hiển thị "Danh mục phần mềm quản lý"      │
│ (đã chỉnh sửa — lưu workspace)        [ Chỉnh sửa ]               │
│                                                                  │
│ Đề xuất điều kiện kiểm tra (từ hệ thống)                         │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Hiển thị nội dung "Danh mục phần mềm quản lý"                 │ │
│ │ page.getByText('Danh mục phần mềm quản lý') → toBeVisible     │ │
│ │ Lý do: kết quả mong đợi có chuỗi trích dẫn + từ khóa "hiển thị"│ │
│ │                                   [ Áp dụng ]  [ Bỏ qua ]     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│  (Sau này: AI suggestion hiện ở đúng vị trí này, cùng contract — │
│   badge "Đề xuất bởi AI" + lý do, nút Áp dụng/Bỏ qua như nhau)   │
└──────────────────────────────────────────────────────────────────┘
```

- Nhiều đề xuất → hiển thị tối đa 3, mỗi cái một `[Áp dụng]` (một primary action / thẻ).
- **Áp dụng = tạo DRAFT** (chưa xác nhận) — 2 bước an toàn.

---

## 4. MÀN HÌNH C — Điều kiện xác nhận + Generate

```
┌──────────────────────────────────────────────────────────────────┐
│ Điều kiện xác nhận (do tester xác nhận — dùng để sinh test)       │
│                                                                  │
│ 1. Hiển thị nội dung "Danh mục phần mềm quản lý"                 │
│    Loại: Hiển thị nội dung | Đối tượng: "Danh mục phần mềm quản lý"│
│    Nguồn: Đề xuất (hệ thống) | Trạng thái: Nháp                  │
│    [ Xác nhận ] [ Chỉnh sửa ] [ Xóa ]                            │
│                                                                  │
│ 2. URL chuyển đến /wasuco/home                                   │
│    Loại: URL | Trạng thái: Đã xác nhận ✓                         │
│    [ Chỉnh sửa ] [ Xóa ]                                         │
│                                                                  │
│ [ + Bổ sung điều kiện kiểm tra ]  ← tester tự thêm tay           │
│                                                                  │
│ ✓ Điều kiện xác nhận đã được tester xác nhận (2/2)               │
│                                           [ Đóng ] [ Sinh automation ] │
└──────────────────────────────────────────────────────────────────┘
```

- **Trạng thái điều kiện:** `Đề xuất (SUGGESTED)` → `Nháp (DRAFT)` → `Đã xác nhận (TESTER_CONFIRMED)`; `Từ chối (REJECTED)` / `Đã xóa (REMOVED)`.
- **Sửa điều kiện đã xác nhận → quay về Nháp** (giống quyết định segment).
- **Generate gate (5C):**
  - Chưa có segment CONFIRMED → chặn từ 5C-0 (`Không có bản ghi thao tác cho testcase này.`).
  - Chưa có ≥1 điều kiện `TESTER_CONFIRMED` → **`Chưa có điều kiện xác nhận phù hợp với kết quả mong đợi.`** (đúng bài học demo — không bịa, không chạy tiếp).
  - Điều kiện `DRAFT`/`SUGGESTED`/`REJECTED` không tính.
  - Testcase được tester đặt `Chỉ kiểm thử thủ công` → không hiện khối này, không Generate.
- Sau Generate thành công: card chuyển `GENERATED`; primary → `[Chạy testcase]` (Bước 6).

---

## 5. Phát hiện "chưa đủ thông tin" — heuristic deterministic v1 (KHÔNG AI)

`analyzeExpectedResult(text)` (thuần, test được):

| Dấu hiệu cụ thể | Điều kiện |
|---|---|
| Có chuỗi trích dẫn `'...'` / `"..."` | ✅ đủ |
| Có URL (`http://`, `/đường-dẫn`, `www.`) | ✅ đủ |
| Có từ khóa hành động (`hiển thị`, `xuất hiện`, `chuyển đến`, `chuyển hướng`, `mở trang`, `điều hướng`, `không còn`, `không hiển thị`) **và** độ dài ≥ 12 ký tự | ✅ đủ |
| Không thuộc các trường hợp trên | ⚠ chưa đủ thông tin (hiện warning) |

- Warning chỉ là **gợi ý, không chặn**: tester luôn có thể `[+ Bổ sung điều kiện kiểm tra]` tay dù Expected Result còn chung.
- Generate chỉ chặn thật sự khi **thiếu điều kiện TESTER_CONFIRMED** (không phụ thuộc heuristic).
- Khi Expected Result được sửa → chạy lại phân tích + đề xuất (không cần AI).

**Bộ đề xuất deterministic v1 (mapping text → assertion, cùng contract):**

| Expected Result chứa | Đề xuất |
|---|---|
| Chuỗi trích dẫn + "hiển thị"/"xuất hiện" | `TEXT_VISIBLE` · `getByText('<chuỗi>')` → `toBeVisible` |
| Chuỗi trích dẫn + "không hiển thị"/"không còn" | `TEXT_VISIBLE` · `toBeHidden` |
| URL | `URL` · `toHaveURL` |
| "nút/button 'X'" | `ROLE_VISIBLE` · `getByRole('button', { name: 'X' })` → `toBeVisible` |
| "vô hiệu/không bấm được" + trường | `ATTRIBUTE` · `toBeDisabled` |

> Lưu ý: đề xuất chỉ là **gợi ý**; sai loại bằng chứng → tester `[Bỏ qua]`/`[Xóa]`, không vào spec, không tính coverage. (Giữ đúng mục 9–10 của DESIGN_ASSERTION_CONFIRMATION.)

---

## 6. Kiến trúc đề xuất — cắm AI sau KHÔNG phá workflow ⭐

- **Contract suggestion (giống `AutomationAssertion`):**
```js
{
  type: "URL" | "TEXT_VISIBLE" | "ROLE_VISIBLE" | "LOCATOR_VISIBLE" | "VALUE_EQUALS" | "ATTRIBUTE" | "COUNT",
  target: string,        // nhãn nghiệp vụ
  locator: string | null,
  expected: string,
  matcher: string,       // toHaveURL | toBeVisible | toBeHidden | toHaveValue | toBeDisabled | toHaveCount
  source: "SYSTEM_SUGGESTED" | "AI_SUGGESTED" | "TESTER_INPUT",
  reason: string,        // "vì sao đề xuất cái này" — hiển thị cho tester
  status: "SUGGESTED"    // đề xuất chưa áp dụng
}
```
- **5C:** nguồn đề xuất = rules deterministic → `source: "SYSTEM_SUGGESTED"`. UI render danh sách suggestion + `[Áp dụng]` → thành `DRAFT`.
- **Sau này (cắm AI):** AI provider trả **cùng shape** (`AI_SUGGESTED` + `reason` + `refs`). UI không đổi — chỉ thêm badge "Đề xuất bởi AI" và hiện `reason` (đã có sẵn ô hiển thị lý do). Luồng Áp dụng → Nháp → Xác nhận → Generate **giữ nguyên**.
- **Biên cứng:** AI không được tự `TESTER_CONFIRMED`, không tự ghi spec, không tự sửa Expected Result. Deterministic vẫn chạy đủ khi AI tắt/lỗi.
- **Trạng thái assertion trong Workspace** (đã có sẵn `automationAssertions`): bổ sung `SUGGESTED` + `source: SYSTEM_SUGGESTED` (hiện chỉ có DRAFT/TESTER_CONFIRMED/REJECTED do 5B — 5C mở rộng nhẹ, không phá contract cũ).

---

## 7. Delta cần khi code 5C (chưa làm — để tham chiếu khi duyệt)

| Hạng mục | Hiện tại | 5C |
|---|---|---|
| Workspace entry lưu `expectedResult` (gốc approved) | ❌ chưa lưu | thêm `expectedResult` + `expectedResultEdited` (working copy) |
| `createWorkspace` map `expectedResult` từ approved | ❌ chưa map | bổ sung |
| Assertion status `SUGGESTED` + source `SYSTEM_SUGGESTED` | một phần | mở rộng service + UI |
| `analyzeExpectedResult` + đề xuất deterministic (thuần) | ❌ | thêm vào `utils/automationV3.js` (hoặc file thuần) |
| Tab "Kết quả mong đợi" trong drawer | ❌ (chỉ Thông tin/Recording) | thêm tab + các khối A/B/C |
| Generate gate assertion (message chuẩn) | ✅ đã có `ASSERTION_CONFIRMATION_REQUIRED` | đổi message/giữ errorCode, thêm điều kiện SUGGESTED |
| Card primary action theo trạng thái assertion | 5C-0 (Xem và gán đoạn) | thêm `[Điều kiện xác nhận]` → `[Sinh automation]` |

**KHÔNG đổi:** contract `approved-testcases.json` (chỉ đọc), Renderer deterministic, error contract V3, nguyên tắc tester-owned mapping, không AI mapping.

---

## 8. Điều CHƯA làm / câu hỏi chờ bạn quyết định khi review

1. **Vị trí:** đặt toàn bộ ở tab "Kết quả mong đợi" trong Drawer (như wireframe) — hay tách màn hình riêng? (Đề xuất: trong Drawer, đúng tinh thần "một nơi làm việc".)
2. **Warning "Chưa đủ thông tin"** theo heuristic v1 (mục 5) — đồng ý? Hay chỉ cần hiện khi chưa có điều kiện nào (bỏ heuristic)?
3. **Đề xuất deterministic** ở 5C: hiện tự động khi đủ thông tin, hay để tester bấm `[Đề xuất điều kiện kiểm tra]` chủ động?
4. **Áp dụng đề xuất → Nháp rồi mới Xác nhận (2 bước)** — đồng ý? (An toàn, đúng "tester xác nhận cuối cùng".)
5. **Testcase không cần assertion:** design cũ (mục 11) cho phép "tester chủ động xác nhận testcase không cần assertion bổ sung" để qua gate — có giữ ở 5C không, hay bắt buộc ≥1 điều kiện TESTER_CONFIRMED cho mọi testcase tự động hóa? (Bài học demo nghiêng về bắt buộc có; đề xuất: bắt buộc.)
6. **`[Sinh automation]`** hiển thị cả trên card (khi đủ điều kiện) lẫn trong drawer footer — đồng ý?

Sau khi bạn duyệt (chốt các mục trên) mình mới code 5C.
