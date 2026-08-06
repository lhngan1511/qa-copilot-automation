# Architecture V3 — Automation Intelligence (CHỐT)

> Branch: `arena/automation-record-by-testcase`
> Trạng thái: **KIẾN TRÚC ĐÃ ĐÓNG BĂNG** — không thay đổi nữa.
> Lượt này: cập nhật docs design cho khớp V3. **KHÔNG sửa production.**
> Checkpoint demo: tag `demo-v1-upload-codegen` = `c640b7e`.

---

## 0. Nguyên tắc cốt lõi (đóng băng)

- **approved-testcases.json KHÔNG bao giờ bị sửa** — chỉ chứa testcase (title/steps/expected/testData...). Không thêm `recording/automation/status/run/pass/fail`.
- **Mọi trạng thái automation lưu trong Automation Workspace** ("bộ não").
- **Mỗi testcase tự quay / tự sinh / tự chạy** — không có bài toán "recording thuộc TC nào / segment nào / assertion của flow nào / AI đoán sai".
- **UI mỗi testcase chỉ hiển thị MỘT hành động chính** theo trạng thái hiện tại (không bao giờ 6–7 nút cùng lúc).

---

## 1. Workflow 7 giai đoạn

```
GĐ1 Upload testcase    Requirement.md → AI Test Design → approved-testcases.json
                       Hệ thống đọc: tất cả testcase, chỉ hiển thị reviewStatus=APPROVED. KHÔNG có CodeGen.
GĐ2 Chọn testcase      Tester tick (TC001, TC005) → Workspace sinh {TC001: NOT_SELECTED→SELECTED, ...}
                       Không sinh code, không AI, không mapping.
GĐ3 Record             [Ghi testcase] → Playwright CodeGen mở → tester chỉ quay ĐÚNG TC001 → Stop → lưu recording gắn TC001.
                       Không cần AI đoán/segment/split/marker.
GĐ4 Review recording   TC001: ✓ Recording (53 steps, 3 assertions) → [Review] → sửa/xóa/record lại.
GĐ5 Generate           recording TC001 + approved TC001 + testData → Generate Playwright. (Không còn mapping nhiều testcase.)
GĐ6 Run                [Run TC001] → browser mở → PASS/FAIL. FAIL → record lại TC001, không ảnh hưởng testcase khác.
GĐ7 Hoàn thành         vòng đời đơn giản (state machine §3).
```

---

## 2. Contract RecordingSession

```ts
interface RecordingSession {
  id: string;               // REC-<ts>-<uuid8>
  workspaceId: string;
  testCaseId: string;       // "SETUP" nếu type=SETUP (setup chung), else "TC001"...
  type: "SETUP" | "TESTCASE";
  source: "PLAYWRIGHT_RECORD";
  startedAt: string;
  completedAt: string | null;
  status: SessionStatus;
  browser: string;
  url: string;
  steps: RecordingStep[];   // thứ tự thực thi từ CodeGen
  assertions: Assertion[];  // expect(...) đã record
  recordedValues: Record<string, string>;  // literal đã record (không lộ credential thật)
}

interface RecordingStep {
  stepOrder: number;
  actionType: "GOTO" | "FILL" | "CLICK" | "PRESS" | "SELECT" | "EXPECT";
  target: string;           // accessible name / label
  locator: string;          // page.getByRole(...) nguyên vẹn
  valueKind: "ENV" | "LITERAL" | "URL" | "ASSERTION" | null;
  sourceRange: [number, number];
}

interface Assertion {
  statement: string;        // expect(...).toBeVisible()
  sourceRange: [number, number];
}
```

---

## 3. State machine (V3 — đã chốt, KHÔNG dùng bản cũ)

```
NOT_SELECTED
   ↓ (chọn)
SELECTED
   ↓ (Record)
RECORDING
   ↓ (Stop)
RECORDED
   ↓ (Review)
REVIEWED
   ↓ (Generate)
GENERATED
   ↓ (Run)
RUNNING
   ↓
PASS   hoặc   FAIL
```

(FAIL → có thể Record lại TC001, quay về RECORDING.)

---

## 4. Automation Workspace — schema "bộ não"

```json
{
  "workspaceId": "ws-...",
  "selectedTestCases": [
    {
      "testCaseId": "TC001",
      "recordingId": "REC-...",
      "status": "RECORDED",
      "generatedFile": "outputs/generated-tests/TC001.spec.js",
      "lastRun": "PASS"
    },
    {
      "testCaseId": "TC005",
      "recordingId": null,
      "status": "NOT_SELECTED"
    }
  ]
}
```

- Không lưu vào approved-testcases.json.
- `status` dùng state machine §3.

---

## 5. Wireflow UI — mỗi testcase MỘT nút hành động chính

```
TC001  Đăng nhập thành công
  ○ Chưa chọn            → (tick chọn) → [Ghi testcase]
  [Ghi testcase]          → (record)    → ✓ Đã ghi [Review]
  ✓ Đã ghi [Review]       → (review)    → ✓ Review [Generate]
  ✓ Review [Generate]     → (generate)  → ✓ Generated [Run]
  ✓ Generated [Run]       → (run)       → 🟢 PASS  |  🔴 FAIL (→ [Ghi lại])
```

Người dùng **chỉ thấy 1 hành động cần làm tiếp theo**, không bao giờ 6–7 nút.

---

## 6. Review code hiện tại — GIỮ / TÁI SỬ DỤNG / THAY / LOẠI

| Phần | File | Quyết định | Lý do |
|------|------|-----------|-------|
| Recording store | `src/codegen/CodeGenRecordingStore.js` | **TÁI SỬ DỤNG** | Metadata persistent có sẵn; extend `testCaseId`, `type`, `steps`, `assertions`, `recordedValues`. |
| Session manager | `src/codegen/CodeGenSessionManager.js` | **THAY (đơn giản hóa)** | Chỉ cần start/stop/attach testCaseId. |
| Playwright runner | `src/automation/PlaywrightRunner.js` | **GIỮ** | Đã đúng. |
| Goto/URL render | `renderGotoStatement` | **GIỮ** | Đã xử lý absolute/relative. |
| TestData binding | `testDataBinding.js` | **GIỮ** | Resolver duy nhất. |
| Assertion segment | `assertionSegment.js` | **ĐƠN GIẢN HÓA** | Không còn heuristic đoán segment từ file dài. |
| AI-rewrite / fallback | `codegenSkeleton.js`, `AIAutomationCodegen.js` (phần AI) | **LOẠI khỏi đường chính** | Recording theo testcase không cần AI viết lại. |
| ApprovedTestcaseLoader | `src/codegen/ApprovedTestcaseLoader.js` | **GIỮ** | Load approved-testcases. |

---

## 7. Render spec từ recording (giữ nguyên tắc)

```
render spec =
  import test/expect
  test("<TC001 - title>", async ({ page }) => {
    [SETUP steps]        // nếu có SETUP session (goto+login+phân hệ+danh mục)
    [TC001 steps]        // thao tác + assertion của testcase
  });
```

- Goto: `renderGotoStatement`. Fill: `renderFillExpression` (ENV → `process.env.TESTDATA_*`). Assertion: từ recording.assertions.
- Node `--check` + Playwright discovery đảm bảo hợp lệ.

---

## 8. Output spike (đã chạy, `node --check PASS`)

`spike/record-by-testcase-spike.mjs` + `fixtures/setup-recording.json`, `fixtures/tc001-recording.json`.

Kết quả: chọn TC001, ghép SETUP(8) + TC001(5) = 13 bước → spec hợp lệ:

```js
import { test, expect } from '@playwright/test';
test("TC001 - Đăng nhập thành công với thông tin hợp lệ", async ({ page }) => {
  await page.goto("http://172.16.1.100:9230/wasuco/login");
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill(process.env.TESTDATA_USERNAME ?? "");
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(process.env.TESTDATA_PASSWORD ?? "");
  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill(process.env.TESTDATA_CAPTCHA ?? "");
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('link', { name: 'Quản lý hệ thống' }).click();
  await page.getByRole('link', { name: 'Danh mục' }).click();
  await page.getByRole('link', { name: 'Đơn vị tính' }).click();
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill(process.env.TESTDATA_USERNAME ?? "");
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(process.env.TESTDATA_PASSWORD ?? "");
  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill(process.env.TESTDATA_CAPTCHA ?? "");
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Danh mục phần mềm quản lý')).toBeVisible();
});
// node --check PASS
```

(Spike minh hoạ cơ chế ghép; khử trùng login nếu đã có SETUP sẽ xử lý ở production.)

---

## 9. Ước lượng triển khai

| Mục | Công việc | Ước lượng |
|-----|-----------|-----------|
| Store | Extend `CodeGenRecordingStore` + migration (testCaseId/type/steps/assertions/recordedValues) | 0.5 ngày |
| Session | Đơn giản hóa start/stop attach testCaseId | 1 ngày |
| Workspace | Module "bộ não" `AutomationWorkspace` (selectedTestCases + state machine) | 1 ngày |
| API/Routes | create/stop/get-by-testCaseId + workspace CRUD | 0.5 ngày |
| Renderer | Render spec từ (SETUP+TESTCASE) IR, dùng testDataBinding + renderGotoStatement | 1 ngày |
| UI | Wireflow single-action-button theo state | 1.5 ngày |
| Test | Fixture + test: recording→render→node --check→discovery | 0.5 ngày |
| **Tổng** | | **≈ 6 ngày** |

---

## 10. Việc đã tạo trong lượt này (KHÔNG sửa production)

- `docs/DESIGN_RECORD_BY_TESTCASE.md` (bản V3 chốt này)
- `spike/record-by-testcase-spike.mjs`
- `fixtures/setup-recording.json`, `fixtures/tc001-recording.json`
