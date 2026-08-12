# HANDOFF — V3 Record by Testcase (Bản chuyển giao cho session/chat mới)

> Cập nhật lần cuối: 2026-08-10 · Viết để một chat/session HOÀN TOÀN MỚI có thể tiếp tục
> **đúng, không lệch nội dung**. Đây là nguồn duy nhất cần đọc trước khi làm tiếp.

---

## 1. BỐI CẢNH DỰ ÁN & CÁC NHÁNH (ĐỌC KỸ)

Repo: `lhngan1511/qa-copilot-automation` (QA Copilot, xưng hô trung tính, người dùng viết **tiếng Việt**).

Có **nhiều nhánh / kiến trúc khác nhau**, đừng nhầm. Trạng thái remote (đã xác minh `git ls-remote`):

| Nhánh | Commit | Nội dung |
|---|---|---|
| **`arena/automation-record-by-testcase`** | **HEAD (mới nhất — xem `git log -1`/`git ls-remote`)** | ⭐ **NHÁNH V3 — "Record by Testcase". ĐÂY LÀ NHÁNH LÀM VIỆC.** Toàn bộ tiến trình V3 nằm đây. |
| `arena/019fcae2-codegen-mvp` | `d5158a1` | Demo cũ "Automation Intelligence 6-bước" (CodeGen upload → AI Mapping → Review → Generate → Run → Export). **KHÔNG phải V3. Đừng nhầm.** |
| `demo/ui-polish-20260807` | `59063d6` | Nhánh **chỉ UI demo** (bắt nguồn từ codegen-mvp). Đã cherry-pick fix Generate. Không liên quan V3. |
| `arena/019fcc7b-qa-copilot-automation` | `790dc8d` | Branch tạm của một session Arena trước đó. **KHÔNG dùng cho V3.** |
| `main` | `0100679` | Trunk. Không đụng trực tiếp. |

> Lưu ý về cột commit: hash các nhánh khác là trạng thái đã xác minh `git ls-remote` ngày 2026-08-10. Riêng nhánh V3 **không ghi hash cố định** vì mỗi lần cập nhật docs/handoff lại tạo commit mới làm HEAD đổi — luôn lấy commit mới nhất (xem `git log -1`).

**LUẬT VÀNG:**
- Mọi việc V3 làm trên `arena/automation-record-by-testcase`.
- TUYỆT ĐỐI không đụng `arena/019fcae2-codegen-mvp`, `demo/ui-polish-20260807` (demo) trong các bước V3.
- Sau **mỗi bước**: commit + push + **xác minh `git ls-remote` thật** (người dùng từng nhiều lần "bắt" khi thiếu bằng chứng).
- Làm việc qua **git worktree** (vd `/tmp/wt-v3`), nhớ `git worktree remove --force` + `git worktree prune` sau mỗi lượt.
- Người dùng thường yêu cầu **wireframe trước khi code production UI** — cứ theo thông lệ đó.

### Cách cài deps (mỗi worktree mới)
```
npm install @playwright/test            # root (cần cho backend tests)
npm install --prefix web-ui             # web deps (cho build)
git checkout -- package-lock.json node_modules/.package-lock.json web-ui/package-lock.json
```
(khôi phục lockfile để giữ tree sạch). Build: `npm run build --prefix web-ui`.

---

## 2. KIẾN TRÚC V3 (đã đóng băng — KHÔNG đổi)

**"Record by Testcase"** — một Automation Workspace duy nhất, mỗi testcase có vòng đời:

```
NOT_SELECTED → SELECTED → RECORDING → RECORDED → UNDER_REVIEW → APPROVED → GENERATED → RUNNING → PASS/FAIL
```

Luồng bắt buộc: **Route → Application Service → Domain/Store/GenerateService → Renderer**.
Renderer **chỉ render, không ghi file** (GenerateService ghi). API chỉ gọi Service (không gọi Renderer/Store trực tiếp). UI một hành động chính / card.

### Backend (src/codegen/)
- `AutomationWorkspace.js` — "bộ não": lưu state workspace **tách hẳn khỏi approved-testcases.json** (data/automation-workspaces.json).
- `CodeGenRecordingStore.js` — store recording (metadata data/codegen-recordings.json + script outputs/codegen/).
- `recordingParser.js` — parse source Playwright → steps/assertions/recordedValues; không dùng AI để đoán testcase.
- `CurrentRecordingSession.js` — current recording session (1 active/workspace, start/stop giữ đúng testCaseId).
- `rendererV3.js` — **Renderer THUẦN** (renderV3Spec → { code, runtimeEnv, validation, metadata }, KHÔNG ghi file).
- `GenerateService.js` — orchestrator duy nhất (ghi file outputs/generated-tests/ + cập nhật workspace).
- `ApprovedTestcaseLoader.js` — đọc approved-testcases.json (chỉ đọc).

### Ứng dụng service + route (Bước 4)
- `src/services/AutomationWorkspaceApplicationService.js`
- `src/routes/automationV3Routes.js` — mount `/api/automation-v3`
- `src/server/createApp.js` — wire V3 dependency graph.

### UI (web-ui/src/)
- `pages/AutomationV3Page.jsx` — Workspace-gốc.
- `components/automationV3/`: `V3UploadPanel`, `V3TestCaseList`, `V3TestCaseCard`, `V3ActionBar`, `V3RecordingPanel`, `V3ReviewDrawer`, `V3RecordingTab`, `V3ConfirmDialog`.
- `api/automationV3Api.js`, `utils/automationV3.js`, `styles/automationV3.css`.
- Route `/automation`, sidebar "Automation".

---

## 3. TIẾN TRÌNH ĐÃ HOÀN THÀNH (commit trên nhánh V3, mới nhất ở trên)

| Bước | Nội dung | Commit |
|---|---|---|
| Docs | Chốt Architecture V3, 5 điểm khóa | `5c5694d` |
| **Bước 1** | AutomationWorkspace + extend CodeGenRecordingStore | `91da214` |
| **Bước 2** | Current Recording Session + Parse Recording | `dbef2bc` |
| **Bước 2+** | 6 điểm khóa (version/hash/summary/REVIEW_REQUIRED/không overwrite/parser) | `8f7d5c4` |
| **Bước 3** | Renderer V3 (Workspace + latest APPROVED → spec) | `3c70dfb` |
| **Bước 3+** | Refactor: Renderer THUẦN + GenerateService orchestrator (9 điểm khóa) | `4334838` |
| **Bước 4** | API/Routes V3 (Route → AppService → GenerateService → Renderer) | `f727725` |
| **Bước 5A** | UI Foundation (Workspace + Upload + Chọn testcase) | `01452ce` |
| **Bước 5A+** | Chỉnh tư duy UI: Workspace là màn hình gốc, bỏ stepper/version, sidebar chỉ "Automation" | `d74147f` |
| **Bước 5B** | Ghi testcase + Review Recording (banner, drawer 2 tab, approve/reject/delete, source lazy) | `be3bbdd` |
| **Bước 5B+** | Chỉnh nhãn: "Gắn bản ghi testcase" (dán source), ghi nhận chưa spawn Recorder thật + backlog | `71eb11c` |
| **Handoff** | Tổng kết tiến trình V3 (file này) | `89f40aa` |
| **Handoff** | Bổ sung bài học phiên demo → nền tảng Bước 5C | (xem git log mới nhất) |
| **Handoff** | Đồng bộ hash remote sau xác minh `git ls-remote` (2026-08-10) | (xem git log mới nhất) |
| **Docs** | Chốt thiết kế **Record Mapping** (Session ≠ TestCase, Segment, tester-owned, không AI/không theo thứ tự) + wireframe | (xem git log mới nhất) |
| **Bước 5C-0** | **Record Mapping: triển khai** — Segment model (store/workspace), session không gắn testcase, UI Timeline + gán đoạn + Review Mapping (↑/↓), validation gating Generate, automationDecision 3 nhãn, legacy fallback | (xem git log mới nhất) |
| **Docs** | Wireframe **5C** (Expected Result → Điều kiện xác nhận → Generate; warning "chưa đủ thông tin", đề xuất deterministic, cắm AI sau không phá workflow) | (xem git log mới nhất) |
| **Bước 5C** | **Expected Result → Tester-confirmed Assertion → Generate: triển khai** — tab "Kết quả mong đợi", assertionSuggester deterministic, Áp dụng→Nháp→Xác nhận, gate ≥1 TESTER_CONFIRMED, Sinh automation chỉ drawer, renderer toBeHidden | (xem git log mới nhất) |
| **Docs** | **Architecture Correction** — mô hình Recording → Action Block → TestCase Binding; root cause BUG 1+2; CASE A/B/C; migration GIỮ/REFACTOR/BỎ/THÊM + wireframe UX mới | (xem git log mới nhất) |
| **6A** | Fix BUG 1 (drawer qua refs) + BUG 2 (expectedResult payload) | `904c7fa` |
| **6B** | **Data Model:** ActionBlock (snapshot, workspace-level) + TestCaseAutomationBinding (sequence) + reverse dependency + migrate legacy Segment→Block + Generate đọc binding; API blocks/binding; test A–G | (xem git log mới nhất) |

### Test V3 (đều PASS)
- `tests/automation-v3-api-test.js` (Bước 4 — 20 test, trong đó test backend HTTP + error contract + restart persistence).
- `tests/automation-v3-recording-api-test.js` (5B — detail/source/delete/list summary).
- `tests/automation-v3-ui-test.js` (static contract + logic thuần — gồm 5C-0 + 5C: panel gán đoạn, tab Kết quả mong đợi, helpers, API client).
- `tests/automation-v3-record-mapping-test.js` (5C-0 — mapping theo testCaseId không theo thứ tự, segment CRUD, reorder, gating Generate, legacy fallback).
- `tests/automation-v3-assertion-test.js` (5C — expected result working copy, đề xuất không bịa, gate message, toBeHidden, sửa → DRAFT).
- `tests/renderer-v3-test.js`, `tests/recording-session-parse-test.js`, `tests/recording-session-v2-supplement-test.js`, `tests/automation-workspace-test.js`.

---

## 3.5. BÀI HỌC TỪ PHIÊN DEMO (2026-08-07) — ÁP DỤNG CHO V3 ⭐

Phiên demo trên `arena/019fcae2-codegen-mvp` đã phơi bày **lỗi gốc** của toàn bộ luồng "số hóa testcase → assertion → generate". Đây là lý do **V3 có luồng Expected Result → tester-confirmed assertion (Bước 5C)**. Đọc kỹ trước khi làm 5C.

### Lỗi gốc: ASSERTION_MAPPING_REQUIRED (không phải BASE_URL / EMPTY / Runner)
- TC001 là testcase **POSITIVE** ("Đăng nhập thành công"), nhưng recording (Playwright CodeGen dài) **chỉ có assertion là thông báo lỗi/validation**:
  `"Vui lòng nhập Tên tài khoản"`, `"Vui lòng nhập Mật khẩu"`, `"Vui lòng nhập Mã xác nhận"`.
- Hệ thống **đúng khi từ chối** lấy mấy câu đó làm bằng chứng đăng nhập thành công → `resolveAssertion` trả `ASSERTION_MAPPING_REQUIRED` (không tự bịa).
- Kết luận: **không thể tự động suy assertion thành công từ recording nếu recording chỉ có assertion lỗi.** Cần **tester cung cấp/xác nhận assertion thành công** (VD `await expect(page.getByText('Danh mục phần mềm quản lý')).toBeVisible();` hoặc URL/heading thật sau đăng nhập).

### Bug phụ đã fix (P0 Preserve ASSERTION_MAPPING_REQUIRED)
- Khi deterministic fallback trả `ok=false errorCode=ASSERTION_MAPPING_REQUIRED`, pipeline **phải STOP ngay** — KHÔNG được tiếp tục `validateCode("")` (sinh 6 lỗi giả thiếu TC ID/import/BASE_URL/env) và KHÔNG được hiện `CODEGEN_RULE_VALIDATION_FAILED`.
- Service phải trả **nguyên `errorCode=ASSERTION_MAPPING_REQUIRED`**; UI hiển thị đúng: **"Chưa có điều kiện xác nhận phù hợp với kết quả mong đợi."**
- Cách làm (đã áp trên demo): codegen `generate()` return sớm khi fallback-rejected; service ưu tiên guard error; controller map guardError sang message rõ. **KHÔNG bịa assertion.**

### Các fix Generate khác trên demo (tham khảo, KHÔNG copy nguyên vào V3 trừ khi cần)
- **goto BASE_URL:** `renderGotoStatement` với URL tuyệt đối → `process.env.BASE_URL + "/path"` (bỏ hardcode host) để qua Rule Validation.
- **purpose=EMPTY:** validator `requiredCredentialEnv` bỏ qua field `purpose=EMPTY` (TC VALIDATION bỏ trống field vẫn sinh được).
- **AI code fail rule validation → tự fallback deterministic** (code sạch từ mapping) để luôn sinh được.

> V3 đã có sẵn renderer/generate theo hướng "tester-confirmed assertion" — không cần import mấy fix demo. Nhưng **bài học cốt lõi** (assertion phải do tester xác nhận, không suy từ recording lỗi) **là nền tảng cho Bước 5C.**

## 3.6. CHỐT RECORD MAPPING (2026-08-10) — ĐỌC TRƯỚC KHI LÀM 5C ⭐

Phiên demo chứng minh mapping theo thứ tự SAI (JSON duyệt `4-3-2-1` vs recording thao tác `1-2-4-3`). Đã đóng băng:
- **Recording Session ≠ TestCase** — 1 bản ghi dài (đăng nhập → phân hệ → chức năng → form con → thêm/sửa/xóa) phục vụ nhiều testcase. **Bỏ giả định `1 recording = 1 testcase`.**
- **Segment = khoảng steps liên tục** (metadata `startStep/endStep`, tận dụng `order/sourceStart/sourceEnd/sourceLine` của parser), **không cắt source**.
- **Mapping thuộc quyền tester**: chọn start → end → loại (SETUP/TESTCASE) → testCaseId → xác nhận. Lưu bằng `testCaseId`, **KHÔNG theo index/order/position**.
- **KHÔNG AI mapping**: không auto match / suggest / assign; text tương tự chỉ hỗ trợ tìm kiếm, không preselect.
- **SETUP tách khỏi testcase** (dùng chung; giữ tinh thần `setupRecordingId` của GenerateService).
- Testcase có thể **không automation** (Chưa quyết định / Có automation / Chỉ kiểm thử thủ công) — thiếu segment không phải lỗi hệ thống, chỉ chặn khi Generate.
- Testcase có thể **nhiều segment** (kể cả từ nhiều session) — lưu thứ tự, tester sắp xếp (↑/↓), Generate theo đúng thứ tự.
- **Generate chỉ kiểm tra testcase đang Generate**; recording còn bước chưa gán → hiển thị thông tin, KHÔNG chặn.

Chi tiết + quyết định đã duyệt: `docs/DESIGN_RECORD_MAPPING.md` (mục 0.1) · Wireframe **đã duyệt**: `docs/v3-record-mapping-wireframe.md` (mục F).

## 3.7. ARCHITECTURE CORRECTION (2026-08-10) — Recording / TestCase / Reuse ⭐

**Mốc:** 5C đã implementation tại `cccbcc8` và tester đã kiểm tra UI thật → phát hiện 2 bug data path + bài toán nghiệp vụ (CRUD nhiều TC cùng thao tác, FLOW LỒNG Nhập kho/Thêm ĐVT/Thêm KH/Cấp phát) → mô hình `Recording → Segment → TestCase` **KHÔNG ĐỦ**.
**Quyết định:** TẠM DỪNG Step 6; không Runner; không AI mapping; **không vá lẻ UI 5C**; chuyển sang thiết kế mới (chưa code).

- **Mô hình mới:** `Recording Session → Action Block → TestCase Automation Binding (Composition)`.
  - Action Block ≠ TestCase: block là bằng chứng/thao tác từ recording (đặt tên, **dùng lại được**); TestCase sở hữu binding (danh sách block + thứ tự + test data + expected + assertions).
  - Reuse PHẢI do tester quyết định — không AI, không theo thứ tự/index.
  - **Đã chốt thêm:** Progressive Complexity (Simple Path mặc định / Composition Path khi cần) · ActionBlock → reusable Playwright function (design dài hạn) · **Recorded values ≠ authoritative Test Data** · slots/TestDataBinding design-only · **ActionBlock snapshot + reverse dependency** `blockId → testcaseIds[]` · 6 quyết định UX (mục 8 wireframe) · guardrail reuse (tên giống nhau ≠ bằng chứng mapping).
  - Chi tiết: `docs/V3_AUTOMATION_COMPOSITION_DESIGN.md` (data model + CASE A/B/C + migration + checkpoint 6A→6D).
  - Wireframe UX mới (context testcase, Start/End dropdown, reuse): `docs/v3-automation-composition-wireframe.md` (mục 8 = 6 quyết định đã chốt).

**Root cause 2 bug (đã trace + tái hiện):**
- **BUG 1** — Card "đã gán 1 đoạn · 1 xác nhận" nhưng tab Recording "Chưa có recording để review": drawer tab Recording gọi `store.allByTestCase(testCaseId)` (contract 5B: 1 recording = 1 testcase) trong khi recording 5C-0 có `testCaseId = null` (liên kết ở segment) → trả `[]`. Card đọc workspace refs → đúng. **Fix (thiết kế):** drawer lấy recording qua binding/block refs của testcase.
- **BUG 2** — Tab "Kết quả mong đợi" hiển thị "(trống)" dù JSON có expectedResult: `AutomationV3Page.handleCreated` **thiếu field `expectedResult`** trong payload `createWorkspace` → workspace entry rỗng. Backend/contract đã hỗ trợ (test API PASS vì không đi qua page). **Fix (thiết kế):** map đủ `expectedResult` trong payload page.

## 4. VIỆC CHƯA LÀM (THEO THỨ TỰ — LÀM TIẾP TỪ ĐÂY)

### Bước 5C-0 — Record Mapping (ĐÃ HOÀN THÀNH 2026-08-10)
- Thiết kế + wireframe đã duyệt; code đã triển khai (Segment model, UI Timeline + gán đoạn, validation gating, automationDecision). Xem mục 3.6 + `DESIGN_RECORD_MAPPING.md`.
- KHÔNG còn việc chưa làm ở 5C-0 (trừ khi người dùng yêu cầu điều chỉnh sau khi dùng thử).

### Bước 5C — Expected Result → Tester-confirmed Assertion → Generate (ĐÃ TRIỂN KHAI 2026-08-10)
- Theo wireframe đã duyệt `docs/v3-ui-5c-wireframe.md` (6 quyết định chốt ở mục 8).
- Đã có: tab **"Kết quả mong đợi"** trong Drawer (xem/sửa Expected Result — working copy trong workspace, KHÔNG đụng approved); nút **"Đề xuất điều kiện xác nhận"** chủ động (deterministic `assertionSuggester`, source SYSTEM_SUGGESTED — chưa AI nhưng cùng contract để cắm AI sau); **Áp dụng → Nháp → Xác nhận**; sửa điều kiện → quay về Nháp; **gate Generate bắt buộc ≥1 TESTER_CONFIRMED** (message "Chưa có điều kiện xác nhận phù hợp với kết quả mong đợi."); **Sinh automation chỉ ở drawer footer** (card chỉ có "Điều kiện xác nhận" + trạng thái tóm tắt).
- Renderer hỗ trợ thêm matcher `toBeHidden`.

### Bước 6 — Run (browser thật) — **TẠM DỪNG** (chờ Architecture Correction duyệt xong)
- Chạy spec đã generate; RUNNING → PASS/FAIL. Cần Chromium (sandbox hiện KHÔNG có — chỉ stub/test).
- Phạm vi hẹp đã chốt: Generate spec → Runner → PASS/FAIL thật → log/trace. **Chưa thêm AI failure analysis.**

### Bước 6.5 — ARCHITECTURE CORRECTION (ĐANG Ở ĐÂY — Checkpoint 6C: wireframe chờ duyệt)
- Đọc `docs/V3_AUTOMATION_COMPOSITION_DESIGN.md` + `docs/v3-automation-composition-wireframe.md`.
- **Lộ trình checkpoint (giữ cứng thứ tự):** 6A fix data bugs ✅ → 6B data model ✅ → **6C UX (wireframe chờ duyệt — CHƯA code)** → 6D verify 3 workflow thật → rồi mới Runner/CodeGen nâng cao. **KHÔNG build function compiler trước khi data model vững.**

**6C.1 — UX/WORKFLOW CORRECTION sau test UI thật (ĐÃ TRIỂN KHAI 2026-08-10):**
- **Root cause (đã trace + reproduce):**
  - *Duplicate 2 actions sau confirm:* `confirmAction` luôn APPEND (`bindBlock`) — không phân biệt ADD/REPLACE → workspace cũ có binding sẵn → append tạo item thứ 2 ("Đăng nhập · Dùng lại · Nháp" = block REUSABLE cũ sau saveReuse bị DRAFT).
  - *"0/1 đã xác nhận":* `updateBlock(scope REUSABLE, label)` reset status DRAFT (đổi metadata nhưng mất CONFIRMED).
  - *409 sau Duyệt recording:* approve lần 2 trên recording đã APPROVED → `INVALID_STATE_TRANSITION`; page không clear `notice` cũ → thấy "Recording đã được duyệt." + error đồng thời.
- **Fixes:** ADD/REPLACE semantics (confirm đầu = REPLACE toàn bộ binding; `[+ Thêm thao tác]` = APPEND; `[Thay thế]` = REPLACE đúng item + giữ vị trí cũ) · `updateActionBlock` chỉ reset DRAFT khi NỘI DUNG (steps/range) đổi, đổi label/scope giữ CONFIRMED · **Bỏ tab Recording + nút "Duyệt recording" khỏi drawer** (recording chỉ là source/evidence; "Xem bản ghi nguồn" read-only trong expand thao tác) · status rõ "✓ Đã xác nhận" / "⚠ Chưa xác nhận" (+ nút Xác nhận) · Generate gate yêu cầu **TẤT CẢ** thao tác CONFIRMED, message `Thao tác 'X' chưa được xác nhận.` · label hiển thị = label đã lưu hoặc derive từ tên testcase (không AI) · compact drawer/action list (`[Xem]` expand steps).
- Test mới `tests/automation-v3-workflow-test.js` (fresh workflow TC001 + A no-duplicate + B append + C replace giữ vị trí + D DRAFT chặn + E không success+error + F trace recording + G snapshot + H migration không duplicate). Regression 11/11 PASS + build OK.

**6C.2 — RECORDED ASSERTION CORRECTION (ĐÃ TRIỂN KHAI 2026-08-10):**
- Parser vốn đã tách `expect()` → `recording.assertions[]` (sourceStart/End/Line) nhưng bị rơi khỏi flow. Đã sửa:
- **Snapshot recorded assertions vào ActionBlock:** `block.recordedAssertions[]` (COPY snapshot — không live reference; xóa/sửa raw recording không ảnh hưởng; hash block gồm cả assertions).
- **Rule range mapping (source position, KHÔNG dùng step index):** assertion thuộc block khi sourceStart/End nằm trong phạm vi steps đã chọn, HOẶC nằm trong **trailing window ≤120 ký tự sau action cuối** (expect ngay sau click cuối → kèm theo); range xa → không kèm.
- **UI tab "Kết quả mong đợi"** thêm khối **"Điều kiện tìm thấy trong bản ghi"**: candidate `source=RECORDED, status=SUGGESTED` (KHÔNG tự kết luận = Expected Result, không auto-select) → `[Xác nhận]` (tạo assertion TESTER_CONFIRMED giữ locator/matcher từ recording — `saveDraftAssertion` cho phép status TESTER_CONFIRMED khi source=RECORDED) / `[Bỏ qua]` (không vào spec).
- Không có expect → fallback "Không tìm thấy điều kiện xác nhận trong bản ghi." + `[Đề xuất điều kiện]` / `[+ Tự bổ sung]` (deterministic, không AI).
- Nhiều expect → hiển thị từng candidate, tester chọn lọc.
- `expect()` không tính là action: stepCount chỉ actions; recordedAssertionCount riêng.
- Test mới `tests/automation-v3-recorded-assertion-test.js` (A parser · B whole · C partial + trailing · D snapshot · E candidate source/status · F confirm→Generate · G ignore · H no-expect · I multiple · J count). Regression 12/12 PASS + build OK.

**P0 — CODEGEN UX CLEANUP (ĐÃ IMPLEMENT 2026-08-10, không thêm feature):**
- **Paste KHÔNG spawn recorder:** thêm `POST /api/codegen/recordings` (tạo global recording trực tiếp — không mở browser/Inspector); `V3RecordingPreparationPanel.handlePasteDone` dùng `createRecording` (bỏ `/api/codegen/start`). Chỉ `[Bắt đầu ghi]` mới trigger recorder.
- **Steps không bung:** hiển thị summary `N thao tác · M điều kiện kiểm tra` + `[Xem chi tiết]` (collapse).
- **Verification business-readable + scoped theo range/proposal:** helper `readableAssertion` (target + "hiển thị/không hiển thị/URL=...") thay raw `expect(...)`; raw để trong `[Xem kỹ thuật]`.
- **Công cụ nâng cao → `Công cụ kỹ thuật ▾`** (details collapse): bên trong Chạy thử bản ghi / Lưu script / Xem script gốc (read-only, canonical).
- Main visual flow: Nguồn bản ghi → Phân tích → Review proposal/manual → Confirmed actions → Save Library.
- Không AI Composition / Runner. Regression 15/15 PASS + build OK. **DỪNG — chờ tester kiểm UI.**

**P0/P1 — UX CORRECTION + AI RECORDING ANALYSIS (ĐÃ IMPLEMENT 2026-08-10):**
- **Assertion scoping (P0):** `V3RecordingPreparationPanel` hiển thị verification **theo range đang chọn** (source-range rule: assertion trong phạm vi steps hoặc trailing ≤120 ký tự sau action cuối); range không có → "Không có điều kiện kiểm tra được ghi trong đoạn này." Backend `createLibraryAction` đã snapshot đúng theo range (không tin frontend).
- **AI Recording Analysis:** endpoint `POST /api/codegen/analyze` (input CHỈ steps+assertions của recording — **không testcase list**; dùng `AIProviderFactory` + `AIConfig.provider`, không hardcode Gemini; AI unavailable/malformed JSON → `proposals: []` an toàn). UI: nút `[Phân tích bản ghi]` → proposals `[Xác nhận][Chỉnh phạm vi][Bỏ qua]` → confirm = `createLibraryAction` với range/tên tester chốt (snapshot từ recording thật). AI KHÔNG persist, không map testcase, không tự confirm.
- **Advanced Tools:** bỏ textarea Playwright thứ hai — consume canonical recording (`active.scriptContent` read-only "Xem script gốc"); `Chạy thử bản ghi`/`Lưu recording` dùng canonical.
- **Automation empty state:** chỉ `[+ Thêm thao tác từ thư viện]` (primary compact) + fallback link `[Tạo thao tác mới từ bản ghi]`; bỏ `lastRecording` cũ; không còn source chooser 2 card.
- Test mới `automation-v3-ai-analysis-test.js` (J.1–8: nhiều expect; Add/Search scoping; range không assertion → 0; malformed/unavailable an toàn; tester chỉnh range; không testcase context). Regression 15/15 PASS + build OK. **DỪNG — chờ tester kiểm tra UI thật (AI + manual). CHƯA AI Testcase Composition; CHƯA Runner/6D.**

**P0 — CODEGEN CONSOLIDATION (ĐÃ IMPLEMENT 2026-08-10, CHƯA AI):**
- Kiến trúc: `Record/Paste → GLOBAL Recording (không workspace) → Parse → Cut → Confirm → ActionLibrary.create()` — CodeGen authoring **không qua Automation Workspace**, không hidden workspace, không orphan block, không createBlock trong CodeGen path.
- Backend: `CodeGenSessionManager.setScript` parse steps/assertions (global recording); **API mới `POST /api/codegen/library`** (nhận recordingId+label+kind+startStep/endStep → backend tự slice steps + recordedAssertions + sourceRange → ActionLibrary.addBlock → `LIB-*`; KHÔNG tin frontend steps). ActionLibrary khởi tạo trước codegen route (dùng chung file).
- Frontend: `V3RecordingPreparationPanel` dùng global recording + `createLibraryAction`; `onConfirmedSegment(LIB-*)` → fallback Automation `bindLibraryBlock`; `CodeGenPage` consolidate MAIN FLOW (PLAYWRIGHT RECORDING [Bắt đầu ghi/Dán] → PHÂN ĐOẠN → LƯU THƯ VIỆN) + CÔNG CỤ NÂNG CAO (Chạy thử/Lưu file) + **bỏ Đối chiếu testcase khỏi UI V3** (backend legacy giữ).
- Acceptance ĐVT (`automation-v3-codegen-consolidation-test.js` PASS): 1 recording 19 steps → cut 7 action → Library (LIB-*) → reload còn → TC Sửa `Login→Open→Search→Edit→Search` (Search lặp LIB) generate đúng; TC Thêm `Login→Open→Add`. Regression 14/14 PASS + build OK. **DỪNG — chờ tester kiểm tra UI thật (Record path + Paste path).**

**P0 — CODEGEN CONSOLIDATION IMPACT (2026-08-10, trace — CHỜ DUYỆT, CHƯA CODE):**
- Kiến trúc mục tiêu: Record/Paste → **Global Recording (workspaceId=null)** → Parse → Cut → Confirm → **ActionLibrary.create() trực tiếp** (không qua workspace, không hidden workspace, không orphan block). Automation chỉ consume `LIB-*` qua binding.
- Impact trace: (1) RecordingStore đã hỗ trợ global (workspaceId null; CodeGenSessionManager.start không truyền workspace) · (2) API /api/codegen (start/stop/get) không workspace — cần xác minh stop parse steps (bổ sung nếu chưa) · (3) **bỏ hoàn toàn createBlock khỏi CodeGen path** (thay API mới `POST /api/codegen/library` → ActionLibrary.addBlock; createBlock workspace giữ cho compatibility) · (4) ActionLibrary.addBlock **đã đủ** steps/recordedAssertions/sourceRange/label/kind (status CONFIRMED) · (5) Fallback Automation **reuse cùng global flow** (panel dùng global + bindLibraryBlock cho testcase).
- "Đối chiếu testcase" = POST /recordings/:id/link (legacy CodeGen→testcase, gắn testcaseIds) — **V3 KHÔNG dùng** (mapping qua binding) → **REMOVE khỏi CodeGen V3** (backend link giữ legacy).
- Chi tiết: `docs/V3_CODEGEN_CONSOLIDATION_IMPACT.md`. Chưa code.

**P0 — CODEGEN UX CONSOLIDATION (v3, 2026-08-10, WIREFRAME — CHỜ DUYỆT, CHƯA CODE):**
- Vấn đề: CodeGen có HAI nơi xử lý Playwright recording (section 0 textarea + section 2 textarea) → feature stacking. Consolidation về MỘT main flow.
- Wireframe mới (`v3-codegen-consolidation-wireframe.md`): PLAYWRIGHT RECORDING (1 input canonical; [Bắt đầu ghi]/[Dán bản ghi]) → PHÂN ĐOẠN ([+ Chọn đoạn thủ công]/[Phân tích bản ghi sau này]) → CÁC THAO TÁC ĐÃ XÁC NHẬN → [Lưu vào Thư viện thao tác] → CÔNG CỤ NÂNG CAO (Chạy thử/Lưu file secondary).
- Legacy: giữ Record+Đối chiếu tách; Lưu file/Chạy thử → Advanced Tools; bỏ textarea thứ hai; section 0 hấp thụ làm main flow.
- **Codegen không phụ thuộc active workspace** (impact đã trace): startRecording/createBlock đang `ensureWorkspace` + check `rec.workspaceId` → cần cho phép workspaceId=null (recording authoring độc lập; createBlock null → thẳng ActionLibrary); KHÔNG tạo hidden workspace.
- Automation giữ: primary `[+ Thêm thao tác từ thư viện]` (compact) + fallback reuse RecordingPreparation.
- Chưa AI/analyze; chưa code — chờ duyệt wireframe.

**P0 PHASE 1 (v2) — CODEGEN OWNER + SHARED RECORDING PREP (ĐÃ IMPLEMENT 2026-08-10, CHƯA AI):**
- **Codegen thật sự được sửa**: `CodeGenPage` thêm khu vực "0. Thu thập thao tác → Thư viện (Codegen)" — owner Recording Preparation (dùng workspace active từ localStorage; nếu chưa có → hướng dẫn tạo workspace trước).
- **Shared component `V3RecordingPreparationPanel`** (mới): paste/parse/preview/cut-many (toàn bộ/một phần + Start/End + Tên) → `[Xác nhận đoạn]` → "Các đoạn đã xác nhận" → `[Lưu vào thư viện thao tác]`; callback `onConfirmedSegment` cho fallback. **KHÔNG duplicate logic.**
- **Automation fallback**: `V3ActionSetupPanel` màn paste → **reuse shared component** (`onConfirmedSegment` bind block vào testcase đang mở); bỏ paste nội bộ cũ.
- **CSS**: nút `[+ Thêm thao tác từ thư viện]` thêm `v3-btn--mini` (compact — hết khối lớn).
- **Parser root cause đã loại**: trace 3 case + nháy đơn/kép → parser/API trả steps đầy đủ (lỗi "không có thao tác nào" chỉ do UI cũ reset/thiếu; shared component dùng đúng data path). Không đổi message.
- Không AI/analyze; không đụng Expected/Assertion/Generate/Runner; không migration Library.
- Test: ui-test cập nhật (Codegen dùng shared; shared có cut-many + Lưu Library; fallback reuse). Regression 13/13 PASS + build OK. **DỪNG — chờ tester kiểm tra UI thật.**

**P0 PHASE 1 — OWNERSHIP UX CORRECTION (ĐÃ IMPLEMENT 2026-08-10, CHƯA AI):**
- Bỏ màn chọn nguồn ngang hàng `Dán bản ghi / Dùng thao tác đã có` trong `V3ActionSetupPanel`.
- **Primary = `[+ Thêm thao tác từ thư viện]`** (mở Library shared; dùng nút `Dùng` đã có).
- **Fallback secondary = `Không có thao tác phù hợp? [Tạo thao tác mới từ bản ghi]`** — mở lại màn paste/cut-many (tái dùng logic hiện có, không duplicate).
- Recording preparation (paste/parse/cut-many) vẫn nằm trong panel nhưng chỉ truy cập qua fallback (chưa tách Codegen page riêng — ownership UX đã đúng; Codegen tool hoàn chỉnh khi Phase 2).
- Không migration Library; không đụng Expected/Assertion/Generate/Runner; chưa AI/analyze endpoint.
- Test: ui-test cập nhật (bỏ màn nguồn, primary Library, fallback paste). Regression 13/13 PASS + build OK. **DỪNG — chờ tester kiểm tra UI thật trước khi Phase 2 AI.**

**P0 — CODEGEN → ACTION LIBRARY OWNERSHIP CORRECTION (2026-08-10, DESIGN + WIREFRAME — CHỜ DUYỆT, CHƯA CODE):**
- Vấn đề: Action Library đã có (shared asset) nhưng UX ownership sai — `V3ActionSetupPanel` vẫn làm cả recording preparation lẫn composition (screen source/paste/library/list).
- Kiến trúc bắt buộc: **Codegen = owner Recording Preparation** (record/paste/parse/[Phân tích bản ghi]/cut → proposal review → confirm → chủ động Lưu Library) · **Automation Workspace = owner Composition** (primary `[+ Thêm thao tác từ thư viện]`; `[Tạo thao tác mới từ bản ghi]` fallback; repeat D→E→D giữ).
- Không phá foundation (parser/ActionBlock snapshot/recordedAssertions/Library shared/repeat/reorder/Generate); không migration dữ liệu Library; chỉ thay ownership + UX.
- AI: output = proposal review được (Đề xuất 1 · Bước 1→4 · Tên · Evidence · [Xác nhận][Chỉnh phạm vi][Đổi tên][Bỏ qua]); confirm → snapshot từ recording thật → chủ động lưu Library; không tin step AI; không tự map.
- Docs: `V3_CODEGEN_OWNERSHIP_CORRECTION_DESIGN.md` (impact: giữ/chuyển/bỏ component; API reuse/thêm; state transition) + `v3-codegen-ownership-wireframe.md` (3 màn).

**BOUNDARY — ACTION LIBRARY (MVP ĐÃ IMPLEMENT 2026-08-10, theo duyệt):**
- **Action Library = shared asset**: `src/codegen/ActionLibrary.js` + `data/action-library.json` (độc lập workspace). `POST /library` (lưu, label bắt buộc), `GET /library` (kèm usage **derive từ bindings mọi workspace** — KHÔNG lưu usedByTestCases), `POST /testcases/:id/library/blocks` (dùng từ Library).
- **Không migration block cũ** — compatibility: block workspace vẫn dùng; chỉ đưa vào Library khi tester chủ động `[Lưu vào thư viện]` (UI nút đổi nhãn từ "Lưu để dùng lại").
- **Không tự lưu mọi đoạn** — chỉ lưu khi tester bấm.
- Generate/`bindingDto`/`toItem`/listRecordings dùng `resolveBlock` (workspace → Library fallback cho `LIB-*`).
- **Case ĐVT kiểm chứng** (`automation-v3-library-test.js` PASS): 1 recording → 4 block → lưu Library (thiếu label 400) → TC Sửa compose `Login→Open→Search→Edit→Search` (Search lặp 2, usage derive = 2) → Generate spec đúng thứ tự → **workspace khác + reload vẫn dùng lại Library** (persisted).
- Automation UX: `[Dùng thao tác đã có]` ưu tiên (mở Library), `[Tạo từ bản ghi Playwright]` phụ; cut-many giữ.
- Chưa AI (Recording Analysis để sau khi manual flow PASS trên UI thật). Regression 13/13 PASS + build OK.

**BOUNDARY — CODEGEN ↔ ACTION LIBRARY ↔ AUTOMATION (2026-08-10, DESIGN — CHỜ DUYỆT, CHƯA CODE):**
- Chốt kiến trúc chuẩn: Codegen (công cụ độc lập) ↔ Automation Workspace (theo testcase) — **không phụ thuộc bắt buộc**, chỉ **chia sẻ tài sản** qua **Action Library / Recording Library**. Foundation RECORD ONCE → CUT MANY (`e128d7e`) là nền móng Library.
- Trace boundary: recording/parser/store đã dùng chung ✅; **actionBlocks[] hiện nằm TRONG workspace — chưa có Action Library dùng chung** (thiếu chính).
- Đề xuất: tách `ActionLibrary` (tài sản chung, snapshot; workspace chỉ tham chiếu blockId + migrate adapter cho block cũ) · Codegen UI độc lập (record/dán/[Phân tích bản ghi] sau này → lưu Library) · Automation UX chính = `[Dùng thao tác đã có]` (Library) / `[Tạo từ bản ghi Playwright]` khi cần.
- Case Đơn vị tính reference: 1 recording → 6 thao tác → Library → compose TC Thêm/Tìm/Sửa (Sửa: Tìm→Sửa→Tìm) không record lại.
- Docs: `V3_CODEGEN_AUTOMATION_BOUNDARY_DESIGN.md` + `v3-codegen-automation-boundary-wireframe.md` (3 màn A Codegen / B Library / C Automation). AI chưa code — chỉ [Phân tích bản ghi] gắn ở Codegen (contract đã có).

**UNIT TYPE — RECORDING COMPOSITION + AI CONTRACT (2026-08-10):**
- **Manual foundation ĐÃ IMPLEMENT:** RECORD ONCE → CUT MANY (panel giữ recording sau xác nhận — "Đoạn đã lưu từ bản ghi này" + [Xong] + `[+ Lấy thêm từ bản ghi]` không paste lại) · **Repeated D→E→D** (bindBlockToTestCase bỏ unique; reorderBinding multiset giữ occurrence trùng; unbind theo order xóa đúng 1; Generate giữ thứ tự) — test I workflow-test PASS · Assertion per block giữ đúng (6C.2).
- **AI CHỈ DESIGN (chưa code/gọi Gemini):** `docs/V3_RECORDING_COMPOSITION_AI_CONTRACT.md` — contract Recording Analysis (proposals: suggestedName/startStep/endStep/evidence/recordedAssertions/confidence/insufficientEvidence; AI PROPOSAL ≠ PERSISTED; chỉ tester confirm mới tạo block) + Composition Analysis (suggestedSequence/evidence; chỉ tester [Áp dụng] mới ghi binding) + prerequisite suggestion (chỉ gợi ý) + 2 tầng AI tách biệt + wireframes + guardrails.

**VALIDATION — ĐƠN VỊ TÍNH (2026-08-10, trace + wireframe — CHƯA CODE):**
- Trace thật (docs/V3_UNIT_TYPE_VALIDATION.md): backend cho 1 recording → nhiều block (cùng recordingId); **UI KHÔNG continue-cutting** (reset recording sau mỗi lần lưu) — UX P0 của checkpoint; **binding chặn cùng blockId 2 lần** (D→E→D chưa support — cần nới guard bindBlockToTestCase + fix reorderBinding với duplicate); **recorded assertion per block ĐÚNG** (3 block/3 expect khớp từng cái); **không có khái niệm prerequisite** (chỉ đề xuất gợi ý UI nhẹ, không dependency engine).
- Kết luận: model 6B/ActionBlock/binding.sequence KHÔNG cần thay — chỉ nới unique blockId + UI giữ recording để cắt tiếp + gợi ý prerequisite. Wireframe 4.1/4.2 trong doc. Files dự kiến sửa nếu duyệt: AutomationWorkspace.js, GenerateService.js (check duplicate), V3ActionSetupPanel.jsx, utils, tests.

**P0 — DRAWER TESTCASE CONTEXT MISMATCH (ĐÃ TRIỂN KHAI 2026-08-10):**
- Root cause: drawer nhận `testCase={drawerTestcase}` (object snapshot set khi mở drawer); khi user chuyển testcase khác (card) trong lúc drawer mở / refresh workspace, `drawerTestcase` không cập nhật → drawer giữ testcase cũ (TC005 trong khi card TC001).
- Fix: drawer chỉ giữ **`drawerTestCaseId`** (id); `drawerTestcase` được **derive mỗi render từ `workspace.items`** (active workspace) theo id → mọi tab (Thông tin/Thao tác/Kết quả mong đợi) + Generate đều dùng đúng testcase hiện tại. Không còn setDrawerTestcase(object).
- Test: ui-test asserts (drawerTestCaseId, derive từ workspace.items, không setDrawerTestcase object). Regression 12/12 PASS + build OK.

**P0 — WORKSPACE LIFECYCLE / IDENTITY (ĐÃ TRIỂN KHAI 2026-08-10):**
- Root cause (trace): browser localStorage `qa-copilot.automation.workspaceId` chỉ giữ 1 id; "Tạo workspace mới" + upload JSON = implicit context switch (handleCreated luôn tạo workspace mới + ghi đè localStorage) → tester mất workspace chứa automation mà không biết.
- Fix (frontend-only): (A) active workspace giữ ổn định khi reload/drawer/select (không đổi) · (B) "Tạo workspace mới" có data → confirm "Bạn sắp chuyển sang workspace mới. Dữ liệu workspace hiện tại vẫn được lưu." [Hủy]/[Tạo workspace mới] · (C) header "Automation Workspace · module · N testcase · Đã lưu" (raw workspaceId chỉ title/debug) · (D) danh sách **workspace gần đây (tối đa 5)** trong header (select) → chuyển về workspace cũ (recovery tối thiểu, không workspace manager lớn) · (E) không tự tạo workspace ngoài flow user.
- Test: ui-test thêm asserts P0 (Đã lưu, Workspace gần đây, confirm new_workspace, switchWorkspace, shortWorkspaceId). Regression 12/12 PASS + build OK.

**6C — UX CORRECTION (ĐÃ TRIỂN KHAI 2026-08-10 theo wireframe đã duyệt `docs/v3-automation-composition-wireframe.md`):**
- **Mental model:** TESTCASE → THAO TÁC → KẾT QUẢ MONG ĐỢI/ĐIỀU KIỆN XÁC NHẬN → SINH AUTOMATION.
- Card: primary `[Tạo Automation] / [Tiếp tục Automation] / [Xem Automation]` + hiển thị Expected Result + "Thao tác: n đã xác nhận".
- Drawer: tab **"Thao tác"** (V3ActionSetupPanel) giữ header context TC; tab Recording + Kết quả mong đợi (5C) giữ nguyên.
- Panel Thao tác: `[Dán bản ghi Playwright]` / `[Dùng thao tác đã có]` → dán → `(•) Dùng toàn bộ` (mặc định) / `( ) Chọn một phần` (Start/End dropdown + preview "Đã chọn bước x → y · n thao tác") → `[Xác nhận thao tác]` (tạo block PRIVATE + confirm + bind — ẩn thuật ngữ) → "Thao tác sẽ chạy" + `[+ Thêm thao tác]` (bấm mới hỏi nguồn) + ↑↓ + `[Lưu thao tác để dùng lại]` (tùy chọn; REUSABLE bắt buộc tên) + library "Đang dùng bởi N testcase".
- Backend bổ sung: `GET /workspaces/:id/blocks` (listBlocks + reverse dependency). API client: listBlocks/createBlock/updateBlock/confirmBlock/deleteBlock/getBlockUsage/getBinding/bindBlock/unbindBlock/reorderBinding.
- KHÔNG Test Data (checkpoint riêng); KHÔNG AI; KHÔNG Runner; KHÔNG function compiler.
- Test: ui-test cập nhật cho 6C (card primary, panel, drawer tab, API) + action-block-test 6B cover A–G. Regression 10/10 PASS + build OK.

<hr>

**6C — WIREFRAME (đã duyệt, tham khảo):**
- **Mental model duy nhất:** TESTCASE → THAO TÁC → KẾT QUẢ MONG ĐỢI / ĐIỀU KIỆN XÁC NHẬN → SINH AUTOMATION. Tester không cần biết ActionBlock/Binding/Segment/PRIVATE/REUSABLE.
- **5 màn hình:** A card testcase (primary `[Tạo Automation]/[Tiếp tục Automation]/[Xem Automation]`) · B chọn nguồn (`[Dán bản ghi Playwright]` / `[Dùng thao tác đã có]`) · C dùng toàn bộ hoặc chọn một phần (Start/End dropdown + preview rõ) · D danh sách thao tác + reuse tùy chọn (`[Lưu thao tác để dùng lại]`; library "Đang dùng bởi N testcase") · E Expected → Đề xuất → Nháp → Xác nhận → `[Sinh automation]` (đủ gate).
- Header testcase giữ ở mọi bước; nested function (Thêm ĐVT/Thêm KH) chỉ là thao tác bên trong TC chính; ↑↓ sắp thứ tự, không tự reorder.
- **Test Data KHÔNG xuất hiện ở 6C** (checkpoint riêng sau).
- 3 case A/B/C minh họa trong wireframe mục "3 CASE MINH HỌA".
- **Canonical:** `RecordingSession (raw/evidence) → ActionBlock (SNAPSHOT steps, workspace-level) → TestCaseAutomationBinding (entry.binding.sequence [{blockId, order}])`.
- ActionBlock: `blockId, workspaceId, sourceRecordingId, label, scope PRIVATE|REUSABLE, kind SETUP|ACTION, steps (SNAPSHOT copy), sourceRange, status DRAFT|CONFIRMED, version, hash, timestamps`. REUSABLE bắt buộc label. Sửa block → DRAFT + version++.
- Binding: sequence do tester sắp (KHÔNG tự reorder; SETUP chỉ metadata). Block lưu ở **workspace** (`workspace.actionBlocks[]`) — xóa raw recording không ảnh hưởng snapshot.
- **Reverse dependency:** `getBlockUsage(blockId)` derive từ bindings → `testCaseIds[]` (deterministic, test được).
- **Compatibility:** Segment 5C là **legacy input** — `migrateLegacySegments()` (idempotent per-entry) chuyển segment → PRIVATE block + binding khi đọc. Legacy 5B (recording gắn testCaseId) vẫn chạy qua fallback. KHÔNG còn hai nguồn sự thật cho Generate — Generate đọc binding → block snapshot.
- **Generate contract:** binding.sequence → block snapshot steps → confirmed assertion → Renderer (flat spec như cũ, chưa function compiler).
- **API mới:** POST/PATCH/DELETE /blocks, POST /blocks/:id/confirm, GET /blocks/:id/usage, GET/POST /binding, POST /binding/blocks, DELETE /binding/blocks/:blockId, POST /binding/reorder.
- **Test mới:** `tests/automation-v3-action-block-test.js` (A private · B snapshot khi xóa recording · C reuse + reverse dep + không tự bind · D assertion khác nhau cùng block · E order B→A · F legacy segment migrate · G nested 5 block). Regression 10/10 PASS + build OK.
- **Đã cập nhật:** record-mapping-test + assertion-test sang canonical block/binding (compatibility segment giữ ở action-block-test F).

### Bước 7 — Test tích hợp end-to-end
- Nối toàn bộ workspace → record → approve → assertion → generate → run.
- Regression toàn bộ + server boot + tree clean.

### Backlog (đã ghi ở docs/backlog.md)
- **RECORDER_INTEGRATION** — start Playwright CodeGen, quản lý PID, stop, tự đọc source, xử lý recorder đóng bất thường. **KHÔNG làm trong 5C.**

### Ước lượng thời gian còn lại (tham khảo)
- Bước 5C: ~2–3 ngày · Bước 6 (Run): ~1–1.5 ngày · Bước 7 (test tích hợp): ~1.5 ngày + buffer 20–30%.

---

## 5. CONTRACT CHÍNH (để làm tiếp không lệch)

### Renderer (renderV3Spec)
Input: `{ testCase, testcaseRecording, setupRecording?, confirmedTestData, confirmedAssertions, approvedTestData, approvedBy?, approvedAt? }`
Output `RendererResult`:
```
{
  code,
  runtimeEnv: { "<KEY>": { value, source } },
  validation: {
    recording: { approved, hashValid, versionValid },
    spec: { syntaxValid, assertionValid, bindingValid }
  },
  metadata: { recording: { id, version, hash, approvedBy, approvedAt } }
}
```
- `renderStep` stateless → `{ line, runtimeEnv, diagnostics }`.
- `pickLatestApproved(recordings)` chọn latest APPROVED.
- Data resolve priority: EMPTY > USER_CONFIRMED > APPROVED_JSON > CODEGEN_RECORDED > ENV_FALLBACK > MISSING.

### GenerateService.generate({ workspaceId, testCaseId, approvedTestData, confirmedTestData, confirmedAssertions, setupRecordingId? })
→ ghi file + cập nhật workspace GENERATED. Trả `{ ok, code, runtimeEnv, validation, metadata, outputPath }`.

### API `/api/automation-v3` (đã có)
- Workspace: POST /workspaces, GET /workspaces/:id, POST .../testcases/:id/select|unselect
- Recording: POST /recordings/start|stop, POST /recordings/:id/approve|reject, GET /testcases/:tc/recordings, GET /recordings/:id (detail), GET /recordings/:id/source (lazy), DELETE /recordings/:id
- Assertions: POST .../assertions, PATCH .../assertions/:id/confirm|reject, DELETE .../assertions/:id
- Generate: POST .../testcases/:id/generate
- Error contract: `{ success:false, errorCode, message, details }` — KHÔNG stack trace. Các errorCode đã định nghĩa trong V3_ERRORS.

### Ghi chú quan trọng (5B)
- UI **chưa điều khiển Playwright Recorder thật** — mới "dán source" và gắn với testCaseId. Nhãn dùng "Gắn bản ghi testcase" / "Nhập xong", panel "Dán mã Playwright đã ghi cho TCxxx". Không dùng "Đang ghi" (gây hiểu nhầm).

---

## 6. MỨC XÁC MINH (TRUNG THỰC — nói rõ khi báo cáo)
- Sandbox **không có Chromium/Gemini** → xác minh bằng **logic thuần + static contract + backend HTTP (stub) + build**. Chưa chạy E2E browser thật.
- Phần nào chỉ verify tới mức stub/test thì **nêu rõ**.

---

## 7. VẬY BƯỚC ĐẦU TIÊN CỦA CHAT MỚI LÀ GÌ?
1. `git worktree add /tmp/wt-v3 arena/automation-record-by-testcase` — HEAD sẽ là commit mới nhất của nhánh (xác minh bằng `git log -1`; đừng so hash cố định vì mỗi lần cập nhật docs HEAD lại đổi).
2. Cài deps (mục 1).
3. Đọc `docs/V3_HANDOFF.md` + `docs/backlog.md` + `docs/DESIGN_RECORD_MAPPING.md` (+ `docs/DESIGN_ASSERTION_CONFIRMATION.md` khi làm assertion).
4. **Bước 6.5 — Architecture Correction (checkpoint 6A → 6B → 6C → 6D):** đọc `docs/V3_AUTOMATION_COMPOSITION_DESIGN.md` (mục 9 lộ trình) + `docs/v3-automation-composition-wireframe.md` (mục 8 = 6 quyết định chốt). Mỗi checkpoint: code phạm vi hẹp → regression + build → commit + push → `git ls-remote` → **STOP chờ người dùng duyệt** (không tự sang checkpoint kế).
5. 6A = chỉ fix BUG 1 (drawer recording qua refs) + BUG 2 (expectedResult payload). 6B = data model. 6C = UX. 6D = verify 3 workflow thật.
