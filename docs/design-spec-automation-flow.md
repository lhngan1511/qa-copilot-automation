# Design Spec — Kiến trúc Automation Intelligence (Vision + MVP)

Trạng thái: **CHỈ thiết kế, chưa code. Không sửa UI, Mapping, Generator hoặc Runner. Không commit, không push.**

Tài liệu chia 2 lớp:
- **Part A — Vision Architecture**: mô hình dài hạn (định hướng, CHƯA TRIỂN KHAI trong sprint hiện tại).
- **Part B — MVP Implementation Scope**: phạm vi triển khai để các testcase chạy độc lập.

---

# PART A — VISION ARCHITECTURE

> **VISION — CHƯA TRIỂN KHAI TRONG SPRINT HIỆN TẠI.** Phần này chỉ là định hướng kiến trúc dài hạn, không phải cam kết code ngay.
>
> **⚠️ Quan trọng — ranh giới phạm vi:** **Part A chỉ mô tả kiến trúc dài hạn (Vision). Không thành phần nào trong Part A là yêu cầu bắt buộc của MVP, trừ khi được tham chiếu rõ trong Part B.** Nói cách khác: Pattern Discovery, Self Healing, DOM Discovery, AI Vision, UI Discovery, Screen Repository... **chỉ được triển khai nếu Part B trích dẫn cụ thể**; nếu chỉ có trong Part A thì mặc định **KHÔNG** nằm trong Sprint MVP.

## A.1 Mô hình tổng quát (pipeline dài hạn)

```
Environment
   ↓
Authentication
   ↓
Navigation
   ↓
Screen
   ↓
Reusable Flow
   ↓
Business Flow
   ↓
Assertion
   ↓
Cleanup
```

## A.2 CodeGen = UI Behavior Recording

- **CodeGen KHÔNG được coi là Source Code / framework.** CodeGen là **bản ghi hành vi người dùng trên giao diện** (click Menu → click Grid → click Detail → click Save).
- AI học từ **hành vi người dùng**, không học từ cú pháp framework.
- Playwright (hoặc Selenium...) chỉ là **công cụ thực thi** (execution engine), không phải nền tảng thiết kế.

## A.3 Pattern Discovery

- AI **phát hiện pattern dùng chung** từ CodeGen behavior, ví dụ: `Open Dialog`, `Close Dialog`, `Search Grid`, `Save`, `Delete`, `Confirm`, `Upload File`.
- Pattern là **đơn vị dùng chung** giữa nhiều testcase, không hardcode theo module.
- **VISION**: AI tự phát hiện. MVP: chưa có (xem Part B).

## A.4 UI Discovery

- AI **hiểu loại UI control**: Grid, Dialog, Tree, Upload, Popup, Tab, Accordion, Form...
- Là nền tảng cho DOM Discovery / AI Vision sau này.
- **VISION**: có. MVP: chưa.

## A.5 Screen model

- `Screen` là trạng thái màn hình (Device List, Device Form, User List, Permission Form, Dashboard, Equipment Detail...).
- Screen là nền tảng cho: **Page Object**, **DOM Discovery**, **AI Vision**, **Self Healing** trong tương lai.
- **VISION**: Screen Repository/Discovery. MVP: chỉ là metadata đơn giản.

### A.5.1 Screen là Business Object, không phải execution object

- **`Screen = Business Screen`** — mô tả thực thể/màn hình nghiệp vụ (`UnitOfMeasure`, `Device`, `User`, `Equipment`...) và **metadata nghiệp vụ**.
- **`Screen KHÔNG chứa`:**
  - `locator`;
  - `selector`;
  - Playwright API;
  - Selenium API;
  - Cypress API.
- Lý do: tách ý định nghiệp vụ khỏi cú pháp thực thi, để sau này **thay execution engine (Playwright ↔ Selenium...) mà không đổi model**.

> **VISION:** Screen Repository/Discovery. **MVP:** `screen` chỉ là metadata đơn giản trên testcase (không chứa locator/API), không có Screen Repository.

## A.6 Khả năng thay execution engine trong tương lai

- Vì thiết kế quanh **hành vi nghiệp vụ** (không phải locator/API Playwright), sau này có thể:
  - đổi Playwright → Selenium / WebDriverIO;
  - bổ sung AI Vision;
  - thêm DOM Discovery;
  - hỗ trợ màn hình điều hướng nhiều tầng **mà không thay đổi mô hình dữ liệu nghiệp vụ**.
- Ý định nghiệp vụ (intent) tách khỏi cú pháp thực thi (locator/selector).

---

# PART B — MVP IMPLEMENTATION SCOPE

> Phạm vi triển khai để các testcase như **Thêm/Sửa/Xóa Thiết bị** chạy độc lập, không phụ thuộc thứ tự.

## B.1 Nguyên tắc bất biến (giữ nguyên, đã đúng)

1. **Shared setup có phạm vi module/function rõ** (không global mơ hồ).
2. **Mỗi testcase chạy độc lập**, không phụ thuộc thứ tự.
3. **`storageState` chỉ giải quyết authentication**; navigation chạy riêng.
4. **Gemini chỉ đề xuất phân đoạn CodeGen** — tester review/approve.
5. **Mọi đoạn setup/navigation/business/assertion có `sourceReference`** về CodeGen gốc.
6. **Data setup Sửa/Xóa không phụ thuộc testcase Thêm đã chạy.**
7. **Output là JavaScript ESM**, không TypeScript/CommonJS.
8. **Có trạng thái `NEED_USER_CONFIRMATION`/`BLOCKED`** khi thiếu evidence.
9. Sử dụng **`beforeEach`/helper** khi phù hợp.

## B.2 MVP scope — triển khai tối thiểu

MVP triển khai các thành phần cần để testcase chạy độc lập:

| Thành phần | MVP triển khai |
|---|---|
| **Environment reference** | Tối thiểu: `baseUrl` (BASE_URL), `browser channel`, `headless`, `slowMo` — đọc từ env. Chưa có Environment Repository. |
| **Authentication setup** | Có: `storageState` hoặc `auth helper` login qua `beforeEach`. |
| **Navigation chain nhiều tầng** | Có: `navigationChain` dùng chung (vd chọn phân hệ → chọn danh mục), gọi trong `beforeEach`. |
| **Data setup** | Có: `CREATE_BEFORE` / fixture, độc lập cho từng testcase. |
| **Business steps** | Có: `stepMappings` của từng testcase. |
| **Assertion mappings** | Có. |
| **Cleanup** | Tối thiểu: xoá dữ liệu đã tạo (nếu bật), đóng session. |
| **sourceReference** | Có cho mọi đoạn setup/navigation/business/assertion. |
| **NEED_USER_CONFIRMATION / BLOCKED** | Có. |
| **JavaScript ESM** | Có. |
| **beforeEach / helper** | Có khi phù hợp. |

## B.3 Quy định MVP (giới hạn)

1. **Screen trong MVP chỉ là metadata đơn giản** (gắn nhãn `screen: "Device List"` trên testcase) — **chưa xây Screen Repository**.
2. **Reusable Flow MVP chỉ hỗ trợ flow được tester xác nhận**, ví dụ:
   - `login`;
   - `open-device-catalog`;
   - `search-device`.

   **Quy tắc mạnh (đúng nguyên tắc AI chỉ đề xuất, người quyết định):**
   - **AI chỉ được đề xuất Reusable Flow** (dưới dạng DRAFT).
   - **Reusable Flow chỉ được tạo (chính thức) sau khi Tester xác nhận.**
   - **Không tự động thay thế Business Flow hiện có** — Reusable Flow là đề xuất, không tự merge/ghi đè dữ liệu đã phê duyệt.
   - Không tự phát hiện / tự approve.
3. **Chưa triển khai Pattern Discovery tự động.**
4. **Chưa triển khai** UI Discovery, DOM Discovery, AI Vision, Page Object Generator, Self Healing.
5. **Mỗi testcase chạy độc lập** — tự cung cấp auth + navigation + data trong `beforeEach`, không `describe.serial`.
6. **`storageState` chỉ giải quyết authentication.**
7. **`navigationChain` vẫn chạy riêng** cho từng testcase (qua `beforeEach`).
8. **Sửa/Xóa không phụ thuộc testcase Thêm chạy trước** — tự `CREATE_BEFORE` instance riêng (vd `DEV-<timestamp>`).
9. **CodeGen source có `sourceReference`** cho setup/navigation/business/assertion.
10. **Không sửa code, UI, Mapper, Generator hoặc Runner** trong tài liệu này.

## B.4 JSON mapping tổng quát (MVP)

```json
{
  "module": "<tên module>",
  "function": "<tên function>",
  "environment": {
    "ref": "QA",                       // Environment reference tối thiểu
    "baseUrlEnv": "BASE_URL",
    "browserChannelEnv": "PLAYWRIGHT_BROWSER_CHANNEL"
  },
  "testCaseMappings": [
    {
      "testCaseId": "TC003",
      "title": "Sửa thiết bị thành công",
      "screen": "Device Form",                          // Screen metadata đơn giản
      "preconditions": {
        "auth": {
          "required": true,
          "type": "STORAGE_STATE",
          "authRef": "ThietBi.session",
          "sourceReference": "playwright-codegen#login"
        },
        "navigation": {
          "required": true,
          "chainRef": "nav.ThietBi.danhmuc",
          "sourceReference": "playwright-codegen#choosePhanHe"
        },
        "data": {
          "required": true,
          "type": "CREATE_BEFORE",
          "fixtureRef": "ThietBi.them.valid",
          "sourceReference": "playwright-codegen#fillMaThietBi"
        }
      },
      "reusableFlows": [ "login", "open-device-catalog", "search-device" ],  // tester xác nhận
      "route": { "source": "CONFIRMED_FACT", "value": "/devices", "status": "APPROVED", "sourceReference": "..." },
      "stepMappings": [ /* business flow — mỗi bước có sourceReference */ ],
      "assertionMappings": [ /* assertion — mỗi assertion có sourceReference */ ],
      "cleanup": { "type": "DELETE_CREATED", "target": "device", "enabled": false }
    }
  ],
  "shared": {
    "auth": {
      "ThietBi.session": { "storageStateFile": "outputs/auth/ThietBi.storageState.json", "module": "Thiết bị" }
    },
    "navigation": {
      "nav.ThietBi.danhmuc": {
        "module": "Thiết bị", "function": "Danh mục",
        "steps": [
          { "action": "CLICK", "target": "Phân hệ Thiết bị", "locator": "...", "sourceReference": "..." },
          { "action": "CLICK", "target": "Danh mục Thiết bị", "locator": "...", "sourceReference": "..." }
        ]
      }
    },
    "reusableFlows": {
      "login": { "sourceReference": "playwright-codegen#login", "status": "APPROVED" },
      "open-device-catalog": { "sourceReference": "playwright-codegen#choosePhanHe", "status": "APPROVED" },
      "search-device": { "sourceReference": "playwright-codegen#searchDevice", "status": "APPROVED" }
    },
    "fixtures": {
      "ThietBi.them.valid": { "module": "Thiết bị", "data": { "Mã thiết bị": "DEV-001", "Tên thiết bị": "Máy A", "Loại": "Loại 1" } }
    }
  }
}
```

- `auth`, `navigation`, `data` là **3 loại precondition riêng**, mỗi loại có `sourceReference`.
- `screen` là **metadata đơn giản** (chưa phải Screen Repository).
- `reusableFlows` chỉ chứa flow **tester xác nhận** (không tự phát hiện).
- `environment` là **reference tối thiểu** (đọc từ env), không phải Environment Repository.

## B.5 Generator tái sử dụng setup (MVP)

| Setup | Cơ chế | Khi dùng |
|---|---|---|
| **Authentication** | `storageState` (nạp file session) | Có session lưu sẵn, không login lại |
| | `auth helper` gọi trong `beforeEach` | Chưa có storageState / cần login mới |
| **Shared navigation** | `helper` (vd `gotoDeviceModule(page)`) | Nhiều testcase cùng chuỗi → gọi 1 helper |
| **Data setup** | `fixture` / `CREATE_BEFORE` trong `beforeEach` | Testcase cần dữ liệu nền |
| **Cleanup** | `afterEach` / `afterAll` | Xoá dữ liệu, đóng session |

**Thứ tự trong 1 test:**
```
[beforeEach]
  1. storageState (auth) HOẶC login helper
  2. navigation helper (phân hệ → danh mục)
  3. data setup (CREATE_BEFORE)
[test] business flow + assertion
[afterEach]
  4. cleanup
```

## B.6 Trạng thái BLOCKED / NEED_USER_CONFIRMATION (MVP)

| Tình huống | Trạng thái |
|---|---|
| Thiếu `sourceReference` cho auth/navigation/business/assertion | `NEED_USER_CONFIRMATION` |
| Thiếu locator trong CodeGen | `NEED_USER_CONFIRMATION` |
| Thiếu toàn bộ navigation chain | `BLOCKED` |
| Thiếu auth hoặc data setup bắt buộc | `BLOCKED` |
| Navigation/menu locator không chắc chắn | `NEED_USER_CONFIRMATION` |
| Testcase không thể automation | `BLOCKED` |

Chỉ testcase **đủ evidence + được tester approve** mới Generate được.

## B.7 Tổ chức generated code (MVP)

```
outputs/generated-tests/
  helpers/
    auth.js          // login helper / nạp storageState
    navigation.js    // gotoDeviceModule(page)
    fixtures.js      // data setup / CREATE_BEFORE / cleanup
  TC001.spec.js      // Đăng nhập
  TC002.spec.js      // Thêm thiết bị
  TC003.spec.js      // Sửa thiết bị
  TC004.spec.js      // Xóa thiết bị
```

- helper dùng chung (`auth`, `navigation`, `fixtures`) — import vào từng spec.
- `beforeEach` trong mỗi spec: auth → navigation → data setup.
- Nhiều file spec (mỗi testcase 1 file) để chạy độc lập.
- Output **JavaScript ESM** (`import { test, expect } from '@playwright/test'`); cấm TypeScript/CommonJS.

---

# BẢNG SO SÁNH VISION vs MVP

| Khái niệm | Vision | MVP hiện tại |
|---|---|---|
| Environment | Đầy đủ | Reference tối thiểu |
| Authentication | Đầy đủ | Có |
| Navigation | Đầy đủ | Có |
| Screen | Repository/Discovery | Metadata |
| Reusable Flow | AI phát hiện | Tester xác nhận |
| Pattern Discovery | Có | Chưa |
| UI Discovery | Có | Chưa |
| Business Flow | Có | Có |
| Assertion | Có | Có |
| Cleanup | Có | Tối thiểu |

---

# FILE CÓ THỂ CẦN SỬA SAU NÀY (chưa sửa)

- `src/automation/ai/AIAutomationMapper.js` — thêm `preconditions`, `shared`, `sourceReference`, `screen` metadata, `reusableFlows`.
- `src/automation/ai/AIAutomationCodegen.js` — sinh `storageState`/helper/`beforeEach`/`afterEach`/cleanup; tái sử dụng setup; ép ESM.
- `src/automation/ai/AIAutomationService.js` / `src/routes/automationRoutes.js` — truyền/đọc `shared`, `fixtures`, `storageStateFile`, `environment`.
- `web-ui/src/pages/AIAutomationPage.jsx` — (sau này) hiển thị screen/precondition/cleanup; **chưa đổi**.
- `playwright.config.js` — (có thể) cấu hình `storageState` path mặc định.
- `src/automation/PlaywrightRunner.js` — (có thể) chạy helper/setup file chung; **chưa đổi**.

> Không thay đổi UI, Mapping, Generator hoặc Runner trong tài liệu này — chỉ định hướng kiến trúc.
