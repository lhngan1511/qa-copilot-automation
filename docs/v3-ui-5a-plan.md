# Bước 5A — UI Foundation: Workspace + Upload + Chọn testcase (V3)

> Trạng thái: **CHỜ DUYỆT WIREFRAME** — chưa code production UI.
> Wireframe: `docs/v3-ui-5a-wireframe.html` (6 màn hình).

Kiến trúc V3. UI chỉ gọi API `/api/automation-v3` (đã triển khai ở Bước 4, checkpoint `f727725`).
Không gọi Store/Renderer trực tiếp. Không đụng màn hình demo cũ (CodeGen / Automation Intelligence 6-bước).

---

## 1. Mục tiêu Bước 5A (phạm vi duy nhất)

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Tạo UI V3 gọi API `/api/automation-v3` | ✅ trong phạm vi |
| 2 | Mở/tạo Automation Workspace | ✅ |
| 3 | Upload `approved-testcases.json` | ✅ |
| 4 | Hiển thị toàn bộ testcase `reviewStatus=APPROVED` | ✅ |
| 5 | Chọn/bỏ chọn testcase cần automation | ✅ |
| 6 | Card hiển thị trạng thái SELECTED / NOT_SELECTED | ✅ |
| 7-11 | Record / Review / Assertion / Generate / Run | ⛔ ngoài phạm vi (bước sau) |

**Stepper** chỉ hiển thị 5 bước: ① Workspace ② Chọn testcase ③ Ghi testcase ④ Review ⑤ Sinh & chạy.
Bước 5A triển khai bước ① và ②; ③④⑤ hiển thị khóa (lock).

---

## 2. Component map (dự kiến)

| Component | Vai trò |
|---|---|
| `AutomationV3Page.jsx` (page) | Chủ, giữ state workspace + list testcase + selection |
| `V3WorkspaceStepper.jsx` | Stepper 5 bước |
| `V3UploadPanel.jsx` | Upload approved-testcases.json + banner "Đã đọc thành công" + meta (module/chức năng) |
| `V3TestCaseList.jsx` | Lưới / danh sách card testcase |
| `V3TestCaseCard.jsx` | Card: checkbox, testCaseId, title, type, 1 trạng thái, 1 dòng dữ liệu, tối đa 1 primary action |
| `V3ActionBar.jsx` | Thanh "Đã chọn N testcase" + primary "Tiếp tục ghi testcase" (disabled) |
| `api/automationV3Api.js` | Client gọi 4 endpoint (workspaces, select, unselect) |

Thành phần tái dùng từ design system hiện tại: `apiClient` (đã có), CSS token (màu/spacing/button), các `badge` chuẩn.

---

## 3. Files dự kiến sửa / tạo

**Tạo mới (web-ui/src):**
- `pages/AutomationV3Page.jsx`
- `components/automationV3/V3WorkspaceStepper.jsx`
- `components/automationV3/V3UploadPanel.jsx`
- `components/automationV3/V3TestCaseList.jsx`
- `components/automationV3/V3TestCaseCard.jsx`
- `components/automationV3/V3ActionBar.jsx`
- `api/automationV3Api.js`
- `styles/automationV3.css`

**Sửa:**
- `config/navigation.js` — thêm mục "Automation (V3)" trỏ `/automation/v3`
- `app/router.jsx` — thêm route `/automation/v3`
- `main.jsx` — import `automationV3.css`

**Không sửa:** `AutomationWorkspacePage.jsx` (demo cũ), CodeGen, branch demo.

---

## 4. API contract (chỉ dùng 4 endpoint)

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/automation-v3/workspaces` | `{ source:"NEW", module, approvedTestCases:[...] }` |
| GET | `/api/automation-v3/workspaces/:workspaceId` | — |
| POST | `/api/automation-v3/workspaces/:workspaceId/testcases/:testCaseId/select` | — |
| POST | `/api/automation-v3/workspaces/:workspaceId/testcases/:testCaseId/unselect` | — |

Không gọi Store/Renderer trực tiếp.

---

## 5. Rule hiển thị (đã chốt)

- Chỉ hiển thị `reviewStatus === "APPROVED"`.
- `automationCandidate=false` → vẫn hiển thị, **disable checkbox**, hiện lý do ngắn (vd "Không đủ thông tin").
- `executionReadiness === "DATA_REQUIRED"` → vẫn cho chọn, hiện "Cần bổ sung dữ liệu trước khi chạy".
- Card chỉ có: checkbox + testCaseId + title + type + 1 trạng thái + 1 dòng dữ liệu + tối đa 1 primary action.
- NOT_SELECTED: checkbox chưa chọn, badge "Chưa chọn", không primary action.
- SELECTED: checkbox đã chọn, badge "Đã chọn", primary "Ghi testcase" disabled + "bước sau".
- Action Bar: "Đã chọn N testcase" + primary "Tiếp tục ghi testcase" disabled + chú thích.
- Không tự mở Drawer khi upload / tick / select / API thành công / save.
- Không hiển thị: Generate, Run, Export, AI Mapping, upload CodeGen.

---

## 6. Design system bắt buộc

- Font nội dung ≥ 14px; button cao ≥ 40px.
- Spacing 8/12/16/24.
- Màu enterprise hiện tại (token `--primary:#155eef`, surface, border, muted…).
- Checkbox + badge đồng nhất.
- Không dùng HTML button mặc định (dùng class `.btn`).
- Không horizontal scroll; path/title dài → `overflow-wrap:anywhere`.

---

## 7. Test bắt buộc (15)

| # | Test |
|---|---|
| 1 | Upload JSON hợp lệ → hiển thị approved testcase |
| 2 | Testcase chưa approved không hiển thị |
| 3 | automationCandidate=false → checkbox disabled |
| 4 | DATA_REQUIRED vẫn được chọn |
| 5 | Tick checkbox không mở Drawer |
| 6 | Select gọi đúng API |
| 7 | Unselect gọi đúng API |
| 8 | Card chỉ có một trạng thái chính |
| 9 | Không có Generate/Run trên trang |
| 10 | Không có upload CodeGen |
| 11 | Không có AI Mapping |
| 12 | Không có button HTML mặc định |
| 13 | Responsive không vỡ layout |
| 14 | Web build PASS |
| 15 | Existing regression PASS |

---

## 8. Wireframe đính kèm

- Màn hình chưa upload
- Màn hình upload thành công
- Card NOT_SELECTED
- Card SELECTED
- Action Bar
- Mobile layout

**Chỉ sau khi wireframe được duyệt mới code production UI.**
