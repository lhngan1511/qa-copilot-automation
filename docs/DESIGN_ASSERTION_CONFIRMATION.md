# Expected Result → Tester-Confirmed Automation Assertion

> Branch: `arena/automation-record-by-testcase` (kiến trúc V3 đã chốt).
> Trạng thái: **THIẾT KẾ + SPIKE** — chưa sửa production.
> Bổ sung cho `DESIGN_RECORD_BY_TESTCASE.md`.

---

## 1. Vấn đề hiện tại

Tab "Kết quả mong đợi" mới chỉ hiển thị Expected Result + khuyến nghị chung chung (`toHaveURL`/`getByText`) + nút Sao chép/Áp dụng — **thiếu kiểm soát**. Cần chuyển sang luồng **hỏi → bổ sung → xác nhận có kiểm soát**, tester là người quyết định cuối cùng.

## 2. Nguyên tắc

**AI được phép:** phân tích Expected Result, phát hiện thiếu bằng chứng, hỏi tester cần xác nhận điều gì, tạo **assertion nháp** từ thông tin tester cung cấp, giải thích assertion chứng minh gì.

**AI KHÔNG được:** tự đoán URL/thông báo/locator, tự sửa Expected Result, tự ghi assertion vào spec, tự áp dụng khuyến nghị, tự đánh dấu coverage hoàn tất.

**Tester quyết định cuối cùng.**

## 3. Luồng bắt buộc

```
Expected Result
 → AI phân tích
 → phát hiện thiếu điều kiện xác thực
 → AI đặt câu hỏi cụ thể
 → tester cung cấp bằng chứng
 → hệ thống tạo assertion nháp
 → tester xem lại
 → Chấp nhận / Chỉnh sửa / Xóa
 → lưu assertion đã xác nhận (TESTER_CONFIRMED)
 → tính lại coverage
 → mới cho Generate
```

## 4. Các loại bằng chứng tester cung cấp

| Loại | AI hỏi | Tester cung cấp | Assertion nháp |
|------|--------|-----------------|----------------|
| **URL** | "Sau đăng nhập, hệ thống chuyển đến URL nào?" | `http://172.16.1.100:9230/` | `await expect(page).toHaveURL('http://...')` |
| **Nội dung hiển thị** | "Thông báo nào phải xuất hiện?" | `Tài khoản không được để trống` | `await expect(page.getByText('...')).toBeVisible()` |
| **Phần tử / Locator** | "Phần tử nào chứng minh vào đúng màn hình?" | role+name / locator / element từ recording | `await expect(page.getByRole('heading', { name: '...' })).toBeVisible()` |
| **Giá trị / Thuộc tính** | "Thuộc tính/giá trị nào cần xác nhận?" | disabled/checked/value/count | `toBeDisabled()` / `toHaveValue()` / `toHaveCount()` |
| **Ảnh hỗ trợ** | "Chọn phần tử trong ảnh" | ảnh + chọn vị trí | phải chuyển thành URL/locator/text/role/attribute/value hoặc visual assertion đã xác nhận |

> Ảnh chỉ là nguồn hỗ trợ — **không lưu ảnh mơ hồ làm assertion duy nhất**.

## 5. Trạng thái assertion

```
SUGGESTED → DRAFT → TESTER_CONFIRMED   (dùng Generate)
                    ↘ REJECTED / REMOVED
```

Chỉ `TESTER_CONFIRMED` mới được dùng khi Generate.

## 6. Contract cuối

```ts
interface AutomationAssertion {
  id: string;
  testCaseId: string;
  type:
    | "URL" | "TEXT_VISIBLE" | "ROLE_VISIBLE" | "LOCATOR_VISIBLE"
    | "VALUE_EQUALS" | "ATTRIBUTE" | "COUNT" | "VISUAL";
  target: string;        // accessible name / label (nghiệp vụ)
  locator: string;       // page.getByRole(...) (nếu có)
  expected: string;      // giá trị kỳ vọng
  matcher: string;       // toHaveURL | toBeVisible | toHaveValue | toBeDisabled | toHaveCount ...
  source: "CODEGEN" | "TESTER_INPUT" | "TESTER_SELECTED_ELEMENT" | "AI_SUGGESTED";
  status: "SUGGESTED" | "DRAFT" | "TESTER_CONFIRMED" | "REJECTED" | "REMOVED";
  reason: string;
  createdAt: string;
  confirmedAt: string | null;
}
```

- **Không ghi đè** `expectedResult` gốc trong approved-testcases.json.
- `expectedResult` = ngôn ngữ nghiệp vụ; `automationAssertions` = bằng chứng kỹ thuật.
- Lưu trong **Automation Workspace** (bộ não), không đụng approved-testcases.

## 7. UI/UX (tab "Kết quả mong đợi")

```
Kết quả mong đợi nghiệp vụ
[Expected Result gốc]                        ← chỉ đọc

Điều kiện xác thực automation
1. Thông báo "Tài khoản không được để trống"
   Loại: Nội dung hiển thị | Trạng thái: Đã xác nhận
   [Chỉnh sửa] [Xóa]
2. URL vẫn ở /wasuco/login
   Loại: URL | Trạng thái: Nháp
   [Xác nhận] [Chỉnh sửa] [Xóa]
[+ Bổ sung điều kiện xác thực]
```

Mỗi assertion chỉ có: **một trạng thái**, **tối đa một action chính**, thao tác phụ trong menu `...`. Không hiển thị hàng loạt nút lớn.

## 8. Form bổ sung assertion

Khi bấm `[+ Bổ sung điều kiện xác thực]`:

```
Bạn muốn xác nhận bằng gì?
○ URL
○ Nội dung hiển thị
○ Phần tử / Locator
○ Giá trị / Thuộc tính
○ Ảnh hỗ trợ chọn phần tử
```

Sau khi chọn loại, AI hỏi đúng thông tin cần thiết:
- **URL**: URL mong đợi? So chính xác hay chứa? Có tham số động?
- **Nội dung**: nội dung chính xác? so chính xác/chứa? xuất hiện ở đâu?
- **Locator**: chọn từ recording / nhập Playwright locator / nhập role+name.
- **Giá trị/Thuộc tính**: disabled/checked/value/count...

## 9. Xử lý khuyến nghị sai

Bấm `[Xóa]`/`[Từ chối khuyến nghị]` → không cập nhật spec, không đổi Expected Result, không tính vào coverage, lưu `REJECTED`/`REMOVED`. AI có thể hỏi lại theo loại bằng chứng khác.

## 10. Coverage

Coverage **chỉ tính** assertion: có thật, phù hợp Expected Result, đã `TESTER_CONFIRMED`. Không tính: AI mới gợi ý, nháp, chưa có giá trị thật, placeholder `...`, bị từ chối.

## 11. Generate gate

Chỉ Generate khi:
- recording có;
- dữ liệu đủ;
- review xác nhận;
- có ≥1 `automationAssertion TESTER_CONFIRMED` phù hợp, **hoặc** tester chủ động xác nhận testcase không cần assertion bổ sung.

Không tự chèn khuyến nghị vào spec.

## 12. Cách Generate đọc assertion TESTER_CONFIRMED

Renderer đọc từ **Automation Workspace** → `testCase.testData`-independent, lấy `automationAssertions.filter(a => a.testCaseId===TC && a.status==='TESTER_CONFIRMED')` → render `matcher` theo `type` → ghép vào spec sau main action.

## 13. Persistence

Lưu trong Automation Workspace JSON (bộ não), schema:
```json
{
  "workspaceId": "...",
  "selectedTestCases": [
    {
      "testCaseId": "TC001",
      "recordingId": "...",
      "status": "REVIEWED",
      "automationAssertions": [
        { "id": "asrt-...", "type": "URL", "expected": "http://.../", "matcher": "toHaveURL", "source": "TESTER_INPUT", "status": "TESTER_CONFIRMED", ... }
      ]
    }
  ]
}
```

## 14. Test cases thiết kế

1. TC001 login thành công: Expected không có assertion → AI hỏi → tester chọn URL → nháp → xác nhận → TESTER_CONFIRMED → coverage 100% → Generate được.
2. TC002 bỏ trống tài khoản: Expected "không cho phép" → AI hỏi thông báo → tester nhập "Tài khoản không được để trống" → TESTER_CONFIRMED.
3. AI đề xuất sai (`toHaveURL('/dashboard')`): tester từ chối → REJECTED → không vào spec, không đổi Expected, không tính coverage.
4. Assertion nháp/placeholder `...` không tính coverage.
5. Không assertion TESTER_CONFIRMED → chặn Generate (trừ tester xác nhận không cần).
6. Expected Result gốc không bị ghi đè sau mọi thao tác.

## 15. Estimate triển khai

| Mục | Ước lượng |
|-----|-----------|
| Contract + persistence (workspace assertions) | 0.5 ngày |
| Luồng AI hỏi + tạo nháp theo loại bằng chứng | 1 ngày |
| Renderer đọc TESTER_CONFIRMED + matcher theo type | 0.5 ngày |
| Coverage tính đúng theo trạng thái | 0.5 ngày |
| Generate gate | 0.5 ngày |
| UI tab "Kết quả mong đợi" (single action + form bổ sung) | 1.5 ngày |
| Test | 0.5 ngày |
| **Tổng** | **≈ 5 ngày** |
