# Architecture Sprint — Record by Testcase

> Branch: `arena/automation-record-by-testcase`
> Trạng thái: **THIẾT KẾ + SPIKE** (KHÔNG sửa production — lượt này chỉ tạo docs/spike/fixture).
> Checkpoint: tag `demo-v1-upload-codegen` = `c640b7e`.

---

## 1. Mục tiêu

Thay đổi workflow khỏi "upload 1 file CodeGen dài" (dễ sai khi nhiều flow chung 1 recording) sang:

```
approved-testcases.json
  → chọn testcase cần automation
  → bắt đầu recording trong ngữ cảnh testCaseId
  → kết thúc recording
  → lưu RecordingSession gắn trực tiếp testCaseId
  → đối chiếu testcase với recording
  → tester review
  → generate
  → run
```

Mỗi testcase có **recording riêng**, không phải đoán segment từ 1 file dài.

---

## 2. Review code hiện tại — GIỮ / TÁI SỬ DỤNG / THAY / LOẠI

| Phần | File | Quyết định | Lý do |
|------|------|-----------|-------|
| **Recording store** | `src/codegen/CodeGenRecordingStore.js` | **TÁI SỬ DỤNG** | Đã có metadata persistent `data/codegen-recordings.json` + script dir. Mở rộng thêm trường `testCaseId`, `type` (SETUP/TESTCASE). |
| **Session manager** | `src/codegen/CodeGenSessionManager.js` (827 dòng) | **THAY THẾ (đơn giản hóa)** | Đang phức tạp (full recording lifecycle). Trong sprint này chỉ cần: start/stop/attach testCaseId. |
| **Playwright runner** | `src/automation/PlaywrightRunner.js` | **GIỮ** | Đã đúng (process.execPath + cli.js, headed, env). |
| **Goto/URL render** | `renderGotoStatement` (testDataBinding.js) | **GIỮ** | Đã xử lý URL tuyệt đối vs tương đối. |
| **TestData binding** | `testDataBinding.js` (resolveTestValue/renderFillExpression) | **GIỮ** | Resolver duy nhất. |
| **Assertion segment** | `assertionSegment.js` | **ĐƠN GIẢN HÓA** | Không còn cần heuristic "đoán segment từ file dài" — recording theo testcase đã có segment rõ ràng. Giữ khái niệm chọn assertion theo loại (success/error). |
| **codegenSkeleton / AI-rewrite / deterministic fallback** | `codegenSkeleton.js`, `AIAutomationCodegen.js` (phần AI/fallback) | **LOẠI** khỏi đường chính | Recording theo testcase không cần AI viết lại spec; chỉ render từ IR. (Giữ tạm để fallback nhưng không phải đường chính.) |
| **ApprovedTestcaseLoader** | `src/codegen/ApprovedTestcaseLoader.js` | **GIỮ** | Load approved-testcases. |

---

## 3. Contract RecordingSession

```ts
interface RecordingSession {
  id: string;               // REC-<ts>-<uuid8>
  workspaceId: string;
  testCaseId: string;       // "SETUP" nếu type=SETUP, else "TC001"...
  type: "SETUP" | "TESTCASE";
  source: "PLAYWRIGHT_RECORD";
  startedAt: string;
  completedAt: string | null;
  status: SessionStatus;    // xem §4
  browser: string;
  url: string;
  steps: RecordingStep[];   // thứ tự thực thi từ CodeGen
  assertions: Assertion[];  // expect(...) đã record
  recordedValues: Record<string, string>;  // literal đã record (không lộ credential thật)
}

interface RecordingStep {
  stepOrder: number;
  actionType: "GOTO" | "FILL" | "CLICK" | "PRESS" | "SELECT" | "EXPECT";
  target: string;          // accessible name / label (vd "Tài khoản")
  locator: string;         // page.getByRole(...) nguyên vẹn
  valueKind: "ENV" | "LITERAL" | "URL" | "ASSERTION" | null;
  sourceRange: [number, number];  // line start/end trong recording (đối chiếu)
}

interface Assertion {
  statement: string;       // expect(...).toBeVisible()
  sourceRange: [number, number];
}
```

**Lưu:** extend `CodeGenRecordingStore` (persistent `data/codegen-recordings.json`) — mỗi session 1 record, `testCaseId` là key ghép testcase→recording.

---

## 4. Trạng thái (status)

```
NOT_RECORDED → RECORDING → RECORDED → REVIEW_REQUIRED → APPROVED → GENERATED → PASSED
                                                              ↘             → FAILED
```

- `NOT_RECORDED`: testcase chưa có recording.
- `RECORDING`: đang ghi.
- `RECORDED`: ghi xong, chưa review.
- `REVIEW_REQUIRED`: cần tester đối chiếu/điều chỉnh.
- `APPROVED`: tester xác nhận mapping + assertion.
- `GENERATED`: spec đã sinh.
- `PASSED` / `FAILED`: kết quả run.

---

## 5. Wireflow UI

```
[Upload approved-testcases.json]  → danh sách testcase (mỗi testcase có status recording)
        │
[Chọn testcase]  (vd TC001)
        │
[Ghi SETUP chung nếu cần]   → RecordingSession type=SETUP (login + phân hệ + danh mục)
        │
[Ghi testcase đang chọn]    → RecordingSession type=TESTCASE gắn testCaseId=TC001
        │
[Review recording]          → xem steps/assertion/recordedValues; bổ sung/điều chỉnh
        │
[Generate]                  → ghép SETUP + TC001 → render spec (theo §6)
        │
[Run]                       → PASS/FAIL
```

**Màn hình mới** (thay cho luồng "upload 1 CodeGen dài"): tương tự CodeGenPage nhưng gắn testCaseId.

---

## 6. Render spec từ recording (giữ nguyên tắc)

```
render spec =
  import test/expect
  test("<TC001 - title>", async ({ page }) => {
    [SETUP steps]        // goto + login + phân hệ + danh mục  (nếu có SETUP session)
    [TC001 steps]        // thao tác + assertion của testcase
  });
```

- Goto: `renderGotoStatement` (URL tuyệt đối/tương đối).
- Fill: `renderFillExpression` (ENV → `process.env.TESTDATA_*`; LITERAL → giữ literal).
- Assertion: lấy từ recording.assertions (đúng testcase, không đoán).
- Node `--check` + Playwright discovery đảm bảo hợp lệ.

---

## 7. Output spike (đã chạy, `node --check PASS`)

Xem `spike/record-by-testcase-spike.mjs` + `fixtures/`.

Kết quả: chọn TC001, ghép **SETUP (8 bước: goto+login+phân hệ+danh mục)** + **TC001 (5 bước)** = 13 bước → spec hợp lệ:

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

Lưu ý spike: ghi lại SETUP có login rồi TC001 lại login — trong thực tế TC001 recording nên **không lặp login** nếu đã có SETUP; spike minh hoạ cơ chế ghép, việc khử trùng login sẽ xử lý ở production.

---

## 8. Ước lượng chi tiết

| Mục | Công việc | Ước lượng |
|-----|-----------|-----------|
| Store | Extend `CodeGenRecordingStore`: thêm `testCaseId`, `type`, `steps`, `assertions`, `recordedValues` + migration v1 | 0.5 ngày |
| Session | Đơn giản hóa `CodeGenSessionManager` start/stop attach testCaseId | 1 ngày |
| API/Routes | `codeGenRoutes` + controller: create/stop/get by testCaseId | 0.5 ngày |
| Renderer | Module render spec từ (SETUP+TESTCASE) IR, dùng lại testDataBinding + renderGotoStatement | 1 ngày |
| UI | Wireflow: chọn testcase → ghi SETUP/TC → review → generate → run | 1.5 ngày |
| Test | Fixture + test: recording→render→node --check→discovery | 0.5 ngày |
| **Tổng** | | **≈ 5 ngày** |

---

## 9. Việc đã tạo trong lượt này (KHÔNG sửa production)

- `docs/DESIGN_RECORD_BY_TESTCASE.md` (file này)
- `spike/record-by-testcase-spike.mjs` — spike render (đã chạy PASS)
- `fixtures/setup-recording.json`, `fixtures/tc001-recording.json` — fixture recording giả lập
