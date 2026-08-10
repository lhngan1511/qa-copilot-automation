# WIREFRAME (TEXT) — Bước 5C: Expected Result → Điều kiện xác nhận (Assertion) → Generate

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Trạng thái: **ĐÃ DUYỆT 2026-08-10 (6 quyết định chốt — mục 8) — chờ triển khai.**
> Bổ sung cho `docs/DESIGN_ASSERTION_CONFIRMATION.md` (giữ nguyên contract/trạng thái assertion ở đó) và nối tiếp `docs/DESIGN_RECORD_MAPPING.md` (5C-0 đã xong, `16c3b04`).
> Ngôn ngữ UI dùng cho tester: "Kết quả mong đợi" = Expected Result · "Điều kiện kiểm tra / Điều kiện xác nhận" = assertion · "Đề xuất" = suggestion.

---

## 0. Bối cảnh & nguyên tắc nền

- Luồng chuẩn từ 5C-0: `Recording → Segment → tester mapping → confirmed segment → (5C) Expected Result → Tester-confirmed Assertion → Generate`.
- **Legacy 5B = compatibility path** — không phát triển thêm trên giả định `1 recording = 1 testcase`.
- **Expected Result do tester sở hữu**: hệ thống/AI chỉ ĐỀ XUẤT, tester xác nhận, Generate deterministic.
- **5C chưa dùng AI thật** — nhưng UI phải thiết kế sao cho sau này cắm AI suggestion vào **không phải phá lại workflow** (mục 6).
- Giữ cứng bài học demo: không bịa assertion; nếu thiếu điều kiện xác nhận phù hợp → chặn Generate với message chuẩn.
- **Quyết định chốt của người dùng (mục 8)** là nguồn thiết kế chính thức cho việc triển khai 5C.

---

## 1. Vị trí UI: Tab "Kết quả mong đợi" trong Drawer

- Drawer hiện có (5B): tabs `Thông tin | Recording`. 5C thêm tab **`Kết quả mong đợi`** (sau này thêm `Kết quả chạy` khi Bước 6).
- **Card testcase chỉ hiển thị trạng thái tóm tắt + nút vào chi tiết** — KHÔNG có nút Generate trên card (quyết định #6).
  - Card có segment CONFIRMED → primary action **`[Điều kiện xác nhận]`** (mở drawer, tab Kết quả mong đợi).
  - Card hiển thị trạng thái nhỏ: `Điều kiện xác nhận: 2 đã xác nhận` hoặc `Chưa có điều kiện xác nhận`.
- Footer drawer: `[Đóng] [Hành động chính]` — action đổi theo trạng thái (Chỉnh sửa kết quả mong đợi / Xác nhận điều kiện / **Sinh automation — chỉ ở drawer, sau khi mọi gate đủ**).
- Chỉ hiển thị khối này cho testcase `automationDecision ≠ MANUAL_ONLY` và có segment CONFIRMED.

---

## 2. MÀN HÌNH A — Expected Result + trạng thái điều kiện xác nhận

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
│ Điều kiện xác nhận                                               │
│   (chưa có điều kiện nào)                                        │
│   [ + Bổ sung điều kiện kiểm tra ]   [ Đề xuất điều kiện xác nhận ] │
│                                                                  │
│                                           [ Đóng ]  [ Sinh automation ] (mờ) │
└──────────────────────────────────────────────────────────────────┘
```

- **KHÔNG có warning heuristic mạnh ở 5C** (quyết định #2): không suy "đủ/chưa đủ thông tin" từ từ khóa/trích dẫn/URL. Hệ thống chỉ cảnh báo khi **không tạo được assertion candidate hợp lệ từ dữ liệu hiện có** (không có gì để gợi ý) — và đó là gợi ý nhẹ, không phải logic quyết định.
- `[Sinh automation]` bị mờ (disabled) — chưa đủ điều kiện. Không có nút "tự tìm giúp" (không fallback/đoán).

---

## 3. MÀN HÌNH B — Chỉnh sửa Expected Result + đề xuất CHỦ ĐỘNG

Tester bấm `[Chỉnh sửa kết quả mong đợi]` → ô nhập (mặc định = bản approved; lưu working copy vào workspace khi lưu):

```
┌──────────────────────────────────────────────────────────────────┐
│ Chỉnh sửa kết quả mong đợi                                       │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Đăng nhập thành công và hiển thị "Danh mục phần mềm quản lý"  │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ · Lưu trong workspace — file approved-testcases.json không đổi.  │
│ · Xóa trống → quay về bản gốc đã duyệt.                          │
│                                 [ Hủy ]  [ Lưu ]                 │
└──────────────────────────────────────────────────────────────────┘
```

Sau khi lưu, tester **chủ động bấm** `[Đề xuất điều kiện xác nhận]` (quyết định #3 — không tự bung) → hệ thống chạy bộ đề xuất deterministic, hiện:

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
│ │ Lý do: kết quả mong đợi chứa chuỗi trích dẫn + "hiển thị"     │ │
│ │                                   [ Áp dụng ]  [ Bỏ qua ]     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│  (Sau này: AI suggestion hiện ở đúng vị trí này, cùng contract — │
│   badge "Đề xuất bởi AI" + lý do, nút Áp dụng/Bỏ qua như nhau)   │
└──────────────────────────────────────────────────────────────────┘
```

- Nhiều đề xuất → hiển thị tối đa 3, mỗi cái một `[Áp dụng]` (một primary action / thẻ).
- **Áp dụng = tạo DRAFT** (chưa xác nhận) — 2 bước an toàn (quyết định #4).

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

## 5. Trạng thái "chưa có gì để gợi ý" — gợi ý NHẸ (KHÔNG heuristic quyết định)

- **KHÔNG dùng heuristic mạnh** (quyết định #2): hệ thống KHÔNG suy "đủ/chưa đủ thông tin" từ từ khóa/trích dẫn/URL trong Expected Result, và KHÔNG dùng nó làm logic quyết định.
- Chỉ cảnh báo khi **không tạo được assertion candidate hợp lệ từ dữ liệu hiện có** — tức `suggestAssertions()` trả rỗng (Expected Result không khớp rule nào, không có locator/URL nào để gợi ý). Khi đó hiện gợi ý nhẹ:
  `Bạn có thể bổ sung điều kiện kiểm tra thủ công, hoặc chỉnh sửa kết quả mong đợi để hệ thống đề xuất phù hợp hơn.`
- Gợi ý này chỉ là **hỗ trợ hiển thị** — không chặn, không quyết định Generate.
- Generate chỉ chặn thật sự khi **thiếu điều kiện TESTER_CONFIRMED** (gate, mục 4).
- Khi Expected Result được sửa → tester bấm lại `[Đề xuất điều kiện xác nhận]` (chủ động — quyết định #3).

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

## 8. QUYẾT ĐỊNH ĐÃ CHỐT (người dùng — 2026-08-10) — dùng làm nguồn thiết kế chính thức

1. **Vị trí — tab "Kết quả mong đợi" trong Drawer: ĐỒNG Ý.** Expected Result và Assertion quan hệ trực tiếp → để cùng một nơi. Card chỉ hiển thị trạng thái tóm tắt + nút vào chi tiết.
2. **Warning "chưa đủ thông tin": KHÔNG heuristic mạnh ở 5C.** Chỉ cảnh báo khi **không tạo được assertion candidate hợp lệ từ dữ liệu hiện có** (gợi ý nhẹ, không làm logic quyết định).
3. **Đề xuất deterministic: tester bấm CHỦ ĐỘNG** — nút `[Đề xuất điều kiện xác nhận]`; không tự bung khi mở drawer.
4. **Áp dụng đề xuất → Nháp → Xác nhận (2 bước): ĐỒNG Ý.** "Áp dụng" = chép vào form để chỉnh; "Xác nhận" = tester chịu trách nhiệm. Không gộp.
5. **Gate assertion: BẮT BUỘC ≥1 `TESTER_CONFIRMED`** cho testcase đã chọn Automation. KHÔNG giữ lựa chọn "testcase automation không cần assertion" ở MVP (tránh automation chạy mà không chứng minh PASS). Loại testcase đặc biệt không cần assertion → để mở rộng sau bằng loại test riêng.
6. **`[Sinh automation]` CHỈ ở drawer footer**, sau khi mọi gate đủ. Card chỉ có `[Điều kiện xác nhận]` (và trạng thái tóm tắt) — một primary action thật sự, không trùng lặp.

**Flow chốt:**
```
Card testcase → [Điều kiện xác nhận] → xem/sửa Expected Result → [Đề xuất điều kiện xác nhận] (chủ động)
→ Áp dụng → Nháp → tester chỉnh → [Xác nhận] → (≥1 TESTER_CONFIRMED) → [Sinh automation] (drawer)
```

**Điểm giữ cứng nhất:** Generate chỉ bật khi testcase **đã chọn Automation** + **có confirmed segment** + **≥1 assertion TESTER_CONFIRMED** → V3 không quay lại lỗi "chạy được nhưng không biết đã PASS thật chưa".
