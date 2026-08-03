# Phase 2 — Automation Code Generation (Playwright) — Kế hoạch triển khai

## 1. Mục tiêu

Phase 2 đọc `outputs/production/json/approved-testcases.json` (testcase đã được duyệt từ Phase 1),
tạo **Automation Mapping** (có Human Review), sinh **Playwright code**, **chạy** bằng Chromium,
rồi lưu **Execution Result** + báo cáo. Đây là stage 11–17 trong `docs/Architecture.md`.

Các nguyên tắc bắt buộc (theo Architecture):
- Không sinh Playwright trực tiếp từ natural language (`steps.action` là tiếng Việt, `value` rỗng).
- Locator phải có Reference hoặc được người dùng xác nhận; AI chỉ đề xuất **draft**.
- Generator chỉ nhận **Approved Automation Mapping**, không nhận Draft.
- Generated code là dữ liệu dẫn xuất; JSON Artifact mới là nguồn chuẩn.
- Execution Result immutable, traceable về testcase.

## 2. Hiện trạng dữ liệu

`approved-testcases.json`:
- Chỉ chứa module **Thiết bị** (35 TC: CREATE 9, UPDATE 10, DELETE 7, SEARCH 9).
- Mỗi TC có `steps` là ngôn ngữ tự nhiên, `automationHints` đều `executable:false`,
  `missingMetadata` = routeOrNavigation, controls.saveButton, controls.<field>, assertionLocator.
- Module **Đăng nhập** chưa có testcase được duyệt → cần chạy lại Phase 1 cho `dang-nhap.md`
  hoặc dùng module có sẵn cho demo.

## 3. Cấu trúc code mới (`src/automation/`)

| File | Trách nhiệm |
|---|---|
| `AutomationActions.js` | Danh sách action/assertion được hỗ trợ + chuẩn hóa |
| `LocatorReference.js` | Model locator (key, strategy, value) |
| `LocatorReferenceStore.js` | Nạp locator từ file JSON; đề xuất locator draft |
| `AutomationMappingArtifact.js` | Model mapping (pageObject, route, actions, assertions, dataRefs, blockers) |
| `AutomationReadinessValidator.js` | Kiểm tra readiness, trả blocker |
| `AutomationMappingGenerator.js` | Rule baseline + hook AI → đề xuất mapping draft |
| `PlaywrightGenerator.js` | Sinh spec/page object/data/locator/manifest từ Approved Mapping |
| `PlaywrightRunner.js` | Chạy playwright, thu thập kết quả |
| `ExecutionResult.js` | Model Execution Result immutable |
| `ExecutionReport.js` | Xuất báo cáo Execution |

Điều phối: `src/services/AutomationPipelineService.js`
CLI: `src/automation/cli.js` (`node src/automation/cli.js --module "Thiết bị"`)

Output: `outputs/playwright/<module>/...` + `outputs/automation-mapping/<module>.json`
+ `outputs/execution/<module>/*.json`

## 4. Định dạng Automation Mapping (canonical)

```json
{
  "artifactType": "AUTOMATION_MAPPING",
  "status": "DRAFT",
  "testCaseId": "TC001",
  "module": "Thiết bị",
  "feature": "Thêm thiết bị",
  "pageObject": "device",
  "route": "/devices",
  "setup": [],
  "teardown": [],
  "actions": [
    { "stepId": "TC001-STEP-1", "action": "goto", "target": "/devices", "sourceStep": 4 },
    { "stepId": "TC001-STEP-2", "action": "fill", "locatorKey": "deviceCodeInput", "valueRef": "device.code" }
  ],
  "assertions": [
    { "type": "toBeVisible", "locatorKey": "successMessage", "expectedValue": "Thêm thiết bị thành công" }
  ],
  "locatorReferences": [
    { "locatorKey": "deviceCodeInput", "strategy": "getByLabel", "value": "Mã thiết bị" }
  ],
  "dataReferences": { "device.code": "Mã thiết bị A001" },
  "blockers": [],
  "readiness": "READY"
}
```

## 5. Nguồn Locator (ưu tiên)

1. `config/locators/<Screen>.json` do người dùng cung cấp (Reference).
2. Nếu thiếu → AI đề xuất locator **draft** (getByLabel/getByTestId/getByRole từ tên trường),
   đánh dấu cần duyệt → chờ Human Review.
3. Blockers nếu không thể xác định.

## 6. Việc làm theo thứ tự

- [x] Cài `@playwright/test` (Chromium không tải được trong sandbox — CDN bị chặn, cần chạy `npx playwright install chromium` ở máy local)
- [x] Foundation models (LocatorReference, LocatorReferenceStore, MappingArtifact, ExecutionResult)
- [x] AutomationReadinessValidator
- [x] AutomationMappingGenerator (rule baseline + AI-proposed locator draft)
- [x] PlaywrightGenerator (spec + page object + data + locator mapping + manifest)
- [x] PlaywrightRunner (graceful khi thiếu browser) + ExecutionResult/Report
- [x] Pipeline service + CLI + demo app (login + device)
- [x] Web UI: trang `/automation` (chọn module, xem mapping, Generate & Run, xem kết quả)
- [x] Test: 9 unit tests (`npm run test:automation`)

## 7. Rủi ro / phụ thuộc

- Cần app đích hoặc `BASE_URL` để "chạy" thật. Repo hiện không có app → dựng demo app
  (`demo-app/server.js`, Express phục vụ trang login/device khớp route/label) để chạy
  end-to-end; người dùng có thể trỏ `BASE_URL` về app thật.
- Module Đăng nhập chưa có testcase duyệt trong JSON sản xuất → pipeline generic; demo chạy
  trên module Thiết bị (35 TC) có sẵn.
- Chromium không tải được trong sandbox (CDN bị chặn) → runner báo diagnostic `BROWSER_NOT_INSTALLED`,
  sinh code + Execution Result status ERROR. Chạy thật cần `npx playwright install chromium` ở máy local.

## 8. Cách chạy (máy local)

```bash
npm install                      # đã có @playwright/test
npx playwright install chromium  # tải browser (sandbox không tải được)

# 1. Chạy demo app (port 3100)
npm run demo:app

# 2. Sinh mapping + code Playwright (không chạy)
npm run automation:map

# 3. Sinh + chạy Playwright (trỏ BASE_URL về demo app)
BASE_URL=http://localhost:3100 npm run automation:run

# 4. Test unit
npm run test:automation

# 5. Web UI: /automation
#    - start backend: node src/server/startServer.js
#    - start frontend: cd web-ui && npm run dev
```

Output:
- `outputs/automation-mapping/<module>.json` — mapping canonical
- `outputs/playwright/<module>/...` — generated Playwright project (spec, page object, data, locator, manifest)
- `outputs/execution/<module>/results.json` + `report.json` — kết quả chạy
