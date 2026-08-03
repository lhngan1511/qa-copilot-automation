# Automation Mapping Layer v2 — Design Spec (hướng MVP)

Trạng thái: **Design Spec — CHƯA triển khai code, CHƯA commit, CHƯA push.**
Bản đặc tả chốt mô hình dữ liệu và quy tắc để triển khai code MỘT LẦN, tránh vá theo từng testcase.

## Phạm vi MVP (đã thống nhất)

- Nguồn Automation Discovery cho MVP chỉ gồm **3 nguồn**: `approved-testcases.json`, **Playwright Codegen do tester quay**, và **Confirmed Facts do tester cung cấp**.
- **Playwright Codegen là nguồn locator chính của MVP** (locator/route/action lấy từ codegen thật).
- Chỉ hỗ trợ 5 `sourceType`: `APPROVED_TEST_CASE`, `PLAYWRIGHT_CODEGEN`, `CONFIRMED_FACT`, `TESTER_INPUT`, `AI_PROPOSAL`.
- **KHÔNG triển khai** ở Sprint này: Discovery Plugin Engine, DOM Discovery, AI Vision, Selenium/Cypress adapters, abstraction tổng quát quá mức.
- Model vẫn **chừa khả năng** bổ sung `sourceType` sau này (thiết kế theo enum mở), nhưng **không code các nguồn chưa dùng**.
- Mapping **không hardcode theo Login**: dùng mô hình tổng quát `actionType`, `target`, `controlType`, `locatorEvidence`, `testDataMapping`, `assertionMapping`.
- Case study: **Login** làm ví dụ đầu tiên; **Thiết bị/CRUD** dùng để kiểm chứng tính tổng quát.

Mục tiêu: **làm đúng và chạy được với Codegen thật trước**; kiến trúc nhiều nguồn sẽ mở rộng sau khi MVP mapping ổn định.

---

## 0. Nguyên tắc tổng thể (bất biến)

1. **`approved-testcases.json` là Single Source of Truth của Test Design.** KHÔNG bao giờ đưa locator/selector/page object/automation mapping ngược vào file này.
2. **AI chỉ hỗ trợ, con người quyết định.** Mọi AI Proposal ở trạng thái `DRAFT`, không có cơ chế auto-approve.
3. **Truy vết nguồn gốc.** Mỗi locator/route/assertion/test data phải biết: lấy từ đâu (`sourceType`), ai đề xuất (`createdBy`), ai duyệt (`reviewedBy`), khi nào (`reviewedAt`).
4. **Readiness chỉ đánh giá trên mapping đã review**, không dùng demo data / AI proposal chưa duyệt / inferred route / inferred assertion.
5. **Generator chỉ đọc Approved Automation Mapping.** Generator không tự suy luận.
6. **Không sửa âm thầm.** Mọi vấn đề (step thiếu target, mâu thuẫn, trùng, thừa...) phải tạo `warning` hoặc `reviewItem`, không tự bỏ qua hay tự sửa.

---

## 1. Artifact (3 file, tách biệt)

| Artifact | File | Trách nhiệm | Không được làm |
|---|---|---|---|
| Evidence | `automation-evidence.json` | Lưu toàn bộ bằng chứng thu thập từ các nguồn, **mỗi nguồn riêng**, có vòng đời DRAFT/APPROVED/REJECTED/EDITED | Không chứa mapping final; không tự approve |
| Draft Mapping | `automation-mapping.draft.json` | Mapping đang xây dựng (đã có evidence APPROVED), kèm `reviewItems`, `conflicts`, `warnings`, `draftReadiness` | Không được đưa cho Generator |
| Approved Mapping | `automation-mapping.approved.json` | Mapping đã tester duyệt, **đầu vào duy nhất của Playwright Generator** | Không chứa data/locator chưa duyệt |

Cả 3 artifact đều là file riêng, theo module hoặc theo testcase (xem mục 12). Không đưa nội dung vào `approved-testcases.json`.

---

## 2. Automation Evidence Model

### 2.1 Trường tối thiểu

```json
{
  "evidenceId": "EV-<tc>-<seq>",
  "evidenceType": "locator",            // route | locator | assertion | testData | action | pageObject | selector
  "sourceType": "AI_PROPOSAL",          // xem danh sách nguồn bên dưới
  "sourceReference": "ref/tới/nguồn",   // ví dụ file codegen, key locator repo, step order
  "screen": "Login",
  "target": "Tài khoản",
  "actionType": "fill",                 // goto | fill | click | select | check | press | wait | verify
  "locator": {
    "strategy": "getByLabel",           // getByLabel | getByTestId | getByRole | getByPlaceholder | getByText | css
    "value": "Tài khoản"
  },
  "value": null,                          // cho testData: giá trị thật; cho assertion: expected text
  "status": "DRAFT",                     // DRAFT | APPROVED | REJECTED | EDITED
  "confidence": 0.0,                     // 0..1 — chỉ tham khảo, không quyết định approved
  "createdBy": "AI",
  "createdAt": "2026-08-03T00:00:00.000Z",
  "reviewedBy": null,
  "reviewedAt": null
}
```

### 2.2 `sourceType` — danh sách nguồn (MVP: 5 loại)

| sourceType | Ý nghĩa | Trạng thái khởi tạo | Được coi là bằng chứng đã duyệt? |
|---|---|---|---|
| `APPROVED_TEST_CASE` | Dữ liệu từ `approved-testcases.json` (metadata, expected text, seed) | APPROVED (chỉ phần test-design) | Chỉ cho **expectation text**, KHÔNG cho locator/route |
| `PLAYWRIGHT_CODEGEN` | **Locator/route/action từ Playwright Codegen thật do tester quay** — nguồn locator chính của MVP | APPROVED (nguồn đáng tin) | Có (locator/route/action) |
| `CONFIRMED_FACT` | Sự thật tester xác nhận trực tiếp (vd route do tester cung cấp) | APPROVED | Có |
| `TESTER_INPUT` | Dữ liệu tester nhập trong review (vd test data thật) | APPROVED (do chính tester cung cấp) | Có |
| `AI_PROPOSAL` | AI đề xuất locator/route/assertion/test data | **DRAFT (bắt buộc)** | KHÔNG |

> **Khả năng mở rộng:** danh sách `sourceType` là enum mở. `LOCATOR_REPOSITORY`, `EXISTING_PAGE_OBJECT`, `DOM_DISCOVERY`, ... có thể được **bổ sung sau** khi MVP ổn định, nhưng **KHÔNG code** chúng ở Sprint này.

**Quy tắc then chốt:** nguồn `AI_PROPOSAL` **luôn** khởi tạo `status: DRAFT`. Không tồn tại con đường tự động chuyển AI proposal sang APPROVED. Chỉ `ReviewService` (do tester chủ động) đổi trạng thái. `PLAYWRIGHT_CODEGEN` và `CONFIRMED_FACT` và `TESTER_INPUT` khởi tạo APPROVED, nhưng vẫn **nên hiển thị qua review** để tester xác nhận lần cuối.

### 2.3 `status` vòng đời evidence

```
DRAFT ──(tester Approve)──▶ APPROVED
  │ ──(tester Reject)──▶ REJECTED
  │ ──(tester Edit + Approve)──▶ EDITED
```

- `APPROVED` / `EDITED` = dùng được trong mapping.
- `REJECTED` = không dùng.
- Evidence **chưa review** = `DRAFT` → tạo `reviewItem` cho tester.

### 2.4 Định dạng input Playwright Codegen (nguồn locator chính)

Tester quay bằng Playwright Codegen và xuất dữ liệu (JSON hoặc code). `codegenSource` đọc/normalize thành evidence locator/route/action. Định dạng input đề xuất:

```json
// playwright-codegen/Login.json (tester cung cấp)
{
  "screen": "Login",
  "url": "/login",
  "controls": [
    { "key": "tai-khoan", "target": "Tài khoản", "controlType": "input",  "locator": { "strategy": "getByLabel", "value": "Tài khoản" } },
    { "key": "mat-khau",  "target": "Mật khẩu",  "controlType": "input",  "locator": { "strategy": "getByLabel", "value": "Mật khẩu" } },
    { "key": "ma-xac-nhan","target": "Mã xác nhận","controlType": "input","locator": { "strategy": "getByPlaceholder", "value": "Mã xác nhận" } },
    { "key": "dang-nhap", "target": "Đăng nhập", "controlType": "button", "locator": { "strategy": "getByRole", "value": "button, name: Đăng nhập" } }
  ],
  "assertions": [
    { "key": "login-success-message", "target": "Đăng nhập thành công", "controlType": "text", "locator": { "strategy": "getByText", "value": "Đăng nhập thành công" } }
  ]
}
```

- `codegenSource` chuyển mỗi mục thành `AutomationEvidence` với `sourceType: "PLAYWRIGHT_CODEGEN"`, `status: "APPROVED"`, `sourceReference: "playwright-codegen/Login.json#controls.0"`.
- Nếu tester chưa quay codegen → Discovery dùng `AI_PROPOSAL` (DRAFT) làm fallback để tester duyệt nhanh hơn, nhưng **không bao giờ READY** bằng AI proposal.
- Cùng `controlType` (input/select/button) được dùng chung cho mọi module (Login, Thiết bị...), không hardcode.

---

## 3. Step Sanitization

Trước khi tạo `stepMappings`, `steps` được **sanitize** theo các quy tắc sau. **Không tự sửa âm thầm** — mỗi vấn đề phát sinh tạo `warning` hoặc `reviewItem`.

| # | Tình huống | Phát hiện | Hành động |
|---|---|---|---|
| 1 | Step thiếu `target` (TC001) | step không có `target` | Tạo `warning`; không map; `reviewItem` "cần tester cung cấp target hoặc từ Discovery" |
| 2 | Action và target mâu thuẫn (TC002 step 5: action="Nhập mã xác nhận", target="Đăng nhập") | action ngụ ý field A, target ngụ ý field B | Tạo `conflict`; **không tự chọn**; `reviewItem` cho tester quyết định |
| 3 | Step trùng | hai step cùng action+target liên tiếp | Giữ 1, cảnh báo; không tự xóa |
| 4 | Step thừa (TC002–004 có step 5 trùng ý "Nhập mã xác nhận" đã có ở step 4) | action/target lặp, hoặc step không thêm giá trị | `warning` + `reviewItem` |
| 5 | Step sai thứ tự | setup/verify lẫn giữa các bước thao tác | `warning`; không tự sắp lại |
| 6 | Step chứa cả action + target trong 1 chuỗi | `action` dài, `target` rỗng (vd "Nhập Tài khoản hợp lệ") | Đề xuất phân tách qua AI (DRAFT) + `reviewItem`; không tự gán |
| 7 | Step không thể automation | setup/verify/precondition, hoặc hành động phi giao diện | Gắn `NOT_AUTOMATABLE`; không map |
| 8 | Step không đủ bằng chứng để mapping | thiếu locator approved | `DRAFT_PROPOSAL` + `reviewItem`; readiness chưa READY |

**Nguyên tắc:** sanitize là lớp **thuần chức năng thuần**, đầu ra là danh sách step chuẩn + `warnings`/`reviewItems`/`conflicts`. Không bao giờ tự gán locator/route để "khớp" step.

---

## 4. Test Data Rules

Schema thật:

```json
{
  "testData": {
    "fields": {
      "Tài khoản": { "value": null, "purpose": "VALID", "requiresTesterInput": true, "instruction": "..." }
    },
    "value": "Tài khoản: admin\nMật khẩu: 123456@Aa",
    "requiresTesterInput": true
  },
  "executionReadiness": "DATA_REQUIRED"
}
```

Quy tắc bắt buộc:

1. **Không đọc `testData.inputs` làm schema chính.** Schema chính là `testData.fields` (object theo tên field). (`inputs` chỉ còn là schema legacy, bỏ qua hoặc chuyển đổi, không ưu tiên.)
2. **`testData.value` KHÔNG phải approved automation data** khi:
   - `testData.requiresTesterInput === true`, hoặc
   - `executionReadiness === "DATA_REQUIRED"`.
   → Trường hợp này, `testData.value` chỉ là **giá trị mẫu hiển thị**, được đưa vào evidence `sourceType: TESTER_INPUT` **chưa duyệt** hoặc bỏ qua, không đánh APPROVED.
3. **Field `purpose: "EMPTY"` được phép biểu diễn giá trị rỗng có chủ đích** → tạo evidence `actionType: fill, value: ""` hợp lệ (rỗng có chủ đích), không phải MISSING_DATA.
4. **Field `value: null` và `requiresTesterInput: true`** → phải trở thành **`MISSING_DATA`**, không được tự điền.
5. **Không tạo demo/default data.** `demoValue`, `literal:MA-xxx`, "Thiết bị demo" bị cấm.
6. **Test data chỉ được APPROVED khi tester xác nhận** (qua Review Approve/Edit, `sourceType: TESTER_INPUT`).

Ánh xạ field → trạng thái data:

| Điều kiện field | Kết quả |
|---|---|
| `purpose: "EMPTY"` (hoặc value="" có chủ đích) | evidence value `""` (hợp lệ) |
| `value` != null và KHÔNG `requiresTesterInput` | evidence value thật (APPROVED_TESt_CASE/CONFIRMED_FACT) |
| `value: null` + `requiresTesterInput: true` | `MISSING_DATA` |
| toàn bộ `executionReadiness: DATA_REQUIRED` | draftReadiness ≤ PARTIAL, không READY |

---

## 5. Assertion Rules

Phân biệt **2 lớp**:

1. **Assertion expectation** — đã được Test Design duyệt (trong `assertions[].expected`, `expectedResults`). → evidence `sourceType: APPROVED_TEST_CASE`, `status: APPROVED` (chỉ phần text).
2. **Assertion implementation** — dành cho automation (locator để verify, kiểu expect, url...). → phải đến từ evidence (codegen/locator repo) **và** được tester duyệt; KHÔNG suy luận từ text.

Ví dụ minh họa sự khác biệt:

```
Expected (đã duyệt):  "Người dùng đăng nhập thành công..."
≠
Assertion locator:    page.getByText("Đăng nhập thành công")   ← phải là evidence + được duyệt
```

Quy tắc:
- `expectedValue` (text) lấy từ approved testcase → `APPROVED` (part của test design).
- `assertionLocator` phải đến từ nguồn ngoài (codegen/locator repo) hoặc AI đề xuất **DRAFT** → cần review. Nếu chưa có → `MISSING_EVIDENCE` cho assertion, readiness không READY.
- Assertion type (`toBeVisible`, `toHaveURL`, ...) không tự suy luận mặc định; nếu AI đề xuất → DRAFT.

---

## 6. Automation Hints = Automation Seed

`automationHints` chỉ là **seed** cho Discovery, KHÔNG phải mapping/evidence đã xác nhận.

Có thể dùng:
- `screen` (vd "Login") → gợi ý group, gắn vào evidence `screen`.
- `operation` (vd "LOGIN") → gợi ý action mẫu, gắn vào evidence `actionType`.
- `missingMetadata` → danh sách những gì thiếu → dùng để **tạo sẵn reviewItems** (route, controls.username, controls.password, controls.submit, assertionLocator).

KHÔNG được:
- Coi `screen`/`operation` là route hoặc locator.
- Coi `controls` (dù có nội dung) là locator đã xác nhận — nếu không có nguồn đáng tin.
- Dùng `missingMetadata` làm evidence.

`missingMetadata` thực tế của Đăng nhập (TC001–TC004):
`routeOrNavigation`, `controls.username`, `controls.password`, `controls.submit`, `assertionLocator` → khớp đúng các khuyết mà spec này yêu cầu chặn READY.

---

## 7. Draft Mapping Model

Mỗi testcase draft phải **giữ nguyên** (traceability):
- `testCaseId`, `title`, `module`, `feature`
- `steps` (bản gốc, không sửa)
- `assertions` (bản gốc)
- `traceability` → `approvedTestcaseRef` (artifact/testcase id)

**Bổ sung** — mô hình **tổng quát** (không hardcode Login): mỗi step dùng `actionType` + `target` + `controlType` + `locatorEvidence` + `testDataMapping` + `assertionMapping`. Tên field do dữ liệu quyết định, không cố định `username/password/submit`.

```json
{
  "artifactId": "AM-DRAFT-TC001",
  "testCaseId": "TC001",
  "title": "...",
  "module": "Đăng nhập",
  "feature": "Đăng nhập",
  "approvedTestcaseRef": "approved-testcases.json#TC001",
  "steps": [],                 // bản gốc
  "assertions": [],            // bản gốc

  "stepMappings": [
    {
      "stepOrder": 1,
      "rawAction": "Nhập tài khoản",
      "target": "Tài khoản",                // target = tên field từ dữ liệu
      "actionType": "fill",                 // goto | fill | click | select | check | press | wait
      "controlType": "input",               // input | select | button | checkbox | textarea | link ...
      "mappingStatus": "DRAFT_PROPOSAL",
      "locatorEvidence": {
        "evidenceId": "EV-TC001-01",
        "locatorKey": "tai-khoan",           // key tổng quát = slug của target, không hardcode
        "status": "DRAFT"
      },
      "testDataMapping": {
        "evidenceId": "EV-TC001-04",
        "status": "MISSING_DATA"
      },
      "warnings": ["step thiếu target"]
    }
  ],
  "expectedResultMappings": [
    {
      "assertionIndex": 0,
      "expected": "Người dùng đăng nhập thành công...",
      "expectedEvidenceId": "EV-TC001-10",
      "assertionType": "toBeVisible",
      "assertionMapping": {
        "evidenceId": "EV-TC001-11",
        "locatorKey": "login-success-message",
        "status": "MISSING_EVIDENCE"
      },
      "mappingStatus": "MISSING_EVIDENCE"
    }
  ],
  "routeMapping": {
    "route": null,
    "evidenceId": null,
    "mappingStatus": "MISSING_EVIDENCE"
  },
  "testDataMappings": {
    "Tài khoản": { "value": null, "status": "MISSING_DATA", "evidenceId": "EV-TC001-04" }
  },

  "evidenceReferences": ["EV-TC001-01", "...", "EV-TC001-11"],
  "missingData": ["Tài khoản", "Mật khẩu", "Mã xác nhận"],
  "conflicts": [
    { "description": "step 5 action 'Nhập mã xác nhận' nhưng target 'Đăng nhập'", "stepOrder": 5 }
  ],
  "warnings": ["TC001 step 1-3 thiếu target"],
  "reviewItems": ["xác nhận route", "xác nhận locator 'Tài khoản'", "cung cấp test data"],
  "draftReadiness": "BLOCKED"
}
```

> **Lưu ý tổng quát:** mọi `locatorKey`, `testDataMappings` đều được **sinh từ `target`/tên field của dữ liệu** (slugify), KHÔNG hardcode `username/password/submit`. Với Thiết bị/CRUD, cùng model này sẽ sinh `locatorKey: "ma-thiet-bi"`, `controlType: "input"`, actionType `fill/click`... mà không cần đổi code.

### 7.1 `mappingStatus` trên từng phần tử

| Giá trị | Ý nghĩa |
|---|---|
| `MAPPED_BY_APPROVED_EVIDENCE` | đã có evidence APPROVED (locator/repo/codegen confirmed) |
| `DRAFT_PROPOSAL` | đang là đề xuất (AI), cần review |
| `MISSING_EVIDENCE` | thiếu bằng chứng, chưa map được |
| `CONFLICTED` | có mâu thuẫn (step/action-target) chưa xử lý |
| `NOT_AUTOMATABLE` | testcase/step không thể automation |

---

## 8. Review Flow

### 8.1 Hành động tester (trên từng phần tử)

| Hành động | Ảnh hưởng evidence | Ảnh hưởng mapping |
|---|---|---|
| **Approve** | status → APPROVED | phần tử → `MAPPED_BY_APPROVED_EVIDENCE` |
| **Reject** | status → REJECTED | phần tử → `MISSING_EVIDENCE`/`CONFLICTED` |
| **Edit** | status → EDITED (value/locator mới) | phần tử dùng giá trị đã sửa |
| **Replace evidence** | chọn evidence khác làm nguồn | phần tử trỏ evidence mới |
| **Mark not automatable** | — | phần tử → `NOT_AUTOMATABLE`, testcase không READY |
| **Request more discovery** | yêu cầu tester quay thêm Playwright Codegen (nguồn discovery duy nhất của MVP) | phần tử giữ `MISSING_EVIDENCE`, chờ discovery |

### 8.2 Mức review

Review được thực hiện ở từng cấp, **không dùng cờ `autoApprove` toàn bộ**:
- **Route** (approve/điền route thật)
- **Từng step** (action, target)
- **Từng locator** (approve/edit locator)
- **Test data** (cung cấp/duyệt từng field)
- **Assertion** (locator + type)

### 8.3 Trạng thái mapping

```
DRAFT → WAITING_FOR_REVIEW → APPROVED
                  │  └──(cần sửa)──▶ NEEDS_REVISION → DRAFT
                  └──(từ chối)────▶ REJECTED
```

Chỉ mapping `APPROVED` mới được xuất `automation-mapping.approved.json` → Generator.

---

## 9. Approved Mapping Model

`automation-mapping.approved.json` chỉ chứa dữ liệu đã tester duyệt.

Mỗi locator, route, test data, assertion implementation phải kèm provenance. `locatorKey` là tổng quát (sinh từ `target`), ví dụ với field "Tài khoản":

```json
{
  "locatorKey": "tai-khoan",
  "target": "Tài khoản",
  "controlType": "input",
  "locator": { "strategy": "getByLabel", "value": "Tài khoản" },
  "evidence": {
    "evidenceId": "EV-TC001-01",
    "sourceType": "PLAYWRIGHT_CODEGEN",
    "reviewDecision": "APPROVE",
    "reviewer": "tester",
    "reviewedAt": "2026-08-03T10:00:00.000Z"
  }
}
```

- Không chứa phần tử `status: DRAFT`/`MISSING_EVIDENCE`/`CONFLICTED`.
- Approved Mapping là **đầu vào duy nhất** của Playwright Generator.

---

## 10. Readiness Rules

### 10.1 READY
Đạt **tất cả**:
- Route/navigation đã approved.
- Các action chính đã approved (fill/click/select/check/press có locator + action).
- Locator chính đã approved.
- Test data bắt buộc đã approved (hoặc field rỗng có chủ đích).
- Assertion implementation đã approved (locator).
- Không còn conflict hoặc blocking review item.
- Testcase không bị mark `NOT_AUTOMATABLE`.

### 10.2 PARTIAL
Khi:
- Đã có một phần mapping approved.
- Còn thiếu **test data** hoặc evidence không thuộc **action chính**.
- Chưa đủ để generate test chạy hoàn chỉnh.

### 10.3 BLOCKED
Khi có bất kỳ:
- Thiếu action chính.
- Thiếu locator chính.
- Step mâu thuẫn chưa xử lý.
- Thiếu navigation bắt buộc.
- Không có cách triển khai assertion chính.
- Testcase được đánh dấu không thể automation.

### 10.4 Cấm
- Không dùng demo data, AI proposal chưa duyệt, inferred route, inferred assertion để nâng readiness.
- `draftReadiness` có thể là `DRAFT_PROPOSAL`-based nhưng **không bao giờ READY** khi chưa review; sau review mới tính lại theo quy tắc trên.

---

## 11. Case Study

### 11.0 Phạm vi case study
- **Login (TC001–TC004)**: case study đầu tiên — minh họa step thiếu target (TC001) và step mâu thuẫn (TC002–TC004).
- **Thiết bị/CRUD**: case kiểm chứng tính tổng quát — cùng model, cùng code, khác dữ liệu (field "Mã thiết bị", nút "Lưu"...), không hardcode Login.

### 11.1 Draft mapping TC001 (login thành công)
- **steps**: 4 step, tất cả **thiếu target** → mỗi step `warning` "thiếu target", `mappingStatus: DRAFT_PROPOSAL`.
- **route**: `automationHints.route=""` → `routeMapping.mappingStatus: MISSING_EVIDENCE`; `reviewItem` route.
- **testData**: `fields.Tài khoản/Mật khẩu/Mã xác nhận` đều `requiresTesterInput:true`, `executionReadiness: DATA_REQUIRED` → **MISSING_DATA** cho cả 3; `testData.value` chỉ là mẫu, không APPROVED.
- **assertion**: expected "Người dùng đăng nhập thành công..." = APPROVED (text); **assertion locator MISSING** → assertion `mappingStatus: MISSING_EVIDENCE`.
- **draftReadiness: BLOCKED** (thiếu route, locator, test data, assertion locator).

### 11.2 Draft mapping TC002 (bỏ trống Tài khoản) — minh họa step mâu thuẫn
- Step 5: `action="Nhập mã xác nhận"`, `target="Đăng nhập"` → **CONFLICTED** (action ngụ ý captcha, target ngụ ý nút submit).
- Step 2 "Chọn Đăng nhập" + step 5 "Nhập mã xác nhận"/target Đăng nhập → `reviewItem` yêu cầu tester xác định target thật.
- `testData.fields["Tài khoản"].value=""`, `purpose:"EMPTY"` → rỗng **có chủ đích** (hợp lệ, không MISSING_DATA cho Tài khoản); Mật khẩu & Mã xác nhận `requiresTesterInput:true` → **MISSING_DATA**.
- **draftReadiness: BLOCKED** (mâu thuẫn chưa xử lý + thiếu locator/assertion locator).

### 11.3 Cách biểu diễn `MISSING_DATA` (dùng tên field thật, tổng quát)
```json
"testDataMappings": {
  "Tài khoản": { "value": null, "status": "MISSING_DATA", "evidenceId": null },
  "Mật khẩu": { "value": null, "status": "MISSING_DATA", "evidenceId": null },
  "Mã xác nhận": { "value": null, "status": "MISSING_DATA", "evidenceId": null }
}
```
+ `"missingData": ["Tài khoản", "Mật khẩu", "Mã xác nhận"]` + `reviewItem`.

### 11.4 Cách biểu diễn AI-proposed locator chưa duyệt
```json
{
  "locatorKey": "tai-khoan",
  "target": "Tài khoản",
  "controlType": "input",
  "actionType": "fill",
  "mappingStatus": "DRAFT_PROPOSAL",
  "locatorEvidence": {
    "evidenceId": "EV-TC001-01",
    "status": "DRAFT",
    "sourceType": "AI_PROPOSAL"
  },
  "reviewItem": "cần tester duyệt locator 'Tài khoản' (hoặc thay bằng locator từ Playwright Codegen)"
}
```
Không tính vào READY. Khi tester **Approve** locator từ `PLAYWRIGHT_CODEGEN`, `locatorEvidence.status` → `APPROVED` và `mappingStatus` → `MAPPED_BY_APPROVED_EVIDENCE`.

### 11.5 Kết quả sau khi tester Approve/Edit/Reject (TC001)
- Tester **Edit** route: `""` → `"/login"` (evidence route status EDITED).
- Tester **Approve** locator: username, password, captcha, submit button (codegen/repo hoặc AI đã duyệt) → status APPROVED.
- Tester **Edit** test data: nhập `username="admin"`, `password="123456@Aa"`, `captcha="123456"` → status EDITED, hết MISSING_DATA.
- Tester **Approve** assertion locator `loginSuccessMessage` → status APPROVED.
- Hết conflict/warning blocking → **READY**.

### 11.6 Approved mapping mẫu (TC001) — mô hình tổng quát, locator lấy từ Codegen
```json
{
  "artifactId": "AM-APPROVED-TC001",
  "testCaseId": "TC001",
  "state": "APPROVED",
  "readiness": "READY",
  "routeMapping": {
    "route": "/login",
    "evidence": { "evidenceId": "EV-TC001-ROUTE", "sourceType": "CONFIRMED_FACT", "reviewDecision": "APPROVE", "reviewer": "tester", "reviewedAt": "..." }
  },
  "stepMappings": [
    {
      "stepOrder": 1, "actionType": "fill", "target": "Tài khoản", "controlType": "input",
      "locatorKey": "tai-khoan", "valueRef": "testData.Tài khoản",
      "locatorEvidence": { "evidenceId": "EV-TC001-01", "sourceType": "PLAYWRIGHT_CODEGEN", "reviewDecision": "APPROVE", "reviewer": "tester", "reviewedAt": "..." }
    },
    {
      "stepOrder": 2, "actionType": "fill", "target": "Mật khẩu", "controlType": "input",
      "locatorKey": "mat-khau", "valueRef": "testData.Mật khẩu",
      "locatorEvidence": { "evidenceId": "EV-TC001-02", "sourceType": "PLAYWRIGHT_CODEGEN", "reviewDecision": "APPROVE", "reviewer": "tester", "reviewedAt": "..." }
    },
    {
      "stepOrder": 3, "actionType": "fill", "target": "Mã xác nhận", "controlType": "input",
      "locatorKey": "ma-xac-nhan", "valueRef": "testData.Mã xác nhận",
      "locatorEvidence": { "evidenceId": "EV-TC001-03", "sourceType": "PLAYWRIGHT_CODEGEN", "reviewDecision": "APPROVE", "reviewer": "tester", "reviewedAt": "..." }
    },
    {
      "stepOrder": 4, "actionType": "click", "target": "Đăng nhập", "controlType": "button",
      "locatorKey": "dang-nhap",
      "locatorEvidence": { "evidenceId": "EV-TC001-04", "sourceType": "PLAYWRIGHT_CODEGEN", "reviewDecision": "APPROVE", "reviewer": "tester", "reviewedAt": "..." }
    }
  ],
  "testDataMappings": {
    "Tài khoản": { "value": "admin", "status": "APPROVED", "evidence": { "evidenceId": "EV-TC001-D1", "sourceType": "TESTER_INPUT", "reviewDecision": "EDIT", "reviewer": "tester", "reviewedAt": "..." } },
    "Mật khẩu": { "value": "123456@Aa", "status": "APPROVED", "evidence": { "evidenceId": "EV-TC001-D2", "sourceType": "TESTER_INPUT", "reviewDecision": "EDIT", "reviewer": "tester", "reviewedAt": "..." } },
    "Mã xác nhận": { "value": "123456", "status": "APPROVED", "evidence": { "evidenceId": "EV-TC001-D3", "sourceType": "TESTER_INPUT", "reviewDecision": "EDIT", "reviewer": "tester", "reviewedAt": "..." } }
  },
  "expectedResultMappings": [
    {
      "expected": "Người dùng đăng nhập thành công...",
      "assertionType": "toBeVisible",
      "assertionMapping": {
        "locatorKey": "login-success-message",
        "evidence": { "evidenceId": "EV-TC001-11", "sourceType": "PLAYWRIGHT_CODEGEN", "reviewDecision": "APPROVE", "reviewer": "tester", "reviewedAt": "..." }
      }
    }
  ],
  "evidenceReferences": ["EV-TC001-01","EV-TC001-02","EV-TC001-03","EV-TC001-04","EV-TC001-11","EV-TC001-D1"],
  "conflicts": [], "warnings": [], "reviewItems": []
}
```
> **Lưu ý:** mô hình này hoàn toàn tổng quát. Với Thiết bị/CRUD, `target:"Mã thiết bị"` → `locatorKey:"ma-thiet-bi"`, `actionType:"fill"`, `controlType:"input"`; với nút lưu → `actionType:"click"`, `controlType:"button"`, `locatorKey:"luu"` — **không cần đổi code**, chỉ khác dữ liệu.

### 11.7 Readiness trước/sau review

| Testcase | Trước review (draft) | Sau review đầy đủ |
|---|---|---|
| TC001 | BLOCKED | READY |
| TC002 | BLOCKED (mâu thuẫn step 5 + thiếu evidence) | READY nếu tester xử lý conflict + điền data; còn conflict → BLOCKED |
| TC003 | BLOCKED | như TC002 |
| TC004 | BLOCKED | như TC002 |

### 11.8 Case Thiết bị/CRUD — kiểm chứng tính tổng quát
Áp **cùng model** (không đổi code), với dữ liệu khác:

```
TC thiết bị "Thêm thiết bị" (CREATE)
  step 1: Mở màn hình ...      -> actionType: goto, route từ codegen/confirmed
  step 2: Nhập Mã thiết bị     -> actionType: fill, target:"Mã thiết bị", controlType:input,
                                  locatorKey:"ma-thiet-bi", locatorEvidence từ Codegen
  step 3: Nhập Tên thiết bị    -> actionType: fill, target:"Tên thiết bị", controlType:input,
                                  locatorKey:"ten-thiet-bi"
  step 4: Chọn Loại thiết bị   -> actionType: select, target:"Loại thiết bị", controlType:select,
                                  locatorKey:"loai-thiet-bi"
  step 5: Lưu dữ liệu          -> actionType: click, target:"Lưu", controlType:button,
                                  locatorKey:"luu"
  assertion: "Thiết bị được tạo thành công." -> assertionType:toBeVisible,
                                  assertionMapping.locatorKey:"success-message" (từ Codegen)
```

→ **Điểm giống nhau hoàn toàn với Login:** tất cả đều qua `actionType`/`target`/`controlType`/`locatorEvidence`/`testDataMapping`/`assertionMapping`. Không có bất kỳ chuỗi cứng nào dành riêng cho Login. `controlType` và `locatorKey` được suy ra từ `target` + loại control trong codegen, không từ module.

---

## 12. JSON Schema đề xuất (3 artifact)

### 12.1 `automation-evidence.json`
```jsonc
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "automation-evidence",
  "type": "object",
  "required": ["module", "testCases"],
  "properties": {
    "module": { "type": "string" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "testCases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["testCaseId", "evidence"],
        "properties": {
          "testCaseId": { "type": "string" },
          "evidence": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "evidenceId","evidenceType","sourceType","screen","target",
                "actionType","locator","value","status","createdBy","createdAt",
                "reviewedBy","reviewedAt"
              ],
              "properties": {
                "evidenceId": { "type": "string" },
                "evidenceType": { "enum": ["route","locator","assertion","testData","action","pageObject","selector"] },
                "sourceType": { "enum": ["APPROVED_TEST_CASE","PLAYWRIGHT_CODEGEN","CONFIRMED_FACT","TESTER_INPUT","AI_PROPOSAL"] },
                "sourceReference": { "type": ["string","null"] },
                "screen": { "type": "string" },
                "target": { "type": ["string","null"] },
                "actionType": { "enum": ["goto","fill","click","select","check","press","wait","verify","","null"] },
                "locator": { "type": ["object","null"], "properties": { "strategy": { "type":"string" }, "value": { "type":"string" } } },
                "value": { "type": ["string","null"] },
                "status": { "enum": ["DRAFT","APPROVED","REJECTED","EDITED"] },
                "confidence": { "type": "number" },
                "createdBy": { "type": "string" },
                "createdAt": { "type": "string", "format": "date-time" },
                "reviewedBy": { "type": ["string","null"] },
                "reviewedAt": { "type": ["string","null"] }
              }
            }
          }
        }
      }
    }
  }
}
```

### 12.2 `automation-mapping.draft.json`
```jsonc
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "automation-mapping.draft",
  "type": "object",
  "required": ["module", "testCases"],
  "properties": {
    "module": { "type": "string" },
    "testCases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["artifactId","testCaseId","steps","assertions","stepMappings","expectedResultMappings","routeMapping","testDataMappings","evidenceReferences","missingData","conflicts","warnings","reviewItems","draftReadiness"],
        "properties": {
          "artifactId": { "type": "string" },
          "testCaseId": { "type": "string" },
          "title": { "type": "string" },
          "module": { "type": "string" },
          "feature": { "type": "string" },
          "approvedTestcaseRef": { "type": "string" },
          "state": { "enum": ["DRAFT","WAITING_FOR_REVIEW","APPROVED","REJECTED","NEEDS_REVISION"] },
          "stepMappings": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["stepOrder","actionType","mappingStatus"],
              "properties": {
                "stepOrder": { "type": "integer" },
                "rawAction": { "type": "string" },
                "target": { "type": ["string","null"] },
                "actionType": { "type": ["string","null"] },
                "controlType": { "enum": ["input","select","button","checkbox","textarea","link","","null"] },
                "mappingStatus": { "enum": ["MAPPED_BY_APPROVED_EVIDENCE","DRAFT_PROPOSAL","MISSING_EVIDENCE","CONFLICTED","NOT_AUTOMATABLE"] },
                "locatorKey": { "type": ["string","null"] },
                "locatorEvidence": {
                  "type": ["object","null"],
                  "properties": {
                    "evidenceId": { "type": "string" },
                    "status": { "enum": ["DRAFT","APPROVED","REJECTED","EDITED"] }
                  }
                },
                "valueRef": { "type": ["string","null"] },
                "testDataMapping": {
                  "type": ["object","null"],
                  "properties": {
                    "evidenceId": { "type": "string" },
                    "status": { "enum": ["DRAFT","APPROVED","REJECTED","EDITED","MISSING_DATA"] }
                  }
                },
                "warnings": { "type": "array", "items": { "type": "string" } }
              }
            }
          },
          "expectedResultMappings": { "type": "array" },
          "routeMapping": { "type": "object" },
          "testDataMappings": { "type": "object" },
          "evidenceReferences": { "type": "array", "items": { "type": "string" } },
          "missingData": { "type": "array", "items": { "type": "string" } },
          "conflicts": { "type": "array" },
          "warnings": { "type": "array", "items": { "type": "string" } },
          "reviewItems": { "type": "array", "items": { "type": "string" } },
          "draftReadiness": { "enum": ["READY","PARTIAL","BLOCKED"] }
        }
      }
    }
  }
}
```

### 12.3 `automation-mapping.approved.json`
```jsonc
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "automation-mapping.approved",
  "type": "object",
  "required": ["module", "testCases"],
  "properties": {
    "module": { "type": "string" },
    "testCases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["artifactId","testCaseId","state","readiness","routeMapping","stepMappings","expectedResultMappings","testDataMappings","evidenceReferences"],
        "properties": {
          "state": { "const": "APPROVED" },
          "readiness": { "enum": ["READY","PARTIAL","BLOCKED"] },
          "routeMapping": {
            "type": "object",
            "properties": {
              "route": { "type": "string" },
              "evidence": { "$ref": "#/$defs/provenance" }
            }
          },
          "stepMappings": { "type": "array", "items": { "type": "object" } },
          "expectedResultMappings": { "type": "array", "items": { "type": "object" } },
          "testDataMappings": { "type": "object" },
          "evidenceReferences": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  },
  "$defs": {
    "provenance": {
      "type": "object",
      "required": ["evidenceId","sourceType","reviewDecision","reviewer","reviewedAt"],
      "properties": {
        "evidenceId": { "type": "string" },
        "sourceType": { "type": "string" },
        "reviewDecision": { "enum": ["APPROVE","REJECT","EDIT"] },
        "reviewer": { "type": "string" },
        "reviewedAt": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

> **Bất biến:** Approved mapping KHÔNG được chứa phần tử có `status: DRAFT` / `MISSING_EVIDENCE` / `CONFLICTED`.

---

## 13. State Transition Diagram (text)

### Evidence
```
             (tester)                          (tester)
DRAFT ──────────────▶ APPROVED ───────────────▶ EDITED
  │  ◀───────────────────│ (edit sau approve)
  │
  └──(tester Reject)──▶ REJECTED
```
- `APPROVED`/`EDITED` = dùng được. `REJECTED` = không dùng. `DRAFT` = chưa dùng.

### Mapping
```
      build-from-approved-evidence
              │
              ▼
          DRAFT ──────────────▶ WAITING_FOR_REVIEW
              │                        │
              │                        ├──(approve hết)──▶ APPROVED ──▶ (xuất approved.json ──▶ Generator)
              │                        ├──(cần sửa)──▶ NEEDS_REVISION ──▶ DRAFT
              │                        └──(từ chối)──▶ REJECTED
              ◀────── (review mới / thay evidence) ──────┘
```

### Readiness (tính lại SAU review)
```
BLOCKED ──(đủ route+action+locator+data+assertion)──▶ READY
   │                                                        ▲
   │ (thiếu data không thuộc action chính)                  │
   └─────────────────────────────────────────────▶ PARTIAL ──┘
   (thiếu action/locator chính, conflict, no assertion impl) → giữ BLOCKED
```

---

## 14. Luồng Discovery → Draft → Review → Approved

```
approved-testcases.json (chỉ đọc)
   │
   ▼
[1] AUTOMATION DISCOVERY
   │   · đọc steps, testData (fields/value/requiresTesterInput),
   │     assertions, automationHints (SEED)
   │   · ghép nguồn (MVP): Playwright Codegen (locator chính) / Confirmed Facts / AI proposal (DRAFT)
   │   · AI proposal = DRAFT
   ▼
automation-evidence.json (evidence theo nguồn, riêng biệt)
   │
   ▼
[2] STEP SANITIZATION  ──▶ warnings / conflicts / reviewItems
   │
   ▼
[3] BUILD DRAFT MAPPING (chỉ từ evidence APPROVED)
   │   · stepMappings / routeMapping / expectedResultMappings / testDataMappings
   │   · missingData / conflicts / warnings / reviewItems / draftReadiness
   ▼
automation-mapping.draft.json
   │
   ▼
[4] AUTOMATION REVIEW (per route / step / locator / test data / assertion)
   │   · Approve / Reject / Edit / Replace / Not automatable / Request more discovery
   ▼
[5] BUILD APPROVED MAPPING (mọi phần tử có provenance)
   │   · tính readiness READY / PARTIAL / BLOCKED
   ▼
automation-mapping.approved.json
   │
   ▼  (Sprint sau)
Playwright Generator ──▶ Execution ──▶ Execution Report
```

---

## 15. Danh sách file hiện tại: giữ / sửa / loại bỏ / bổ sung

### Giữ nguyên (tương thích, không đụng)
- `src/automation/PlaywrightGenerator.js` — chỉ đọc Approved Mapping; không mở rộng trong sprint này.
- `src/automation/PlaywrightRunner.js`, `ExecutionResult.js`, `ExecutionReport.js`, `cli.js` — Runner/CLI cũ, giữ để tương thích, không đổi hành vi.

### Sửa (điều chỉnh cho đúng spec v2 MVP)
- `src/automation/evidence/AutomationEvidence.js` — bổ sung `evidenceType`, `sourceReference`, `screen`, `target`, `actionType`, `confidence`, `reviewedBy/reviewedAt`; gắn đúng 5 `sourceType`.
- `src/automation/evidence/EvidenceSource.js` — đổi enum sang `APPROVED_TEST_CASE`, `PLAYWRIGHT_CODEGEN`, `CONFIRMED_FACT`, `TESTER_INPUT`, `AI_PROPOSAL` (thiết kế enum mở để thêm sau).
- `src/automation/discovery/DiscoveryService.js` — **sửa testData**: đọc `testData.fields` (không `inputs`); tôn trọng `requiresTesterInput` + `executionReadiness`; KHÔNG auto-approve `testData.value`; xử lý `purpose:EMPTY`; KHÔNG tạo demo data. Nguồn locator chính = `PLAYWRIGHT_CODEGEN`; AI proposal (fallback) = DRAFT. Thêm bước `StepSanitizer`.
- `src/automation/mapping/MappingBuilder.js` — thêm `stepMappings` (với `controlType`, `locatorEvidence`, `testDataMapping`), `expectedResultMappings`, `routeMapping`, `testDataMappings`, `conflicts`, `reviewItems`, `missingData`, `draftReadiness`; mô hình tổng quát (không hardcode Login).
- `src/automation/mapping/ReadinessEvaluator.js` — đọc `executionReadiness`; BLOCKED nếu `NOT_AUTOMATABLE`/conflict/thiếu action/locator/assertion impl; PARTIAL nếu chỉ thiếu data; không nâng bằng demo/inferred.
- `src/automation/review/ReviewService.js` + `AutomationReview.js` — thêm Reject/Edit/Replace/Mark not automatable/Request more discovery ở mức route/step/locator/data/assertion; **bỏ `autoApprove`**.
- `src/automation/ReviewWorkflow.js` — nối Step Sanitizer + 2 giai đoạn (draft/approved); không cho phép approve cờ toàn bộ.
- `src/automation/cli-mapping.js` — xuất 3 artifact tách biệt; bỏ các hành vi auto-approve.

### Loại bỏ / thay thế
- `src/automation/AutomationMappingArtifact.js` — schema cũ, thay bằng `mapping/AutomationMapping.js` + `ApprovedAutomationMapping.js` (v2).
- `src/automation/AutomationMappingGenerator.js` — logic `autoApprove`/`demoValue`/`softenBlockers`/`resolveRoute` suy luận bị loại bỏ; chức năng được thay bằng Discovery + MappingBuilder v2.
- `src/automation/AutomationReadinessValidator.js` — logic lenient thay bằng `ReadinessEvaluator` v2.
- `src/automation/LocatorReference.js` / `LocatorReferenceStore.js` — **không còn cần** trong MVP (nguồn locator là Codegen, không phải Locator Repository); tạm ngừng dùng, giữ nguyên không xóa để tránh phá Generator/Runner.

### Bổ sung (mới) — tối thiểu theo MVP
- `src/automation/step/StepSanitizer.js` — sanitize steps → warnings/conflicts/reviewItems.
- `src/automation/sources/codegenSource.js` — đọc/normalize dữ liệu Playwright Codegen do tester quay (locator/route/action). Nguồn locator chính.
- `src/automation/sources/aiProposalSource.js` — AI đề xuất locator fallback (luôn DRAFT). (Chỉ 1 fallback đơn giản, không phải plugin engine.)
- `src/automation/evidence/evidence-store.js` — đọc/ghi `automation-evidence.json`.
- `src/automation/mapping/draft-store.js` + `approved-store.js` — đọc/ghi 2 artifact.
- `tests/automation-mapping-v2-test.js` — test theo spec v2 (Login TC001–TC004 + Thiết bị/CRUD để kiểm chứng tổng quát).
- `docs/mapping-layer-v2-spec.md` (tài liệu này).

> **Không bổ sung:** Discovery Plugin Engine, DOM Discovery, AI Vision, Selenium/Cypress adapters, abstraction đa-nguồn phức tạp. Chỉ 2 nguồn cụ thể cho MVP (Codegen + AI fallback) + Confirmed Facts/Tester Input qua input trực tiếp.

---

## 16. Kế hoạch triển khai code theo các bước nhỏ (MVP)

> Sau khi bạn duyệt spec này mới bắt đầu. Mỗi bước có test riêng, không làm Sprint tiếp theo.
> Định hướng: **đơn giản trước, mở rộng sau**. Chỉ 3 nguồn MVP: approved-testcases.json, Playwright Codegen, Confirmed Facts (AI proposal làm fallback DRAFT).

- **B16.1** Định nghĩa `EvidenceSource` (5 nguồn, enum mở) + `EvidenceState` + `AutomationEvidence` v2 (đủ field + provenance). Test: mỗi AI proposal = DRAFT; Codegen/Confirmed/Tester = APPROVED.
- **B16.2** Viết `StepSanitizer` (thiếu target, mâu thuẫn, trùng, thừa, sai thứ tự, action+target 1 chuỗi, not automatable, thiếu bằng chứng). Test: Login TC001–TC004 + Thiết bị/CRUD tạo đúng warnings/conflicts.
- **B16.3** Viết `codegenSource` (đọc/normalize Playwright Codegen do tester quay → evidence locator/route/action, `sourceType: PLAYWRIGHT_CODEGEN`, APPROVED) + `aiProposalSource` (fallback, DRAFT). Test: codegen có locator → tạo evidence locator APPROVED.
- **B16.4** Sửa `DiscoveryService`: đọc `testData.fields`, tôn trọng `requiresTesterInput`/`executionReadiness`, `purpose:EMPTY`, KHÔNG demo data, KHÔNG auto-approve `testData.value`; ưu tiên codegen, fallback AI DRAFT. Test: Login TC001 → 3 field MISSING_DATA.
- **B16.5** Viết `MappingBuilder` v2 (mô hình tổng quát `actionType`/`target`/`controlType`/`locatorEvidence`/`testDataMapping`/`assertionMapping`) → `automation-mapping.draft.json`. Test: draft TC001 = BLOCKED.
- **B16.6** Nâng cấp `ReviewService`/`AutomationReview` (Approve/Reject/Edit/Replace/Not automatable/Request more discovery, theo mức route/step/locator/data/assertion, bỏ autoApprove). Test: sau review TC001 → READY.
- **B16.7** Viết `ReadinessEvaluator` v2 (đọc `executionReadiness`, NOT_AUTOMATABLE, conflict; PARTIAL khi chỉ thiếu data). Test: TC002 conflict → BLOCKED đến khi xử lý; Thiết bị/CRUD vận hành cùng quy tắc.
- **B16.8** Viết `approved-store` → `automation-mapping.approved.json` (mọi phần tử có provenance). Test: không chứa DRAFT/MISSING/CONFLICTED.
- **B16.9** `ReviewWorkflow` + `cli-mapping.js` v2 + evidence/draft/approved store. Test end-to-end Login TC001–TC004 **và Thiết bị/CRUD** (kiểm chứng tổng quát, không hardcode).
- **B16.10** Chạy toàn bộ test cũ (Generator/Runner không đổi) + test v2 để đảm bảo không phá vỡ. DỪNG.

---

## 17. Tiêu chí hoàn thành (Definition of Done)

- `approved-testcases.json` không bị sửa/không nhận locator/mapping.
- **Playwright Codegen là nguồn locator chính của MVP**; locator từ codegen → evidence `PLAYWRIGHT_CODEGEN` (APPROVED, kèm `sourceReference`).
- Evidence có đủ provenance và nguồn riêng biệt; AI proposal luôn DRAFT.
- Chỉ 5 `sourceType` MVP; không code plugin/DOM/Vision/Selenium/Cypress/abstraction thừa.
- Mapping tổng quát (`actionType`/`target`/`controlType`/`locatorEvidence`/`testDataMapping`/`assertionMapping`), **không hardcode Login**; chạy được cả Login và Thiết bị/CRUD.
- Draft mapping giữ nguyên steps/assertions + bổ sung các trường quy định; mọi phần tử có `mappingStatus`.
- Review hỗ trợ đủ 6 hành động ở đúng mức; không còn cờ `autoApprove`.
- Approved mapping chỉ chứa dữ liệu đã duyệt, có evidence source + review decision + reviewer + timestamp.
- Readiness READY/PARTIAL/BLOCKED đúng quy tắc, không dùng demo/inferred/AI-unapproved.
- Generator/Runner không đổi hành vi.
- Dừng sau B16.10, không làm Sprint tiếp theo.
