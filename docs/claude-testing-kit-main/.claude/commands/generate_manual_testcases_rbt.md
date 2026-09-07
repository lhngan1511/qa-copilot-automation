---
description: Sinh manual test cases chất lượng cao theo quy trình AI-RBT 6 bước (Risk-Based Testing) từ requirements.
skills:
  - skills-rbt-manual-testing
  - skills-requirements-analyzer
---

> **BẮT BUỘC (MANDATORY SKILL):** Bạn PHẢI nạp và đọc kỹ nội dung của skill **`skills-rbt-manual-testing`** (tại `.claude/skills/skills-rbt-manual-testing/SKILL.md`) trước khi bắt đầu thực hiện tác vụ này. Sử dụng **Mode FULL RBT** của skill. Ngoài ra, tham khảo thêm skill **`skills-requirements-analyzer`** để hiểu cách phân tích giao diện nếu cần.

# Command: Sinh Manual Test Cases theo AI-RBT Framework (FULL RBT Mode)

Command này sử dụng **Mode FULL RBT** của skill `skills-rbt-manual-testing` — quy trình **AI-RBT (AI-Driven Risk-Based Testing)** gồm 6 bước tuần tự để sinh manual test cases từ tài liệu yêu cầu.

> [!NOTE]
> **Luồng này dành cho Claude Code (slash command).** Agent thực hiện theo hướng dẫn trong skill, KHÔNG cần đọc file prompt.txt.
> Nếu QA team muốn dùng prompt chi tiết hơn (ChatGPT/Claude Web), hãy copy-paste từng bước từ `plans/manual/01-06/prompt.txt`.

## ⚠️ Nguyên tắc thực thi

- **Mode:** FULL RBT (6 bước tuần tự)
- **BẮT BUỘC chạy tuần tự** từng bước, KHÔNG gộp nhiều bước
- **PHẢI dừng lại** chờ user phản hồi tại Bước 2 (Q&A) và Bước 4 (Review Scenarios)
- Nếu user chưa cung cấp requirements, hỏi user cung cấp trước khi bắt đầu
- Tất cả output bằng **Tiếng Việt**

## Các bước thực hiện

Thực hiện theo hướng dẫn chi tiết trong skill `skills-rbt-manual-testing` → phần **Mode 2: FULL RBT**.

### Bước 1: Khởi tạo ngữ cảnh (Context & Role-play)
1. Yêu cầu user cung cấp: tên dự án, mô tả hệ thống, mục tiêu MVP, tài liệu yêu cầu
2. Đọc kỹ tài liệu, xác nhận hiểu bối cảnh
3. **Chờ user xác nhận** → sang Bước 2

### Bước 2: Phân tích yêu cầu (Analysis & QnA)
1. Xác định Happy Path, Alternate Paths, Exception Paths
2. Phát hiện Ambiguities (thiếu sót, mâu thuẫn, chưa rõ ràng)
3. Đặt câu hỏi Q&A có đánh số (Q1, Q2...) cho user/PO/BA, kèm ngữ cảnh + assumption
4. **DỪNG LẠI — Chờ user trả lời câu hỏi** → sang Bước 3

### Bước 3: Phân rã hệ thống (Decomposition)
1. Chia tính năng thành Modules / Sub-modules
2. Mô tả chức năng từng Module + Dependencies giữa chúng

### Bước 4: Đảm bảo độ bao phủ (Traceability)
1. Map Module → mã Yêu cầu (REQ-01, REQ-02...)
2. Cross-check thiếu sót (Gap Analysis), liệt kê High-Level Scenarios
3. **Chờ user review** scenarios → sang Bước 5

### Bước 5: Sinh Test Case chi tiết (RBT & TC Generation)
1. Đánh giá Risk Level (High/Medium/Low) cho mỗi Module.
2. Sinh test cases đầy đủ: **REQ ID** (từ Traceability Matrix Bước 4), Title, Pre-condition, Steps (**đánh số 1,2,3 — mỗi bước 1 hành động**), Expected (đánh số khớp 1-1), Test Data, Priority.
3. Áp dụng kỹ thuật theo **Quy Tắc Bắt Buộc** trong skill: EP+BVA (field có ràng buộc), **Decision Table** (≥3 điều kiện kết hợp), **State Transition** (có status flow).
4. **Validation chuyên biệt từng trường (Field-Level Validation - 15 Field Types):**
   - Liệt kê tất cả input fields trên form/UI đang test.
   - Sinh validation TCs **riêng cho TỪNG trường** (Text, Email, Phone, Date, Number, Dropdown, Checkbox/Radio, File Upload, Password, Textarea, OTP/MFA, Date Range, Rich Text, Multi-Select, Range Slider).
   - Tham chiếu **Bảng Field-Level Validation Checklist** trong skill `skills-rbt-manual-testing`.
   - **KHÔNG** gộp validation nhiều trường vào 1 TC.
5. **Bao phủ Component-Level Checklist** (trong skill): Data Table/List, CRUD Lifecycle, Permission/Role (đối chiếu Ma trận Phân quyền), Modal/Dialog, Notification, Status Flow (đối chiếu Ma trận Trạng thái).
6. **Bao phủ Scenarios Chuyên Sâu & Non-Functional:**
   - Double Submit / Race Condition (click liên tiếp nút submit, concurrent edit).
   - Session & Network Resilience (session timeout mid-form, loss of network, slow 3G).
   - Localization & UTF-8 / Emoji (tiếng Việt có dấu, emoji, ký tự đa ngôn ngữ).
   - Keyboard Accessibility (Tab order, Enter/Space trigger, Focus state).
   - HTTP Status Codes (cho API TCs: 200, 400, 401, 403, 404, 409, 422, 429, 500/503).
7. Test Data phải cụ thể (không placeholder chung chung).
8. **Sinh theo batch, ghi thẳng vào file** (theo Quy Tắc Xuất File & Theo Dõi Tiến Độ trong skill):
   - Công bố kế hoạch batch trước khi sinh (số batch · ước tính TC · số file)
   - Mỗi batch 15–25 TC theo nhóm chức năng → ghi file → báo 1 dòng tiến độ
   - **Chạy thẳng hết mọi batch**, KHÔNG dừng hỏi giữa các batch (checkpoint của FULL RBT nằm ở Bước 2 và Bước 4, không phải trong Bước 5)
   - **KHÔNG** in toàn bộ bảng TC ra chat

### Bước 6: Chuẩn hóa Format & Metadata (Template Mapping)
1. Đóng gói toàn bộ test cases vào bảng Markdown chuẩn đầy đủ metadata cho Automation:
   `| TC ID | REQ ID | Module | Risk Level | Test Title | Pre-Condition | Test Steps | Expected Result | Priority | Test Data | Automatable | Auto Type | Tags |`
2. **Chạy Self-Quality Gate (7 tiêu chí):** Unique TC ID, 1-to-1 Step-Expected matching (steps đánh số rõ từng bước), Concrete Test Data, Field Validation Coverage, Automation Metadata Ready, **Requirement Coverage** (mọi REQ có ≥1 TC — xuất Bảng Đối Soát Coverage; REQ nào 0 TC phải sinh bổ sung trước khi xuất), và **Evidence-verified** (đã mở 100% ảnh trong `evidence/` — xuất Bảng Đối Soát Evidence; vùng không có ảnh thì TC gắn `@NeedsVerify`).
3. ⚠️ **Kiểm tra `docs/testcases/README.md`** — chưa tồn tại (dự án mới) thì **tạo file danh mục trước** với bảng rỗng, để biết prefix TC ID nào đã bị chiếm và có chỗ theo dõi độ phủ REQ↔TC.
4. Ghi file `docs/testcases/<module>/test_cases_<module>.md` — **tách vào `<module>/parts/part_NN_<slug>.md` khi >40 TC** (cắt tại ranh giới nhóm chức năng); có ≥2 part thì `test_cases_<module>.md` trở thành **index** (giữ nguyên tên). Mỗi module một thư mục riêng. Xong thì **bổ sung/cập nhật dòng của module** trong danh mục.
5. Dự kiến **>30 TC** → tạo `task.md` (hoặc dùng task list của Claude Code), cập nhật sau mỗi batch.
6. Chat chỉ hiện: kế hoạch batch → tiến độ từng batch → Bảng Đối Soát Coverage + tóm tắt đường dẫn file.

## Output

- Bảng Test Cases Markdown hoàn chỉnh (có cột **REQ ID**) kèm Automation Metadata (`Automatable`, `Auto Type`, `Tags`), sẵn sàng copy sang Excel/Jira/TestRail hoặc sync trực tiếp vào Google Sheets
- Traceability Matrix + **Bảng Đối Soát Coverage** (REQ × số TC × đủ Positive/Negative/Boundary)
- Danh sách Ambiguities đã giải quyết
- Báo cáo Self-Quality Gate Verification (7 tiêu chí)
