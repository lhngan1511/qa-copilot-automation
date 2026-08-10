# HANDOFF — V3 Record by Testcase (Bản chuyển giao cho session/chat mới)

> Cập nhật lần cuối: 2026-08-10 · Viết để một chat/session HOÀN TOÀN MỚI có thể tiếp tục
> **đúng, không lệch nội dung**. Đây là nguồn duy nhất cần đọc trước khi làm tiếp.

---

## 1. BỐI CẢNH DỰ ÁN & CÁC NHÁNH (ĐỌC KỸ)

Repo: `lhngan1511/qa-copilot-automation` (QA Copilot, xưng hô trung tính, người dùng viết **tiếng Việt**).

Có **nhiều nhánh / kiến trúc khác nhau**, đừng nhầm. Trạng thái remote (đã xác minh `git ls-remote`):

| Nhánh | Commit | Nội dung |
|---|---|---|
| **`arena/automation-record-by-testcase`** | **`22b1b4b`** | ⭐ **NHÁNH V3 — "Record by Testcase". ĐÂY LÀ NHÁNH LÀM VIỆC.** Toàn bộ tiến trình V3 nằm đây. |
| `arena/019fcae2-codegen-mvp` | `d5158a1` | Demo cũ "Automation Intelligence 6-bước" (CodeGen upload → AI Mapping → Review → Generate → Run → Export). **KHÔNG phải V3. Đừng nhầm.** |
| `demo/ui-polish-20260807` | `59063d6` | Nhánh **chỉ UI demo** (bắt nguồn từ codegen-mvp). Đã cherry-pick fix Generate. Không liên quan V3. |
| `arena/019fcc7b-qa-copilot-automation` | `790dc8d` | Branch mặc định của session hiện tại. **KHÔNG dùng cho V3.** |
| `main` | `0100679` | Trunk. Không đụng trực tiếp. |

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

### Test V3 (đều PASS)
- `tests/automation-v3-api-test.js` (Bước 4 — 20 test, trong đó test backend HTTP + error contract + restart persistence).
- `tests/automation-v3-recording-api-test.js` (5B — detail/source/delete/list summary).
- `tests/automation-v3-ui-test.js` (static contract + logic thuần).
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

## 4. VIỆC CHƯA LÀM (THEO THỨ TỰ — LÀM TIẾP TỪ ĐÂY)

### Bước 5C — Expected Result → Tester-confirmed Assertion → Generate (KẾ TIẾP)
Phạm vi (người dùng đã chốt định hướng):
- Chuyển **Expected Result → tester-confirmed assertion** (assertion confirmation) trong UI V3.
- Nối **Generate** (qua GenerateService V3 đã có) vào UI — card APPROVED chuyển sang Generate.
- Mỗi card một primary action; không AI assertion confirmation thật trong bước này.
- Cần **wireframe 5C** trước khi code (theo thông lệ).

### Bước 6 — Run (browser thật)
- Chạy spec đã generate; RUNNING → PASS/FAIL. Cần Chromium (sandbox hiện KHÔNG có — chỉ stub/test).

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
1. `git worktree add /tmp/wt-v3 arena/automation-record-by-testcase` (đảm bảo HEAD = `22b1b4b` — commit mới nhất tính đến 2026-08-10).
2. Cài deps (mục 1).
3. Đọc `docs/V3_HANDOFF.md` + `docs/backlog.md`.
4. **Soạn wireframe Bước 5C** (Expected Result → Tester-confirmed Assertion → Generate) → gửi người dùng **duyệt trước khi code**.
5. Sau khi duyệt: code 5C, build + test, commit + push, xác minh `git ls-remote`, báo working tree clean.
