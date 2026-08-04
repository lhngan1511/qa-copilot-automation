# Known Gaps after Vertical Slice

Trạng thái: **CHỈ PHÂN TÍCH — không sửa code.** Dựa trên code hiện tại (HEAD `cea6f4e`).

---

## 1. Phần nào deterministic, phần nào vẫn do Gemini quyết định?

**Deterministic (Generator tự dựng, không phụ thuộc Gemini):**
- `buildSetupPrefix()` + `renderStep()`: dựng code `goto entryRoute` + `authenticationSetup` + `navigationChain` **trực tiếp từ mapping APPROVED** (locator, actionType, credential theo target). Đây là code quyết định, không phải Gemini sinh.
- `validateCode`: allowlist locator tuyệt đối, credential env, ES module, chặn TS/require/URL-hardcode — deterministic.

**Do Gemini quyết định (DRAFT, phải approve):**
- `AIAutomationMapper.mapModule`: Gemini đề xuất `entryRoute`, `authenticationSetup`, `navigationChain`, `stepMappings` (business), `assertionMappings`, sourceReference, status. Đây là **proposal** — chưa approve.
- **Business body** (`stepMappings`/`assertionMappings`) trong code: Generator để Gemini sinh phần body (chỉ chèn prefix auth/nav), rồi validate allowlist.

→ **Gap:** Phần **business body vẫn do Gemini sinh** (dù bị allowlist chặn locator lạ). Auth/nav deterministic, business bán-tự-do.

## 2. Shared setup phạm vi module/function/testcase?

- **Hiện tại:** `entryRoute`/`authenticationSetup`/`navigationChain` được Mapper trả **theo từng testcase** (mỗi `testCaseMapping` có 3 khối riêng).
- Web UI hiển thị "Shared Setup cấp module" từ `activeMap`, approve áp cho **tất cả testCaseMappings** (cùng module). Nhưng **dữ liệu gốc vẫn lưu per-testcase**, không có cấu trúc `shared.module`/`shared.function` riêng.

→ **Gap:** Chưa có khái niệm `shared` cấp module/function thực sự. Nếu 2 testcase cùng module có auth/nav giống nhau, dữ liệu **lặp lại** ở mỗi testcase. Chưa tách biệt theo `function` (vd Sinh mã vs Tìm kiếm) — mọi testcase hiện nhận cùng shared setup.

## 3. Test data runtime cho TC001/TC003/TC009?

- Credential auth: `process.env.LOGIN_USERNAME` / `LOGIN_PASSWORD` / `LOGIN_CAPTCHA` (từ `.env`).
- **Test data business (Mã/Tên đơn vị tính, từ khóa tìm):** `testData.fields` có `requiresTesterInput: true` — **chưa có nguồn runtime**. Generator hiện **không chèn** test data business vào code (chỉ auth dùng env). Với TC001 "Thêm mới", code sẽ `fill` gì cho "Tên đơn vị tính"? Hiện **chưa xử lý** — đây là gap lớn.

→ **Gap:** Test data business chưa được giải quyết. Chỉ auth có env; còn field nhập (Tên/Mã/Ghi chú, từ khóa tìm) chưa có cơ chế cấp giá trị runtime.

## 4. Business steps còn cho phép Gemini tạo locator/action mới?

- **Có, nhưng bị chặn ở validate:** Gemini sinh business body; nếu dùng locator ngoài allowlist → reject toàn bộ. Nên "tạo locator mới" không được **chấp nhận** vào file, nhưng Gemini **vẫn có thể sinh** rồi bị reject.
- **Action mới:** validate chỉ kiểm tra locator + testcaseId + import + credential. **Không kiểm tra** actionType có hợp lệ (vd Gemini sinh `selectOption` trên element lạ) — chỉ locator bị chặn.

→ **Gap:** Business locator bị allowlist chặn (tốt), nhưng **action semantics** chưa được validate mạnh; và việc để Gemini sinh business vẫn phụ thuộc prompt (có thể sinh code dư/nhiễu rồi reject lặp).

## 5. Cơ chế phát hiện action lặp giữa navigationChain và stepMappings?

- **Không có.** Không có bước so sánh locator/target giữa `navigationChain.steps` và `stepMappings` để phát hiện trùng.
- Nếu Gemini đưa "Thêm mới" vào cả navigationChain lẫn stepMappings, hoặc navigationChain lặp 2 lần "Asset", **không có cảnh báo**.

→ **Gap:** Chưa có dedup/conflict detection giữa shared setup và business steps.

## 6. sourceReference đầy đủ cho entryRoute/auth/nav/business/assertion?

- Mapper: `entryRoute.sourceReference`, `authenticationSetup.steps[].sourceReference`, `navigationChain.steps[].sourceReference` — **có field** nhưng do Gemini điền (có thể rỗng).
- `stepMappings[].sourceReference`, `assertionMappings[].sourceReference` — **có** nhưng chưa được chuẩn hóa/bắt buộc.
- `normalizeChain` giữ `sourceReference` nếu Gemini trả.

→ **Gap:** Field có nhưng **không bắt buộc/không validate** — sourceReference có thể rỗng; không có check "mọi segment phải có sourceReference" (dù validator locator vẫn truy ngược codegen).

## 7. Nếu auth/nav khác nhau giữa testcase cùng module?

- **Contract hiện xử lý kém.** Vì shared setup lưu per-testcase (mỗi mapping có authSetup/navChain riêng), về lý thuyết mỗi testcase có thể khác — nhưng Web UI approve áp cho **tất cả** cùng module → nếu testcase A cần login khác testcase B (vd permission), approve đồng loạt sẽ **ghi đè sai**.
- Mapper prompt yêu cầu tách authSetup/navigationChain theo testcase, nhưng không có cơ chế "shared theo function" khi 2 function khác nhau trong cùng module.

→ **Gap:** Không phân biệt shared theo `function`/`permission`; approve toàn module có thể sai khi auth/nav thực sự khác nhau giữa các testcase/function.

## 8. Những gì của Sprint 0 Behavior Tree chưa tích hợp?

- **Chưa tích hợp gì.** Behavior Tree (`behavior-tree.json`, `segment.mjs` Gemini thật) là prototype research riêng (`research/codegen-behavior/`), **không được dùng** làm input cho Mapper.
- Mapper vẫn nhận `approved-testcases.json` + Codegen thô → Gemini tự phân đoạn entryRoute/auth/nav/business (prompt-driven), **không qua Behavior Tree**.
- `segment.mjs` gọi Gemini thật nhưng chưa kết nối production.

→ **Gap:** Behavior Tree là hướng tương lai; hiện Mapper dùng prompt Gemini trực tiếp, không có "Behavior Understanding" ổn định trung gian.

## 9. Phần nào chỉ là giải pháp vertical slice tạm thời?

- **`renderStep` map credential theo target heuristic** (`/tài khoản/`→LOGIN_USERNAME) — cứng nhắc, chỉ đúng mẫu login tiếng Việt; không tổng quát.
- **`buildSetupPrefix` chèn bằng regex** (`async ({ page }) => {`) — dễ vỡ nếu format khác.
- **Shared setup lưu per-testcase + approve toàn module** — tạm bợ, thiếu cấu trúc `shared` thật.
- **`entryRoute`/`navigationChain` do Gemini đề xuất** rồi approve — chưa qua Behavior Tree nên dễ thiếu/đổi locator.
- **Test data business chưa có nguồn runtime** — vertical slice chỉ chứng minh auth+nav, chưa chạy business thật với dữ liệu.

## 10. Đề xuất thứ tự 3 sprint tiếp theo (chưa code)

**Sprint A — Test Data Runtime + Business determinism:**
- Cấp giá trị runtime cho business fields (từ testData.fields hoặc env/fixture).
- Làm business body deterministic (Generator dựng từ stepMappings đã approve, không để Gemini tự sinh body).

**Sprint B — Shared Setup thực sự (module/function):**
- Thêm cấu trúc `shared` cấp module/function trong mapping.
- Dedup/conflict detection giữa navigationChain và stepMappings.
- Validate sourceReference bắt buộc cho mọi segment.
- Phân biệt auth/nav theo function/permission (không approve đồng loạt sai).

**Sprint C — Tích hợp Behavior Tree vào Mapper:**
- Dùng Behavior Tree (Gemini thật) làm đầu vào trung gian cho Mapper thay vì prompt trực tiếp.
- Object Recognition (CodeGen → Action List → UI Object Candidate → Semantic Proposal → Behavior Tree).
- Làm cho navigation/auth/business phân đoạn ổn định, không phụ thuộc prompt mỗi lần.

---

## Kết luận
Vertical slice đã chứng minh được **auth + navigation chạy độc lập** (entryRoute giữ returnUrl, chèn prefix auth/nav, allowlist). Nhưng còn nhiều gap: **test data business chưa có nguồn runtime**, **business body vẫn do Gemini sinh**, **shared setup chưa có cấu trúc module/function thật**, **Behavior Tree chưa tích hợp**, và **thiếu dedup/conflict + sourceReference bắt buộc**. Thứ tự đề xuất: A (test data + business determinism) → B (shared setup + validation) → C (Behavior Tree integration).
