# Bước 5A — UI Foundation: Automation Workspace (V3)

> Trạng thái: **CHỜ DUYỆT** — Wireframe: `docs/v3-ui-5a-wireframe.html`.
> Branch `arena/automation-record-by-testcase` @ `01452ce`.

## Tư duy UI (đã chỉnh lại theo review)

1. **Workspace là màn hình gốc**, không phải Upload.
2. Upload approved-testcases.json **chỉ xuất hiện khi tạo Workspace mới**.
3. Sau khi Workspace tồn tại → **không hiển thị Upload Panel**.
4. Sidebar chỉ hiển thị **"Automation"** (không "Automation V3").
5. **Không hiển thị khái niệm 5A/5B/5C** cho người dùng.
6. UI là **một Automation Workspace duy nhất**; nút thay đổi theo trạng thái testcase.
7. Không thêm nút nếu không cần; **mỗi card chỉ một hành động chính** (checkbox).

Không stepper 5 bước, không hiển thị tên phiên bản, không upload CodeGen, không AI Mapping, không Generate/Run/Export.

## Component map

| Component | Vai trò |
|---|---|
| `AutomationV3Page.jsx` | Workspace gốc; state workspace + displayMap; localStorage; tạo/mở workspace |
| `V3UploadPanel.jsx` | Chỉ hiển thị khi tạo workspace mới |
| `V3TestCaseList.jsx` | Danh sách card testcase |
| `V3TestCaseCard.jsx` | 1 hành động chính (checkbox) + id/title/type/1 trạng thái/1 dòng dữ liệu |
| `V3ActionBar.jsx` | "Đã chọn N testcase" + primary duy nhất |
| `api/automationV3Api.js` | Client 4 endpoint |
| `utils/automationV3.js` | Normalize approved (thuần) |

## Files

- **Tạo:** `pages/AutomationV3Page.jsx`, `components/automationV3/{V3UploadPanel,V3TestCaseList,V3TestCaseCard,V3ActionBar}.jsx`, `api/automationV3Api.js`, `utils/automationV3.js`, `styles/automationV3.css`
- **Sửa:** `app/router.jsx` (`/automation`), `config/navigation.js` (1 mục "Automation"), `components/AppSidebar.jsx` (icon recording), `main.jsx`, `public/` (build)
- **Xóa:** `components/automationV3/V3WorkspaceStepper.jsx`

## API client (chỉ 4 endpoint)
`POST /workspaces` · `GET /workspaces/:id` · `POST .../select` · `POST .../unselect`.

## Test
`tests/automation-v3-ui-test.js` + `automation-v3-api-test.js` + regression + `vite build`.
