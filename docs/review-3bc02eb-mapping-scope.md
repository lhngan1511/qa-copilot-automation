# Review Commit `3bc02eb` — Phạm vi Automation Mapping

Ngày review: 2026-08-03 · Phạm vi: mapping (`approved-testcases.json` + Playwright Codegen + `confirmedFacts` → automation mapping artifact).
Trạng thái: **chỉ review, không sửa code, không commit, không push** (repo sạch, HEAD = `3bc02eb`).

---

## ⚠️ Lưu ý then chốt
- File **`AutomationInputClassifier.js` được nhắc đến trong đề bài KHÔNG tồn tại** trong commit `3bc02eb` và trong toàn repo (`src/automation/`). Không có file phân loại input riêng; việc "phân loại action" được nhúng trực tiếp trong `AutomationActions.js` + `AutomationMappingGenerator.js`.
- Trong dữ liệu `approved-testcases.json` **không có** Playwright Codegen thật, không có `confirmedFacts`, không có locator/selector/route xác nhận. Toàn bộ "READY 35/35" trong commit đều dựa trên nguồn **không được xác nhận** (xem mục 3–5).

---

## 1. Danh sách file trong commit `3bc02eb` (26 file, +4581/−43)

### Mapping core (8)
| File | Vai trò |
|---|---|
| `src/automation/AutomationActions.js` | Từ điển action/assertion + heuristic tiếng Việt → structured |
| `src/automation/LocatorReference.js` | Model locator (key, strategy, value, confirmed, source) |
| `src/automation/LocatorReferenceStore.js` | Nạp locator từ `config/locators` hoặc `propose()` AI draft |
| `src/automation/AutomationMappingArtifact.js` | Model mapping artifact (route, actions, assertions, locators, dataRefs, blockers) |
| `src/automation/AutomationMappingGenerator.js` | Sinh mapping từ testcase (rule + AI draft + `autoApprove`) |
| `src/automation/AutomationReadinessValidator.js` | Đánh giá READY/DATA_REQUIRED/NOT_READY |
| `outputs/automation-mapping/thiet_bi.json` | Mapping đã commit (35 mapping, READY/APPROVED) |
| `tests/automation-pipeline-test.js` | Test mapping (9 test) |

### Code generation
- `src/automation/PlaywrightGenerator.js` — sinh spec/page object/data/locator/manifest

### Runner
- `src/automation/PlaywrightRunner.js` — chạy playwright, thu kết quả
- `src/automation/ExecutionResult.js` — model execution result
- `src/automation/ExecutionReport.js` — báo cáo execution

### Demo app
- `demo-app/server.js` — Express demo (login + device)

### Backend API
- `src/routes/automationRoutes.js` — `/api/automation/{modules,mapping,run}`
- `src/server/createApp.js` — gắn routes
- `src/services/AutomationPipelineService.js` — điều phối pipeline
- `src/automation/cli.js` — CLI

### Web UI
- `web-ui/src/pages/AutomationPage.jsx`
- `web-ui/src/api/automationApi.js`
- `web-ui/src/app/router.jsx`, `web-ui/src/config/navigation.js`
- `web-ui/package-lock.json`

### Tests / config / dependencies
- `tests/automation-pipeline-test.js`
- `package.json` (+ `@playwright/test`, scripts), `package-lock.json`
- `.gitignore`, `docs/phase-2-implementation-plan.md`

---

## 2. Phân tích chi tiết Mapping core

### 2.1 `AutomationReadinessValidator.js`
- Đánh giá blockers từ: route, operation, action nhận diện được, locator (qua store), data, assertion.
- **Vấn đề chính:** locator draft (AI-đề xuất) chỉ ghi `locator_draft` vào `missing`, **không thêm blocker** (`else if (locator && locator.isDraft) { missing.push(...) }` — dòng "draft là cần review, không phải blocker").
- `dataRequired` chỉ check khi step `fill/select` **không có `value`**; nhưng nếu có `testData.value` (dù rỗng) hoặc `testData.inputs` thì coi là "có data".
- `ready = blockers.length === 0`.

### 2.2 `AutomationMappingGenerator.js`
- `generate(tc, { autoApprove })`. Khi `autoApprove = true` (mặc định trong pipeline):
  1. `softenBlockers(..., ["MISSING_ROUTE","ROUTE_NOT_CONFIRMED"])` → **xóa blocker route**.
  2. Nếu `dataRefs` có key → `softenBlockers(..., ["DATA_REQUIRED"])` → **xóa blocker data** (sau khi tự sinh demo data).
  3. `softenBlockers(..., ["UNKNOWN_ACTION","UNKNOWN_ASSERTION"])` → **xóa blocker action lạ**.
- `resolveRoute`: khi `hints.route` rỗng → **suy luận route** từ screen/operation (`/device/create`), ghi `metadata.routeProposed = true`.
- `buildActions`: bước `setup` và `verify` bị **bỏ qua** (không map action).
- `buildActions` + `autoApprove`: tự sinh `demoValue(target)` → `dataRefs["demo.xxx"]`, gán `valueRef = literal:<demo>`.
- `resolveLocator` + `autoApprove`: nếu locator là draft (AI-đề xuất) thì **ép `confirmed = true`**, đổi `source = "AI_PROPOSAL_AUTO"` → coi như đã duyệt.
- `buildAssertions`: assertion type default về `toBeVisible`; target là tên feature tiếng Việt → locator AI-đề xuất.
- Kết luận artifact: `readiness: blockers.length===0 ? "READY" : "NOT_READY"`.

### 2.3 `AutomationMappingArtifact.js`
- Model thuần, không có logic xác nhận. Ghi `readiness`, `blockers`, `locatorReferences`, `dataReferences`, `metadata` từ generator.

### 2.4 `LocatorReference.js` / `LocatorReferenceStore.js`
- `LocatorReference`: có `confirmed` flag đúng khái niệm, nhưng bị generator **ghi đè thành `true`** khi `autoApprove`.
- `LocatorReferenceStore.resolve()`: nếu `config/locators` **không tồn tại** (repo không có) → `hasScreen(screen) === false` → trả `propose()` (AI draft), **không có blocker**. Vì vậy validator/generator không bao giờ thấy `LOCATOR_NOT_FOUND`.

### 2.5 Test mapping (`tests/automation-pipeline-test.js`)
- Chỉ assert **kết quả đầu ra** (blockers=0, readiness=READY, actions>0, locators>0) **khi đã chạy với `autoApprove:true`** — tức test xác nhận đúng hành vi lenient, không test tính xác thực của bằng chứng.

---

## 3. Vì sao 35/35 được đánh dấu `READY` (giải thích chính xác)

Pipeline service gọi `run({ autoApprove: true })` mặc định, rồi **ép `m.status = "APPROVED"`** cho mọi mapping và tính `readyCount = blockers.length === 0`. Kết hợp với `softenBlockers`, mọi blocker bị loại → 35/35 READY. Dưới đây là từng điều kiện readiness và nguồn dữ liệu:

| Điều kiện | Lấy từ approved testcase | Lấy từ Codegen thật | Lấy từ confirmedFacts | Do rule suy luận | Demo/default tự tạo | Locator AI đề xuất |
|---|---|---|---|---|---|---|
| Operation | `automationHints.operation` (có thật) hoặc `inferOperation()` từ tiếng Việt | ❌ | ❌ | ✔ (khi hints rỗng) | ❌ | ❌ |
| Route | `automationHints.route` (**rỗng**, 0/35 có) | ❌ | ❌ | ✔ `/device/create` | ❌ | ❌ |
| Action nhận diện | `steps.action` tiếng Việt | ❌ | ❌ | ✔ `normalizeAction` heuristic | ❌ | ❌ |
| Locator | ❌ | ❌ (không có codegen) | ❌ | ❌ | ❌ | ✔ `propose()` → ép `confirmed=true` |
| Test data | `testData.value` (**rỗng**) | ❌ | ❌ | ❌ | ✔ `demoValue()` → `literal:MA-xxxx` | ❌ |
| Assertion | `assertions[].expected` (text có) | ❌ | ❌ | ✔ type `toBeVisible`; locator = AI draft | ❌ | ✔ |
| Bỏ qua step setup/verify | — | — | — | ✔ bị bỏ qua, không tính | — | — |

→ **35/35 READY là kết quả của việc "tự hợp thức" toàn bộ nguồn thiếu**: route suy luận, locator AI bị ép confirmed, data demo tự sinh, assertion mặc định, step bị bỏ qua. Đây **không phải** bằng chứng automation đã được xác nhận.

---

## 4. Các nguồn KHÔNG được coi là bằng chứng xác nhận (theo đề bài)
Đúng yêu cầu, các nguồn sau **không** được tính là `approvedEvidence`:
- Dữ liệu demo/default (`demoValue`, `literal:MA-xxxx`, `Thiết bị demo`).
- Locator AI-đề xuất nhưng chưa tester duyệt (`AI_PROPOSAL_AUTO`).
- Route tự suy luận (`routeProposed:true`).
- Assertion tự suy luận (`toBeVisible` mặc định).
- Demo app do hệ thống tự tạo (`demo-app/server.js`).
- Label/control đoán từ nội dung tiếng Việt (`getByLabel("Mã thiết bị")`).

Trong dữ liệu thực tế: **`approvedEvidence` = rỗng** cho mọi testcase (không route, không locator, không data, không assertion-locator xác nhận).

---

## 5. Chạy lại mapping ở chế độ nghiêm ngặt
Đã chạy strict validator (`/tmp/strict-review.mjs`, đọc trực tiếp `approved-testcases.json`, không sửa code repo). Quy tắc: không demo data, không default value, không inferred route, AI-proposed locator không được coi là approved, không bỏ qua step để tăng readiness, chỉ locator có trong Playwright Codegen mới là `MAPPED`, thiếu data → `MISSING_DATA`, thiếu locator/action chính → `BLOCKED`, thiếu assertion evidence → không `READY`.

---

## 6. Báo cáo 5 testcase đầu tiên

### TC001 (Thiết bị — Thêm thiết bị)
```json
{
  "testCaseId": "TC001",
  "readiness": "BLOCKED",
  "stepMappings": [
    { "order": 1, "rawAction": "Thiết lập điều kiện trước", "normalizedAction": "setup", "mapping": "NON_AUTOMATION_SETUP" },
    { "order": 2, "rawAction": "Thiết lập điều kiện trước", "normalizedAction": "setup", "mapping": "NON_AUTOMATION_SETUP" },
    { "order": 3, "rawAction": "Thiết lập điều kiện trước", "normalizedAction": "setup", "mapping": "NON_AUTOMATION_SETUP" },
    { "order": 4, "rawAction": "Mở màn hình hoặc chức năng", "normalizedAction": "open", "mapping": "ROUTE_MISSING" },
    { "order": 5, "rawAction": "Nhập dữ liệu", "normalizedAction": "fill", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "ma_thiet_bi" },
    { "order": 6, "rawAction": "Nhập dữ liệu", "normalizedAction": "fill", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "ten_thiet_bi" },
    { "order": 7, "rawAction": "Chọn giá trị", "normalizedAction": "click", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "loai_thiet_bi" },
    { "order": 8, "rawAction": "Lưu dữ liệu", "normalizedAction": "click", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "device" },
    { "order": 9, "rawAction": "Kiểm tra kết quả nghiệp vụ", "normalizedAction": "verify", "mapping": "ASSERTION_ONLY" }
  ],
  "expectedResultMappings": [
    { "target": "Thêm thiết bị", "type": "SUCCESS", "expected": "Thiết bị được tạo thành công.", "locatorKey": null, "mapping": "ASSERTION_LOCATOR_UNCONFIRMED" }
  ],
  "approvedEvidence": [],
  "inferredEvidence": [
    "route inferred \"device/...\"",
    "locator AI-đề xuất \"Mã thiết bị\" -> \"ma_thiet_bi\" (chưa xác nhận)",
    "locator AI-đề xuất \"Tên thiết bị\" -> \"ten_thiet_bi\" (chưa xác nhận)",
    "locator AI-đề xuất \"Loại thiết bị\" -> \"loai_thiet_bi\" (chưa xác nhận)",
    "locator AI-đề xuất \"Device\" -> \"device\" (chưa xác nhận)",
    "assertion locator \"Thêm thiết bị\" unconfirmed"
  ],
  "missingData": [
    { "step": 5, "field": "Mã thiết bị", "reason": "không có giá trị dữ liệu xác nhận (value rỗng)" },
    { "step": 6, "field": "Tên thiết bị", "reason": "không có giá trị dữ liệu xác nhận (value rỗng)" }
  ],
  "warnings": [
    "ROUTE: chưa có route xác nhận",
    "step 1-3: bước setup không map sang action",
    "step 5,6,7,8: locator chỉ là AI-đề xuất, chưa nằm trong Playwright Codegen",
    "assertion \"Thêm thiết bị\" không có locator xác nhận"
  ]
}
```

### TC002 (Thiết bị — trùng BR01 Mã thiết bị)
```json
{
  "testCaseId": "TC002",
  "readiness": "BLOCKED",
  "stepMappings": [
    { "order": 1, "rawAction": "Mở màn hình hoặc chức năng", "normalizedAction": "open", "mapping": "ROUTE_MISSING" },
    { "order": 2, "rawAction": "Nhập giá trị đã tồn tại cho BR01: Mã thiết bị", "normalizedAction": "fill", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "them_thiet_bi" },
    { "order": 3, "rawAction": "Thực hiện Thêm thiết bị", "normalizedAction": "click", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "them_thiet_bi" },
    { "order": 4, "rawAction": "Kiểm tra kết quả nghiệp vụ", "normalizedAction": "verify", "mapping": "ASSERTION_ONLY" }
  ],
  "expectedResultMappings": [
    { "target": "BR01: Mã thiết bị", "type": "DUPLICATE", "expected": "Hệ thống không tạo bản ghi mới bằng giá trị BR01: Mã thiết bị đã tồn tại; dữ liệu hiện có không thay đổi.", "locatorKey": null, "mapping": "ASSERTION_LOCATOR_UNCONFIRMED" }
  ],
  "approvedEvidence": [],
  "inferredEvidence": ["route inferred", "locator AI-đề xuất \"Thêm thiết bị\"", "assertion locator unconfirmed"],
  "missingData": [ { "step": 2, "field": "Thêm thiết bị", "reason": "không có giá trị dữ liệu xác nhận" } ],
  "warnings": ["ROUTE chưa xác nhận", "locator \"Thêm thiết bị\" chỉ AI-đề xuất", "assertion không có locator xác nhận"]
}
```

### TC003 (Thiết bị — BR02 Loại thiết bị không hợp lệ)
```json
{
  "testCaseId": "TC003",
  "readiness": "BLOCKED",
  "stepMappings": [
    { "order": 1, "rawAction": "Mở màn hình hoặc chức năng", "normalizedAction": "open", "mapping": "ROUTE_MISSING" },
    { "order": 2, "rawAction": "Chọn giá trị không hợp lệ cho BR02: Loại thiết bị", "normalizedAction": "click", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "them_thiet_bi" },
    { "order": 3, "rawAction": "Thực hiện Thêm thiết bị", "normalizedAction": "click", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "them_thiet_bi" },
    { "order": 4, "rawAction": "Kiểm tra kết quả nghiệp vụ", "normalizedAction": "verify", "mapping": "ASSERTION_ONLY" }
  ],
  "expectedResultMappings": [
    { "target": "BR02: Loại thiết bị", "type": "INVALID_REFERENCE", "expected": "Hệ thống không cho phép lưu với BR02: Loại thiết bị không thuộc danh sách hợp lệ; dữ liệu không thay đổi.", "locatorKey": null, "mapping": "ASSERTION_LOCATOR_UNCONFIRMED" }
  ],
  "approvedEvidence": [],
  "inferredEvidence": ["route inferred", "locator AI-đề xuất \"Thêm thiết bị\"", "assertion locator unconfirmed"],
  "missingData": [],
  "warnings": ["ROUTE chưa xác nhận", "locator \"Thêm thiết bị\" chỉ AI-đề xuất", "assertion không có locator xác nhận"]
}
```

### TC004 (Thiết bị — BR04 dữ liệu bắt buộc)
```json
{
  "testCaseId": "TC004",
  "readiness": "BLOCKED",
  "stepMappings": [
    { "order": 1, "rawAction": "Mở màn hình hoặc chức năng", "normalizedAction": "open", "mapping": "ROUTE_MISSING" },
    { "order": 2, "rawAction": "Chuẩn bị điều kiện kiểm thử", "normalizedAction": null, "mapping": "UNKNOWN_ACTION" },
    { "order": 3, "rawAction": "Thực hiện Thêm thiết bị", "normalizedAction": "click", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "them_thiet_bi" },
    { "order": 4, "rawAction": "Kiểm tra kết quả nghiệp vụ", "normalizedAction": "verify", "mapping": "ASSERTION_ONLY" }
  ],
  "expectedResultMappings": [
    { "target": "Thêm thiết bị", "type": "GENERIC_RULE", "expected": "Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: BR04...", "locatorKey": null, "mapping": "ASSERTION_LOCATOR_UNCONFIRMED" }
  ],
  "approvedEvidence": [],
  "inferredEvidence": ["route inferred", "locator AI-đề xuất \"Thêm thiết bị\"", "assertion locator unconfirmed"],
  "missingData": [],
  "warnings": ["ROUTE chưa xác nhận", "UNKNOWN_ACTION step 2", "locator \"Thêm thiết bị\" chỉ AI-đề xuất", "assertion không có locator xác nhận"]
}
```

### TC005 (Thiết bị — để trống Mã thiết bị)
```json
{
  "testCaseId": "TC005",
  "readiness": "BLOCKED",
  "stepMappings": [
    { "order": 1, "rawAction": "Mở màn hình hoặc chức năng", "normalizedAction": "open", "mapping": "ROUTE_MISSING" },
    { "order": 2, "rawAction": "Nhập dữ liệu hợp lệ cho các trường còn lại", "normalizedAction": "fill", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "them_thiet_bi" },
    { "order": 3, "rawAction": "Để trống Mã thiết bị", "normalizedAction": null, "mapping": "UNKNOWN_ACTION" },
    { "order": 4, "rawAction": "Thực hiện Thêm thiết bị", "normalizedAction": "click", "mapping": "LOCATOR_UNCONFIRMED", "proposedLocatorKey": "them_thiet_bi" },
    { "order": 5, "rawAction": "Kiểm tra kết quả nghiệp vụ", "normalizedAction": "verify", "mapping": "ASSERTION_ONLY" }
  ],
  "expectedResultMappings": [
    { "target": "Mã thiết bị", "type": "FIELD_VALIDATION", "expected": "Hệ thống không thực hiện Thêm thiết bị và đánh dấu trường Mã thiết bị là không hợp lệ; dữ liệu không thay đổi.", "locatorKey": null, "mapping": "ASSERTION_LOCATOR_UNCONFIRMED" }
  ],
  "approvedEvidence": [],
  "inferredEvidence": ["route inferred", "locator AI-đề xuất \"Thêm thiết bị\"", "assertion locator unconfirmed"],
  "missingData": [ { "step": 2, "field": "Thêm thiết bị", "reason": "không có giá trị dữ liệu xác nhận" } ],
  "warnings": ["ROUTE chưa xác nhận", "UNKNOWN_ACTION step 3", "locator \"Thêm thiết bị\" chỉ AI-đề xuất", "assertion không có locator xác nhận"]
}
```

---

## 7. Số lượng thực tế theo chế độ nghiêm ngặt
- **READY : 0**
- **PARTIAL : 0**
- **BLOCKED : 35**

Lý do: mọi testcase đều thiếu bằng chứng xác nhận (route, locator thật, data, assertion-locator), nên theo quy tắc nghiêm ngặt đều rơi vào `BLOCKED`. Không testcase nào đạt đủ điều kiện `PARTIAL` (vì không có locator/route/assertion nào được xác nhận — điều kiện PARTIAL chỉ còn thiếu data mà thôi).

---

## 8. Kết luận
- Commit `3bc02eb` xây đủ **khung pipeline** (mapping → sinh → runner → API → web-ui → test).
- Tuy nhiên, **khẳng định "35/35 READY" trong commit là sai lệch**: nó đạt được nhờ `autoApprove` ép mọi mapping thành APPROVED, tự sinh demo data, route suy luận, locator AI bị ép `confirmed`, assertion mặc định và bỏ qua step. Không có bằng chứng automation được xác nhận nào (không Codegen thật, không `confirmedFacts`, không locator/route xác nhận trong `approved-testcases.json`).
- Theo chế độ nghiêm ngặt: **0 READY / 0 PARTIAL / 35 BLOCKED**.
- Không có file `AutomationInputClassifier.js` trong commit/repo.
