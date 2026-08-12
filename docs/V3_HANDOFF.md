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

**P0 — AI PROPOSAL KHÔNG CÀ GIẬT + TEXT SPACING (ĐÃ FIX 2026-08-12, fix tối thiểu):**
- **14 — Root cause cà giật (trace đủ):** (1) `[Bỏ]` cũ `setProposals(prev => prev.filter(...))` — thay TOÀN BỘ mảng → re-render cả list, số `Gợi ý i/N` đổi, các card dịch chuyển; (2) key card = `${start}-${end}-${idx}` — idx (trong trang) đổi khi bỏ 1 card → React **remount từng card còn lại**; (3) KHÔNG gọi lại analyze (chỉ set state) và KHÔNG reset proposalPage — nhưng 2 nguyên nhân trên đủ gây nhảy scroll/flash. **Fix:** `[Bỏ]` (split) = trạng thái `dismissed` (mảng `dismissedProposals` — KHÔNG filter, `proposalStatus` nhận thêm arg) → nút `[Đã bỏ]` disabled; `[Thêm thao tác]` disable khi dismissed; **key = `${start}:${end}` ổn định**; fallback drawer giữ filter cũ (Automation path không đổi).
- **15 — Spacing:** label `Điều kiện kiểm tra:` là inline span → dính `Điều kiện kiểm tra:Không có thông tin...`. **Fix tại presentation:** class `v3-act__verif-label` (`display:block; margin-bottom:4px`) — áp cả case A (không assertion → message tách dòng) và case B (label rồi danh sách assertion block). KHÔNG chèn space vào data.
- **Test mới `tests/automation-v3-proposal-stability-test.js`:** dismissed là trạng thái (proposal vẫn trong mảng); split không còn filter; key ổn định; Thêm/Bỏ không gọi AI + không reset page (setProposalPage(0) ≤ 1 lần = reset recording); label class + CSS block; case A/B spacing. Regression 26/26 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0 — ACTION LIBRARY GROUPING V1 (ĐÃ IMPLEMENT 2026-08-12, baseline 6bb2920, theo design đã duyệt):**
- **Data model (schema changed):** `ActionLibrary` block thêm `groupName: string|null` (addBlock nhận + persist; updateBlock PATCH groupName KHÔNG reset CONFIRMED — metadata tester-owned). KHÔNG hierarchy module→feature→group; KHÔNG database; tiếp tục file-based.
- **API (tối thiểu):** `POST /api/codegen/library` nhận `groupName` (trim → null nếu rỗng) → persist + response trả; `GET /api/codegen/library` trả `groupName`; `AutomationWorkspaceApplicationService.blockDto` thêm `groupName` (Automation path reuse sau này — KHÔNG sửa Automation UI).
- **Existing data:** block cũ không có groupName → `null` → presentation `Chưa phân loại` (helper `libraryGroups.js` `groupDisplayName`/`groupLibraryActions` — nhóm theo thứ tự xuất hiện, "Chưa phân loại" luôn cuối; KHÔNG migration theo label; KHÔNG đổi blockId → LIB-* binding giữ).
- **Tester ownership:** field `Chức năng` (input + datalist từ các group đã có — chọn/nhập mới) trong form; `currentGroup` giữ default qua các action trong phiên; AI proposal `[Thêm thao tác]` dùng `currentGroup` (AI KHÔNG tự quyết định/persist group); manual confirm cũng dùng; save Library gửi `groupName: seg.groupName`.
- **Library UI:** thay flat list bằng grouping — `▸ Group · N thao tác` collapsed mặc định; click mở 1 group → actions (label + meta + [Xem][Xóa] + confirm inline P0-2 giữ); delete → count derive, group rỗng tự biến mất; sau save → mở group chứa action mới. **BỎ pagination phẳng Library** (grouping là primary scale; pagination proposals giữ nguyên).
- **Test mới `automation-v3-grouping-test.js` (A–H):** A create persist groupName; B list trả groupName + block không group → null; C presentation "Chưa phân loại" không mất block; D 2 groups count đúng (2/3); E group rỗng biến mất; F blockId LIB-* không đổi; G/H regression library-sync + semantic-draft vẫn PASS. Cập nhật pagination-test (C/D → grouping), ai-flow-test (signature), grouping-layout-test (đảo assert: grouping đã implement). Regression 25/25 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**CHECKPOINT — V3 CODEGEN UX + ACTION LIBRARY SCALE (2026-08-12, baseline 2bc963d):**
- **P0-1 Semantic verify: PASS** — runtime mô phỏng đúng case cũ→mới (Mở trang /wasuco/login, Click vào ô Tài khoản, Nhấn phím Tab tại ô, Click nút Đăng nhập; KHÔNG expose password/value); formatter `semanticStepText` dùng THỐNG NHẤT 4 nơi (Draft, I. BẢN GHI renderSteps, Start/End dropdown STEP_LABEL, Library Xem renderSteps). Không sửa gì thêm.
- **P0-2 Draft verify: PASS** — semantic-draft-test J–P + isolation-test vẫn PASS (paste không auto-commit; AI chỉ sau Nhập xong; xóa step → raw source đổi; A→B không rò; Library không reset). Không viết lại.
- **P0-3 Grouping — TRACE: DỪNG chờ duyệt (design only):** Library block KHÔNG có module/feature/group/context; recording `context` chỉ có khi start từ AI Test Design (paste path null) và block KHÔNG copy context → KHÔNG có metadata tin cậy để group "Đơn vị tính/Kho/Thiết bị". **Không implement** (đúng yêu cầu). Đề xuất schema trong `docs/V3_ACTION_LIBRARY_GROUPING_DESIGN.md`: `group { module, feature }` optional trên block + prefill từ recording context (gợi ý, tester quyết) + block cũ → `(Chưa phân loại)` + migration không tự động.
- **P0-4 Duplicate analysis (đã trace, KHÔNG dedupe):** `ActionLibrary.hash = sha256(steps+assertions+range+label+kind)` là detector đáng tin: cùng steps (recording khác) → SAME hash = duplicate thật; cùng label khác steps → khác hash (chỉ trùng tên); cùng steps khác assertion → khác hash (giữ cả 2). Đề xuất: badge `⚠ Trùng nội dung` + tester quyết [Xóa] (chưa implement).
- **P1 Layout (đã implement, CSS tối thiểu):** `.codegen-page` bỏ `max-width: 1000px` → full content width (.page giới hạn sẵn ~1180) — tận dụng ~90% desktop; grid split 60/40 (`3fr/2fr`) + media <860px 1 cột giữ nguyên. Không đụng màu/nav/typography.
- **P1 Grouping reuse (design only):** schema `group` ở mục P0-3 thiết kế để Automation sau này chọn Chức năng → Action; KHÔNG sửa Automation workflow checkpoint này.
- Test mới `automation-v3-grouping-layout-test.js` (P0-4 hash 3 case + P1 static + grouping chưa implement). Regression 24/24 PASS + build OK. **DỪNG — chờ tester duyệt schema grouping (docs design) + kiểm layout thật.**

**P0 — RECORDING DRAFT REVIEW + SEMANTIC READABLE STEPS (ĐÃ IMPLEMENT 2026-08-12, không AI/backend/Automation):**
- **SEMANTIC ROOT CAUSE:** UI chỉ dùng ACTION_LABEL (động từ chung "Phím"/"Bấm") + target (accessible name) → mất ngữ cảnh role type/key/URL path. "Phím" = PRESS→"Phím" + UI không hiển thị recordedValue (key Tab); "Mở trang · Mở trang" = GOTO target fallback "Mở trang" + URL nằm trong recordedValue không hiển thị. Parser ĐÃ lưu đủ (locator full, recordedValue, sensitive) → **không migration Library**.
- **Formatter dùng chung `web-ui/src/utils/semanticSteps.js`** (`semanticStepText`): GOTO → `Mở trang <path>`; CLICK → `Click nút X` (button) / `Click vào ô X` (textbox) / `Click vào X` (fallback không invent); FILL → `Nhập giá trị vào ô X` (KHÔNG expose value, kể cả không nhạy cảm); PRESS → `Nhấn phím Tab tại ô X`; CHECK/UNCHECK → `Chọn/Bỏ chọn checkbox X`; SELECT → `Chọn giá trị tại X`; HOVER → `Di chuột vào X` (parser THÊM hover tối thiểu — trước đây không bắt). Assertion vẫn tách riêng (không thành action). Mọi UI (renderSteps Recording/Library Xem/dropdown Start-End/Draft) dùng CHUNG semanticStepText.
- **DRAFT REVIEW (workflow UX):** `doParse` giờ chỉ lưu DRAFT (draftSteps/draftAssertions/draftRecordingId) — **KHÔNG setSteps** → không auto-commit canonical. UI: textarea editable → `BẢN NHÁP PLAYWRIGHT · N thao tác được phát hiện` (semantic list + `[Xóa]` từng step) → `[Nhập xong]` (`confirmDraft`: setSteps/setAssertions/setRecordingId + init analysis workspace) → split workspace. AI chỉ render sau gate (draft branch không có AI). Sửa source → reparse draft (P0-1 isolation giữ; Library không đụng).
- **Xóa bước thừa (evidence an toàn):** `web-ui/src/utils/draftSource.js` `removeStepFromSource` xóa CẢ DÒNG chứa step (CodeGen 1 statement/dòng; sourceStart/End/Line đủ) → parse lại → UI + raw source ĐỒNG BỘ. **Guard:** dòng chứa >1 statement → trả null (chặn xóa, không invent rewrite; nút disable + title giải thích).
- **Test mới `tests/automation-v3-semantic-draft-test.js` (A–P):** semantic A–I (goto path, ô/nút, press Tab, password không expose, fallback an toàn, dùng chung formatter, assertion riêng) + draft J–P (parse không setSteps; Nhập xong commit; reset không rò A→B; AI không ở draft; Library không reset; xóa step → source mất dòng + parse lại; guard 2 statement). Cập nhật ui-test + isolation-test (`initializeAnalysisFromSteps(draftSteps)`). Regression 23/23 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0 — WORKING ACTION ↔ LIBRARY STATE DESYNC SAU DELETE (ĐÃ FIX 2026-08-12, fix tối thiểu):**
- **Root cause (trace 5 câu):** (1) persisted marker = `seg.blockId` (`LIB-*` sau save, `WORK-*` chưa lưu); (2) `doDeleteLibrary` chỉ `setLibrary(filter)` — working action vẫn giữ `LIB-*` cũ; (3) `saveAllToLibrary` skip mù theo prefix `startsWith("LIB-")` — không kiểm tra block còn tồn tại trong Library → action đã xóa bị skip, không recreate; (4) message dùng `saved.length` = toàn bộ working (giả) dù 0 API create; (5) API không được gọi (skip) → không 404, nhưng Library kẹt thiếu.
- **Fix:** helper thuần `web-ui/src/utils/librarySync.js` — `planLibrarySave(working, libraryList)` reconcile theo **canonical Library state**: skip CHỈ khi `LIB-*` còn tồn tại trong list; `LIB-*` đã bị xóa → coi là CHƯA lưu → tạo lại (nhận LIB id mới). `saveAllToLibrary` (split): `await refreshLibrary()` → plan → create từng action trong `toCreate` → `setConfirmed` cập nhật blockId mới → `setSaveFeedback({ count: persistedCount, total })` → message `✓ Đã lưu N thao tác mới vào Thư viện.` (N = persist THẬT) / 0 → `✓ Tất cả X thao tác đã có trong Thư viện.`; `onSavedToLibrary(persistedCount)`.
- **Test mới `tests/automation-v3-library-sync-test.js` (A–G):** A working 3 (WORK-*) + library 0 → toCreate 3; B/C working 3 + library 3 → toCreate 0, delete 1 → library 2; D save lại → toCreate 1 (LIB-A) + alreadySaved 2; E action recreate nhận blockId mới từ API; F message dùng persistedCount (không confirmed.length) + render phân nhánh; G LIB-B/LIB-C không bị tạo duplicate. Cập nhật ai-flow-test + ui-test (bỏ assert startsWith("LIB-") → planLibrarySave). Regression 22/22 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0-3.3 — LIBRARY REFRESH + PAGINATION + AI VERIFICATION VISIBILITY (ĐÃ IMPLEMENT 2026-08-12, không AI/backend/Automation):**
- **Library refresh (root cause):** `saveAllToLibrary` (split) setShowLibrary(true) + feedback nhưng KHÔNG setLibrary/refresh → section mở nhưng state library vẫn [] → "Thư viện chưa có thao tác nào." dù save thành công. Fix: sau persist từng action → **`await refreshLibrary()`** (reuse listLibrary → setLibrary; refreshLibrary giờ trả list) → Library cập nhật NGAY cùng màn hình, không F5/không đóng mở, không cache thứ hai.
- **Pagination AI proposals:** thay slice cứng bằng paginate (page size 5) — `‹ Trước X / N Sau ›`; CHỈ đổi item hiển thị; added/blocked là derived từ `confirmed` → giữ nguyên khi đổi trang (test B); KHÔNG gọi lại AI khi đổi page (setProposalPage thuần).
- **Pagination Library:** page size 10, độc lập với proposals — `Trang X / N` + [Trước][Sau]; **ordering trace:** backend `actionLibrary.list()` giữ thứ tự push (cũ→mới) → sau save refresh + **nhảy trang cuối** (thấy item mới ngay); xóa item ở trang cuối → `setLibPage(clampPage(prev, len-1, SIZE))` tự normalize trang rỗng.
- **AI proposal — Điều kiện kiểm tra:** mỗi proposal hiển thị verification scoped đúng range qua helper thuần `scopedAssertionsInRange` (tách từ rule manual — reuse, không backend); có assertion → `✓ readable + [Xem kỹ thuật]`; không assertion → `Không có thông tin xác nhận trong đoạn này.` (không để trống, không hiển thị ngoài range).
- **Test mới `tests/automation-v3-pagination-test.js` (A–F):** A save→refreshLibrary; B 8 proposals→2 trang, add page1→state giữ khi đổi trang, không gọi AI; C 12 library→2 trang; D clampPage normalize trang rỗng; E scoped assertion đúng range (1-2 chỉ có X, 5-6 chỉ có Y); F range không assertion → rỗng + message. Cập nhật ai-proposals-test (paged.items.map). Regression 21/21 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0 — AI PROPOSAL LIST MẤT 4/5, 5/5 (ĐÃ FIX 2026-08-12, fix tối thiểu):**
- **Root cause (trace đủ 5 câu):** backend `/api/codegen/analyze` trả ĐỦ proposals (chỉ filter range hợp lệ `Number.isInteger` — không giới hạn số lượng); frontend state `proposals.length` = đủ; nhưng JSX render dùng **`proposals.slice(0, 3)`** → hard limit 3 → UI chỉ thấy `Gợi ý 1/5, 2/5, 3/5` (nhãn i/N dùng `idx+1`/`proposals.length=5`) rồi nhảy sang HOẶC TỰ TẠO, 4/5 và 5/5 bị cắt. CSS `.v3-act__proposals` không max-height/overflow/clipping; `proposalStatus`/`handleAddProposal` KHÔNG filter proposal khỏi list (proposal đã thêm vẫn hiện "Đã thêm" — đúng thiết kế P0-3.2).
- **Fix:** bỏ `slice(0, 3)` → `proposals.map(...)` render TOÀN BỘ. KHÔNG sửa Gemini/prompt/backend (response đã đủ 5).
- **Test mới `tests/automation-v3-ai-proposals-test.js`:** static (không còn `proposals.slice(`) + logic: 5 proposals → add 1,2,3 → 4/5,5/5 vẫn `added=false, blocked=false` (visible + add được) → add tiếp → working = 5 đúng thứ tự; 1,2,3 vẫn `added=true`. Regression 20/20 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0 — SAVE CURRENT PLAYWRIGHT RECORDING (ĐÃ IMPLEMENT 2026-08-12, không Recording Library/Runner/AI):**
- **Root cause "Tải/Lưu script" cũ không hoạt động:** `CodeGenRecordingStore.sanitize()` **loại bỏ `scriptContent` khỏi list DTO** (chỉ giữ `hasScript`) → `CodeGenPage.active = recordings[0]` có `scriptContent = undefined` → card "Công cụ kỹ thuật" luôn báo "Chưa có script trong bản ghi hiện tại." và Copy/Save không làm gì. Ngoài ra `recordings[0]` = recording CŨ NHẤT (P0-1 tạo recording mới mỗi lần parse) — còn trỏ nhầm recording.
- **Canonical source:** state `source` trong `V3RecordingPreparationPanel` — raw Playwright duy nhất (record/paste đều đổ vào; "Xem mã Playwright ▾" đã đọc đúng). Copy/Save giờ đọc CHÍNH `source` này; KHÔNG tạo state thứ hai, KHÔNG dùng legacy `active.scriptContent`.
- **UI:** bỏ card "Công cụ kỹ thuật" cuối CodeGenPage (kèm dead handlers handleCopyScript/handleSaveFile/handleRun/runResult/cụm link legacy). Panel thêm utility row `[Sao chép mã] [Lưu bản ghi Playwright]` (compact, cạnh "Xem mã Playwright", cả split lẫn fallback) — chỉ render khi recording tồn tại (`steps.length > 0`); empty state không báo nhầm. File: `playwright-recording-<timestamp>.js` (util thuần `web-ui/src/utils/recordingFile.js`).
- **Tách biệt Recording vs Action Library:** Lưu bản ghi = download local raw source; KHÔNG đụng `createLibraryAction`/Library (CASE 3). P0-1 isolation giữ (A→B → source=B).
- **Test mới `tests/automation-v3-save-recording-test.js`:** CASE 1 (copy/save đọc `source`), CASE 2 (không state thứ hai, A→B qua isolation), CASE 3 (không gọi Library API), CASE 4 (utility render có điều kiện, bỏ message "Chưa có script…"). Regression 19/19 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0-3.2 — RÚT GỌN FLOW AI → TẠO THAO TÁC (ĐÃ IMPLEMENT 2026-08-12, không AI/Runner/backend/Automation):**
- **Vấn đề UX:** flow cũ "Dùng gợi ý → đổ xuống form HOẶC TỰ CHỌN → Xác nhận thao tác → THAO TÁC ĐÃ TẠO → Lưu Library" khiến tester xác nhận cùng quyết định 2 lần; hơn nữa `createConfirmedAction` cũ **persist Library NGAY khi confirm** (vi phạm Library gate).
- **Tách HAI ĐƯỜNG SONG SONG (splitLayout/CodeGen):**
  - **FLOW AI:** proposal (tên là chính, `Gợi ý i/N` nhỏ, meta `Bước X → Y · N thao tác`, Evidence) → `[Thêm thao tác]` → `handleAddProposal` → `addWorkingAction` → **THẲNG vào THAO TÁC ĐÃ TẠO**; KHÔNG populate form, KHÔNG xóa proposal khỏi list (tester chọn tiếp), KHÔNG tự persist. Proposal đã thêm → `✓ Đã thêm` / disabled `[Đã thêm]`; xóa action khỏi working set → proposal trở lại `[Thêm thao tác]`.
  - **FLOW THỦ CÔNG:** `HOẶC TỰ TẠO` (đổi từ HOẶC TỰ CHỌN) → Tên → Start/End → ĐOẠN ĐANG CHỌN → `[Xác nhận thao tác]` → working set (split: KHÔNG persist ngay).
  - **Library gate:** `saveAllToLibrary` (split) giờ **persist từng working action** qua `createLibraryAction` + `onConfirmedSegment` (no-op CodeGen) + skip `LIB-*` (không duplicate khi Lưu lần 2); nút đổi thành `Lưu {N} thao tác vào Thư viện`.
- **Helper thuần mới `web-ui/src/utils/workingActions.js`:** `appendWorkingAction` (functional-update, chống duplicate cùng range — CASE E), `removeWorkingAction` (CASE F), `proposalStatus` ({added, blocked, overlapLabel}).
- **Fallback drawer (non-split) GIỮ NGUYÊN:** "Dùng gợi ý" → populate form → createConfirmedAction persist + bind ngay (KHÔNG phá Automation workflow).
- **Test mới `tests/automation-v3-ai-flow-test.js`:** CASE A (add trực tiếp, form không populate, proposals khác còn), B (3 working), C (add không persist — chỉ saveAllToLibrary gọi createLibraryAction), D (manual không phá), E (duplicate chặn + overlap), F (xóa → add lại). Regression 18/18 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0 — AI PROVIDER RECOVERY + TEST DESIGN AI TRACE (ĐÃ IMPLEMENT 2026-08-12):**
- **ROOT CAUSE CODEGEN (đã trace + reproduce runtime):** `src/controllers/CodeGenController.js` **KHÔNG có import nào** (file bắt đầu bằng `export default class`). `analyzeRecording` tham chiếu `AIProviderFactory`/`AIConfig` → **ReferenceError** mỗi request → bare `catch { provider = null; }` nuốt lỗi → trả `AI_PROVIDER_UNAVAILABLE` **GIẢ** dù `ENABLE_AI=true, AI_PROVIDER=gemini, GEMINI_API_KEY configured`. Provider thực tế CHƯA BAO GIỜ được tạo. Bug sinh từ commit `b8c5a1e` (thêm analyzeRecording thiếu imports; test cũ chấp nhận UNAVAILABLE trong tập error code nên không phát hiện).
- **FIX (tối thiểu, reuse infra — không tạo provider/config thứ hai):** thêm 2 import `AIProviderFactory` + `AIConfig` vào đầu CodeGenController.js.
- **Bằng chứng runtime (sandbox, .env thật gemini + key):** trước fix → `AI_PROVIDER_UNAVAILABLE`; sau fix → `[Gemini Diagnostic]` + `[Gemini Error]` xuất hiện (provider tạo OK, `generate()` reached, stack: `CodeGenController.analyzeRecording → GeminiProvider.generate`) → response `AI_REQUEST_FAILED` (sandbox chặn TLS đến Google — ECONNRESET; trên máy thật sẽ là proposals>0 hoặc lỗi API thật, KHÔNG còn UNAVAILABLE giả).
- **ROOT CAUSE TEST DESIGN — KHÁC, không cùng gốc:** đường Test Design (AIAnalysisEngine → `AIProviderFactory.create()`) có import đúng; runtime trace: engine invoked → `FallbackAIProvider(GeminiProvider primary + OllamaProvider fallback)` (do `AI_FALLBACK_ENABLED=true`) → generate called → **failure point = provider request** (sandbox: network; máy thật: kiểm `[Gemini Error]` log cho mã lỗi API — nghi key không hợp lệ / model `gemini-3.1-flash-lite` — CHƯA tự sửa vì chưa có bằng chứng từ máy thật). Khi cả 2 provider fail → engine `FALLBACK` (rule-engine) → `clarificationQuestions=0` (fallback chỉ lấy questions từ requirement markdown). Pipeline SAU provider đã được chứng minh đầy đủ: stub provider → parse → artifact.questions → API `clarifications` → UI (ai-analysis-review-http-test PASS).
- **Bảng so sánh 2 path:** CodeGen = createProvider(AIConfig.provider) trực tiếp (thiếu import → UNAVAILABLE giả); Test Design = create() có fallback (infra đúng; fail ở request). SAME ROOT CAUSE? **NO** — CodeGen là bug riêng (thiếu import); Test Design infra vốn đúng, failure point ở provider request.
- **F — REQUIREMENT KNOWLEDGE REGRESSION: PASS** (không sửa gì thêm): requirement-knowledge-clarification-merge-test, scenario-recommendation-confirmed-facts-test, clarification-scenario-testcase-traceability-test, ai-clarification-normalization-test, production-core-workflow-test — toàn bộ PASS (clarification đã approve → merge RequirementKnowledge → Scenario/TestCase dùng confirmed facts).
- **G — REQUEST DUPLICATION (trace only, không fix):** `analyzeRecording(` có ĐÚNG 1 call site (handleAnalyze); apiClient KHÔNG retry; StrictMode không double-fire handler → 1 click = 1 POST theo code. Nhiều request trong DevTools = nhiều click (double-click nhanh trước khi `analyzing` disable kịp / click lặp) — chờ tester xác nhận trên máy.
- Tests: thêm `automation-v3-ai-provider-test.js` (static: controller có import — chặn tái phạm; runtime: gemini+dummy key → KHÔNG UNAVAILABLE, provider chạy thật) + tighten ai-analysis-test (`error.code !== AI_PROVIDER_UNAVAILABLE` khi env default). Regression 17/17 PASS + build OK. **DỪNG — chờ tester kiểm runtime máy thật.**

**P0-3.1 — CODEGEN SPLIT LAYOUT UX CLEANUP (ĐÃ IMPLEMENT 2026-08-12, không feature mới/không Automation):**
- **I. BẢN GHI:** sau parse, raw source KHÔNG chiếm diện tích thường trực — collapse thành `Xem mã Playwright ▾` (details, summary secondary; mở để xem/thay recording — P0-1 isolation giữ nguyên vì textarea vẫn bound `handleSourceChange`). Steps readable trái là nội dung chính, luôn cố định.
- **II. TẠO THAO TÁC:** bỏ dòng "Chọn một phần trong bản ghi để tạo thao tác dùng lại."; giữ hierarchy AI HỖ TRỢ → HOẶC TỰ CHỌN; đổi thứ tự manual: **Tên thao tác → Bắt đầu → Kết thúc → ĐOẠN ĐANG CHỌN → Điều kiện kiểm tra → [Xác nhận thao tác]** (Tên trước Start/End vì recording readable đã cố định trái). Nút AI đổi nhãn `Gợi ý cách chia thao tác`.
- **AI HỖ TRỢ — trace (quan trọng):** UI cũ báo "Không có đề xuất (AI không khả dụng)" vì: (1) đó là generic fallback thuần frontend khi `proposals` rỗng; (2) backend cũ NUỐT mọi lỗi thành `200 + proposals:[] + error:null` — provider unavailable (createProvider throw), request fail (generate throw), response sai định dạng đều không phân biệt được; (3) log "GEMINI_API_KEY: CONFIGURED" chỉ nghĩa env var khác rỗng (startServer.js), không đảm bảo key thật. **Fix:** backend đính lý do tại `body.error` (`AI_PROVIDER_UNAVAILABLE` / `AI_REQUEST_FAILED` (generate fail hoặc text rỗng) / `AI_RESPONSE_INVALID` (JSON sai) / `ANALYZE_FAILED`; `retryable: true`); empty hợp lệ (AI trả JSON đúng nhưng 0 proposal) → `error: null`. Frontend: `aiStatus` inline NGAY trong section AI HỖ TRỢ — empty → "Không nhận được gợi ý. Bạn vẫn có thể tự chọn bên dưới."; fail → "Không thể lấy gợi ý lúc này. [Thử lại]" (compact, KHÔNG full-width red alert; handleAnalyze không còn gọi setLocalError). Reset recording cũng clear aiStatus.
- **Không đổi:** recording trái cố định; Start/End là cách duy nhất chọn range; highlight trái visual; confirm không reset recording; không AI Composition/Runner/Automation workflow; UX đoạn 16–30 bước để checkpoint riêng.
- Tests: ui-test + ai-analysis-test cập nhật (Xem mã Playwright ▾, bỏ note, Tên trước Bắt đầu, ĐOẠN ĐANG CHỌN, aiStatus inline, không setLocalError trong handleAnalyze; backend proposals rỗng → body.error.code thuộc tập đã định nghĩa + retryable). Regression 16/16 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0-3 — CODEGEN WORKSPACE SPLIT LAYOUT (ĐÃ IMPLEMENT 2026-08-12, không AI/Runner/backend):**
- **Mental model:** Recording = NGUỒN CỐ ĐỊNH của cả phiên tạo thao tác; Action = đoạn Start→End lấy từ recording đó. Confirm action KHÔNG đóng/reset/thay thế recording — cắt tiếp từ CÙNG recording (RECORD ONCE → CUT MANY).
- **Layout (CodeGenPage bật `splitLayout`; fallback drawer giữ 1 cột):** parse xong → 2 cột: TRÁI ~60% = `I. BẢN GHI` (textarea nguồn nhỏ + summary `N thao tác · M điều kiện` + steps LUÔN hiển thị, scroll `v3-rec-prep__steps`); PHẢI ~40% = `II. TẠO THAO TÁC` + `THAO TÁC ĐÃ TẠO`. CSS `grid-template-columns: 3fr 2fr`; media <860px → 1 cột.
- **Cột trái chỉ để quan sát/đối chiếu:** KHÔNG checkbox/click/shift-click/multi-select/drag. Chọn đoạn CHỈ qua `Bắt đầu/Kết thúc` bên phải; highlight range = class `v3-step--range` (visual thuần, helper `isStepInRange` đảo start/end vẫn đúng).
- **Panel phải (thứ tự bắt buộc):** `II. TẠO THAO TÁC` → `AI HỖ TRỢ [Gợi ý bằng AI]` (TRÊN manual; proposal chỉ điền Start/End/Tên — tester vẫn bấm Xác nhận) → `HOẶC TỰ CHỌN` (divider) → Bắt đầu/Kết thúc (placeholder "Chọn bước…") → `Đoạn đang chọn` = `Bước X → Y · N thao tác` (split mode KHÔNG duplicate preview steps — đã ở trái; drawer 1 cột giữ preview) → `Điều kiện kiểm tra` → Tên → `[Xác nhận thao tác]` + `[Chọn toàn bộ]` (không button full-width).
- **THAO TÁC ĐÃ TẠO compact:** `Tên · X→Y · N thao tác` + `[Sửa][Xóa]`; BỎ `[Xem]`/expand steps trong danh sách; BỎ nút `+ Tạo thêm thao tác` (form luôn mở); heading bỏ tiền tố "III.". `recordingPrepState`: bỏ `expandedItem` (không còn expand), thêm `isStepInRange`.
- **Ghi nhận (chưa làm, theo yêu cầu):** UX `Đoạn đang chọn` dài 16–30 bước ở drawer 1 cột — checkpoint riêng sau. Không AI Composition; không Runner; không redesign Library; không đụng Automation workflow; không thay backend.
- Tests: ui-test + isolation-test cập nhật (splitLayout/v3-rec-prep__split/2 cột/isStepInRange 9 case/AI HỖ TRỢ/HOẶC TỰ CHỌN/Đoạn đang chọn/không checkbox/không "+ Tạo thêm"/confirm không reset steps-source-recordingId). Regression 16/16 PASS + build OK. **DỪNG — chờ tester kiểm UI thật.**

**P0-1/P0-2 — RECORDING CONTEXT ISOLATION + DELETE CONFIRM CLEANUP (ĐÃ IMPLEMENT 2026-08-12, không AI/Runner):**
- **P0-1 Recording context isolation:** tách helper thuần `web-ui/src/utils/recordingPrepState.js` (`freshAnalysisWorkspace()` = rỗng hoàn toàn; `initializeAnalysisFromSteps(steps)` = start=order đầu, end=order cuối, name/proposals/edit-state rỗng). Panel: `resetRecordingContext()` áp `freshAnalysisWorkspace()` (start/end/name/AI proposals/edit state + analyzing) — **KHÔNG đụng Library**; `doParse` xong áp `initializeAnalysisFromSteps(parsedSteps)` → Phần II initialize LẠI hoàn toàn từ steps mới. **Gen guard** (`parseGen`) chặn async cũ (AI analyze / confirm đang bay) đổ kết quả của recording cũ vào bản mới.
- **Regression test mới `tests/automation-v3-recording-isolation-test.js`:** A(19 bước) → parse → tester làm việc trên A (đổi range/tên/proposals/edit) → thay bằng B(5 bước) → reset → parse B → Phần II CHỈ chứa B (endSel=5 không phải 19; proposals/name/edit rỗng); static contract: reset không gọi setLibrary; component dùng đúng helper.
- **P0-2 Delete confirmation cleanup:** bỏ full-width red box (`v3-lib-delete-confirm` — xóa hẳn CSS); confirm NHỎ cạnh action trong `v3-cond__actions` (`v3-lib-delete-inline`): item chưa dùng → chỉ `[Xóa][Hủy]`; `usedByTestCases > 0` mới hiện `⚠ N testcase đang phụ thuộc` (màu amber, không box). Không modal.
- **Ghi nhận (chưa làm, theo yêu cầu):** `ĐOẠN ĐÃ CHỌN` bung toàn bộ steps + verification — với 16–30 bước sẽ thành cục dài → **xử lý UX checkpoint RIÊNG sau**, không trộn vào lần này.
- Tests: isolation-test mới + ui-test cập nhật (freshAnalysisWorkspace/initializeAnalysisFromSteps/gen guard; v3-lib-delete-inline, không v3-lib-delete-confirm, cảnh báo usage có điều kiện). Regression 16/16 PASS + build OK. **DỪNG — chờ tester kiểm UI thật. Không AI Composition; không Runner.**

**P0 — LIBRARY + AUTOMATION INTERACTION CORRECTION (ĐÃ IMPLEMENT 2026-08-12, không AI/Runner):**
- **1. New recording must reset:** `V3RecordingPreparationPanel` theo dõi `parsedSource`; đổi nội dung textarea → `resetRecordingContext()` (recordingId/steps/assertions/**AI proposals**/Start-End/**name draft**/**working actions**/save feedback) → **TỰ parse lại sau debounce 500ms** (KHÔNG F5). Guard gen → kết quả parse cũ không clobber bản mới.
- **2. Library UI:** item = Tên · N thao tác · N điều kiện kiểm tra · Dùng bởi N testcase · `[Xem]` (expand steps, full width) · `[Xóa]` (confirm inline: báo rõ N testcase đang dùng — không silently delete). Backend: `GET /api/codegen/library` DTO kèm steps/recordedAssertions sanitized; `DELETE /api/codegen/library/:blockId` (404 nếu không tồn tại). CodeGen page bọc panel trong `.codegen-card` (padding khớp, hết dính mép phải).
- **3. Add from Library = MULTI-SELECT batch:** checkbox (picker KHÔNG đóng sau mỗi chọn) + `Đã chọn: N thao tác` + `[Hủy]` / `[Thêm N thao tác]` (bind theo thứ tự chọn). Cùng LIB-* chọn lại nhiều lần → nhiều occurrence (D→E→D); picker hiện "đã có N lần trong testcase (chọn để thêm lần nữa)".
- **4. Tab state (root cause + fix):** effect cũ đọc `binding.length` từ **closure cũ** trong `.then()` → sau remount (chuyển tab) screen rơi về "library" dù binding có action. Fix: `refreshBinding()` trả sequence; quyết định screen từ sequence **vừa fetch**; bỏ double-fetch; reset screen/expanded/selection khi đổi testcase. Canonical = binding.sequence → Library block (fetch lại mỗi mount).
- **5. Bỏ badge "Dùng lại"** khỏi action card (Library block mặc định reusable); provenance chỉ trong `[Xem]`: "Nguồn: Thư viện thao tác".
- **6. Detail layout (root cause):** expanded detail nằm TRONG `.v3-cond__body` (flex row) → action column (nhiều nút) ép body còn ~100px; `overflow-wrap: anywhere` → text rơi từng ký tự dọc. Fix: detail chuyển ra NGOÀI flex row (wrapper `.v3-act__item` grid) → full width; `.v3-cond--compact` thêm `flex-wrap: wrap` (actions xuống dòng khi chật); `.v3-step__act` `flex:0 0 auto`; `.v3-step__loc` `min-width:0`.
- **7. Repeated block:** key item = `${blockId}:${order}` (không đụng key); `[Xóa]` truyền `order` → xóa đúng 1 occurrence; Generate với block đã xóa → 422 SEGMENT_MAPPING_INVALID (gate rõ, không crash).
- Tests: ui-test + library-test mở rộng (reset/auto-parse, delete 404 + generate gate 422, multi-select, bỏ Dùng lại, key composite). Regression 15/15 PASS + build OK. **DỪNG — chờ tester kiểm UI thật. Không AI Composition; không Runner.**

**P0 — CODEGEN UX REDESIGN THEO WIREFRAME (ĐÃ IMPLEMENT 2026-08-10, không thêm feature):**
- Mental model 5 bước: GHI/DÁN → XEM BẢN GHI → CHỌN ĐOẠN → TẠO THAO TÁC → LƯU THƯ VIỆN. AI chỉ là trợ lý tùy chọn bước 3.
- **I. BẢN GHI** (đổi tên từ "PLAYWRIGHT RECORDING"): URL + Trình duyệt + `[Bắt đầu ghi]` + `[Dán bản ghi Playwright]` → summary `N thao tác · M điều kiện kiểm tra` + `[Xem thao tác]` (collapsed; chỉ steps/verification **readable** — KHÔNG raw code; raw ở Công cụ kỹ thuật).
- **II. TẠO THAO TÁC**: mô tả + helper nhỏ `Cần hỗ trợ chia bản ghi? [ Gợi ý bằng AI ]` (secondary, không ✨, không dính câu) → Start/End dropdown → `ĐOẠN ĐÃ CHỌN` (N thao tác · bước X→Y + steps readable) → `Điều kiện kiểm tra trong đoạn` (scoped) → Tên → `[Xác nhận thao tác]` (align phải). Spacing rõ giữa các khối.
- **AI không overwrite/không tự lưu**: proposal hiển thị `Gợi ý i/N` + `[Dùng gợi ý]` (CHỈ điền Start/End/Tên) + `[Bỏ]`; **overlap với thao tác đã tạo → ⚠ cảnh báo + chặn Dùng** (không duplicate). Test: AI analyze 2 lần → Library count không đổi; tester tự tạo Login trước → không bị overwrite.
- **III. THAO TÁC ĐÃ TẠO** (đổi tên): tách hẳn; mỗi item collapsed (`Tên · bước X→Y · N thao tác` + `[Xem][Sửa][Xóa]`) + `[+ Tạo thêm thao tác]` + `[Lưu vào Thư viện thao tác]` (align phải, compact).
- **Save feedback**: `✓ Đã lưu N thao tác vào Thư viện.` + `[Mở Thư viện thao tác]` → khối **THƯ VIỆN THAO TÁC** (`[Xem tất cả]` toggle; tên/bước/verification/usage — reuse listLibrary).
- **Công cụ kỹ thuật** ▸ collapse: `[Sao chép mã]` + `[Tải/Lưu script]` + `Xem mã Playwright gốc` (read-only); **BỎ "Chạy thử bản ghi"** (trùng runner). Không textarea lớn.
- Bỏ khỏi UI: "PHÂN ĐOẠN THAO TÁC → THƯ VIỆN", "MỘT nguồn canonical (global)", "shared". Không green box khổng lồ; CTA không full-width.
- Tests: ui-test cập nhật (I/II/III, Gợi ý bằng AI, overlap guard, Mở Thư viện, Sao chép mã, bỏ Chạy thử) + ai-analysis-test mở rộng (AI không tự lưu; login trước không overwrite). Regression 15/15 PASS + build OK. **DỪNG — chờ tester kiểm UI. Không AI Composition; không Runner; không 6D.**

**P0 — CODEGEN LIBRARY VISIBILITY / SAVE FEEDBACK (ĐÃ IMPLEMENT 2026-08-10):**
- Phân biệt rõ: `CÁC THAO TÁC ĐÃ TẠO` (working set recording hiện tại) vs `THƯ VIỆN THAO TÁC` (shared persisted assets).
- Sau `[Lưu vào Thư viện thao tác]`: success "✓ Đã lưu N thao tác vào Thư viện." + `[Xem trong Thư viện]` (mở khối Library); **KHÔNG auto-clear working set** (tester vẫn thấy action vừa tạo).
- Khối `THƯ VIỆN THAO TÁC` ngay trong CodeGen (collapsed toggle) — reuse `listLibrary` API (`GET /api/codegen/library` mới: label/stepCount/recordedAssertionCount/usedByTestCases derive từ bindings); không xây Library mới.
- Button compact (`v3-btn--mini`); raw Playwright vẫn thu gọn (Công cụ kỹ thuật).
- Không AI Composition; không Runner. Regression 15/15 PASS + build OK. **DỪNG — chờ tester kiểm UI.**

**P0 — CODEGEN 3-TẦNG UX (ĐÃ IMPLEMENT 2026-08-10):**
- **I. BẢN GHI** → "Tôi vừa đưa gì vào?": summary `N thao tác · M điều kiện kiểm tra` + `[Xem bản ghi]` (collapsed; chỉ steps/verification **readable** — KHÔNG raw code; raw ở Công cụ kỹ thuật).
- **II. TẠO THAO TÁC** → "Tôi muốn lấy đoạn nào?": mô tả nhẹ + **link nhỏ "Gợi ý: để AI đề xuất cách chia bản ghi"** (không nút ✨ nổi, không UI AI riêng) → Start/End dropdown → "Đã chọn N thao tác · Bước X → Y" + inline `Bấm A → Bấm B` → verification scoped business-readable (`[Xem kỹ thuật]`) → Tên → `[Xác nhận thao tác]`. AI "Dùng gợi ý" chỉ đổ vào Start/End/Tên — tester review rồi Xác nhận như thường.
- **III. THAO TÁC ĐÃ TẠO** → "Tôi đã tạo được gì?": compact collapsed per item (`▸ Tên · bước X→Y · N thao tác · M verification`) + `[Xem]/[Chỉnh]/[Xóa]` + `[+ Tạo thêm thao tác]` + `[Lưu vào Thư viện thao tác]`.
- Đổi tên "PHÂN TÍCH / TẠO THAO TÁC" → "TẠO THAO TÁC" (nói theo mục tiêu tester).
- Không thêm feature; không AI Composition; không Runner. Regression 15/15 PASS + build OK. **DỪNG — chờ tester kiểm UI.**

**P0 — CODEGEN SEGMENTATION UX CORRECTION (ĐÃ IMPLEMENT 2026-08-10, không thêm feature):**
- Tách 2 phần rõ ràng, hết duplication:
  - **I. BẢN GHI PLAYWRIGHT**: summary `N thao tác · M điều kiện kiểm tra` + `[Xem bản ghi]` (collapsed mặc định; chỉ review/debug steps + verification). KHÔNG chọn Start/End ở đây; KHÔNG render lại danh sách.
  - **II. PHÂN TÍCH / TẠO THAO TÁC**: nơi duy nhất tạo reusable action — Start/End dropdown → preview (chỉ steps thuộc range) → verification scoped (business-readable + `[Xem kỹ thuật]`) → Tên → `[Xác nhận đoạn]`; `[✨ Phân tích bản ghi]` (AI) proposals đổ vào CÙNG UI → `[Xác nhận]/[Chỉnh]/[Bỏ]`; `[Chọn toàn bộ]` secondary.
  - Sau confirm → **"CÁC THAO TÁC ĐÃ TẠO"** compact (mỗi item collapsed; bấm Xem mới thấy steps/verification/raw) + `[Chỉnh]/[Xóa]` + `[+ Tạo thêm thao tác]` + `[Lưu vào Thư viện thao tác]`.
- Bỏ `"Bạn muốn dùng phần nào? (o) Dùng toàn bộ ( ) Chọn một phần"` với danh sách render lần 2.
- AI không tạo UI riêng — cùng flow manual (cả hai kết thúc: đoạn chọn → verification scoped → tên → xác nhận → danh sách đã tạo).
- Test: ui-test cập nhật (PHÂN TÍCH/TẠO THAO TÁC, không duplication, Xem bản ghi, CÁC THAO TÁC ĐÃ TẠO). Regression 15/15 PASS + build OK. **DỪNG — chờ tester kiểm UI.**

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
