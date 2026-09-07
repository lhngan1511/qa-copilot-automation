---
description: Generate Requirements content from a provided website module
skills:
  - skills-requirements-analyzer
---

# Workflow: Generate Requirements from Website Module

> **BẮT BUỘC (MANDATORY SKILL):** Bạn PHẢI nạp và đọc kỹ nội dung của skill **`skills-requirements-analyzer`** (tại `.claude/skills/skills-requirements-analyzer/SKILL.md`) để biết định dạng chuẩn của tài liệu Requirements trước khi bắt đầu thực hiện tác vụ này.
>
> Workflow này chạy **nhánh UI Recon** — dùng mục **2 + 2.1** (đánh mã), **3.1** (trích xuất từ UI), **4** (AMB/RISK), **5** (quy mô/tách file), **6** (cấu trúc đầu ra), **7.1 + 7.2** (strict rules).
> ❌ KHÔNG dùng mục **3.2** (Document Analysis) trừ khi user cung cấp kèm tài liệu — khi đó chạy 3.2 trước, 3.1 sau và đối chiếu theo mục **3.3**.

Workflow này giúp bạn phân tích một module hoặc trang web được cung cấp và sinh ra tài liệu Yêu cầu (Requirements) chi tiết, chuẩn xác, **có mã REQ ID truy vết được**, phục vụ cho quá trình kiểm thử hoặc phát triển.

## Các bước thực hiện:

1. **Tiếp nhận thông tin (Information Gathering):**
   - Đọc kỹ hướng dẫn từ kỹ năng (skill) **`skills-requirements-analyzer`** để nắm bắt chuẩn đầu ra.
   - Lấy thông tin URL của trang web, tên module, hoặc mô tả/hình ảnh mà người dùng cung cấp.
   - Nếu cần thiết, hỏi người dùng về thông tin đăng nhập hoặc các trạng thái đặc biệt cần lưu ý.
   - Nếu hệ thống có nhiều role → hỏi user account của từng role để phân tích phân quyền.

2. **Khảo sát hệ thống (Recon & Investigation):**
   - Sử dụng các công cụ duyệt web (Browser tools/MCP) để truy cập vào module trang web được yêu cầu (`navigate → resize 1920x1080 → snapshot`).
   - Inspect kỹ lưỡng cấu trúc HTML, DOM, các form nhập liệu, các nút tương tác (buttons, links), và các thông báo lỗi (validation messages — ghi **nguyên văn**).
   - Trigger từng validation để thu thập error messages thực tế.
   - *Lưu ý: Không tự đoán các trường thông tin nếu không nhìn thấy trên giao diện thực tế.*

3. **Phân tích chức năng và tương tác (Analyze UI & Interactions):**
   - Phân tích luồng thao tác (User Flows).
   - Ghi nhận các trường dữ liệu tĩnh và động (Ví dụ: TextBox, Dropdown, Checkbox).
   - Ghi nhận các quy tắc nghiệp vụ hiển thị ở giao diện (Business Rules): trường bắt buộc, định dạng hợp lệ, giới hạn ký tự.
   - Ghi nhận phân quyền theo role (nếu có) và các trạng thái của entity (nếu có status flow).

4. **Biên soạn tài liệu Yêu cầu (Draft Requirements):**
   - ⚠️ **TRƯỚC KHI GÁN MÃ REQ ĐẦU TIÊN — làm đủ 2 bước:**
     1. Đọc danh mục `docs/requirements/README.md` — biết module nào đã có, **prefix nào đã bị chiếm** (module mới phải chọn prefix chưa dùng), mã kế tiếp của từng module.
        **Dự án mới, file chưa tồn tại → TẠO file danh mục trước** theo mục **5.7.1** của skill, đừng bỏ qua rồi ghi thẳng tài liệu module
     2. Mở `docs/requirements/<module>/requirements_<module>.md`. Nếu module đã có tài liệu, **đánh tiếp từ số REQ cuối cùng**, KHÔNG đánh lại từ `01` (mục **2.1** của skill). Áp cả cho `AMB-XX` và `RISK-XX`
   - **TRƯỚC KHI GHI FILE:** đếm tổng số REQ đã sinh, đối chiếu **bảng ngưỡng tại mục 5.1** của skill để quyết định cấu trúc đầu ra (1 file / 1 file + Epic-Story / tách nhiều file). Xem các module đã có trong `docs/requirements/` để giữ đúng convention (mục 5.6).
   - Tuân thủ **Output Format (mục 6)** và **Quy Ước Đánh Mã (mục 2)** trong skill `skills-requirements-analyzer`:
     * **Tổng quan (Overview):** Mục đích của module/trang.
     * **Yêu cầu chức năng (Functional Requirements):** Mỗi tính năng/business rule/validation rule **gán mã `REQ-<MODULE>-<SỐ>`** — bảng có cột REQ ID.
     * **Quy tắc trường dữ liệu (Field Specifications):** Bảng chi tiết từng thành phần UI (Tên trường, Loại, Bắt buộc/Không, Ràng buộc, REQ liên quan).
     * **Business Rules & Validation Messages:** Error message ghi nguyên văn từ UI, gắn REQ ID.
     * **Ma trận Phân quyền** (nếu có nhiều role) và **Ma trận Trạng thái** (nếu có status flow) — không áp dụng thì ghi rõ "Không áp dụng".
     * **Điểm Mơ Hồ & Rủi Ro:** Bảng AMB-XX (kèm Assumption tạm) + RISK-XX theo framework trong skill.
     * **Luồng xử lý (Business/User Flows):** Các bước để hoàn thành một chức năng chính.
     * **Yêu cầu phi chức năng (Non-functional Requirements - Nếu có thể quan sát):** Tính tương thích, hiệu năng tĩnh.
     * **Phân rã Epic/Story (mục 6.8):** BẮT BUỘC khi ≥ 25 REQ — bảng Story ↔ REQ, dòng tổng kiểm chứng, hạng mục cấp Epic, thứ tự triển khai.

5. **Trình bày và Cung cấp (Review & Delivery):**
   - Định dạng tài liệu bằng Markdown rõ ràng.
   - Trình bày toàn bộ nội dung bằng **Tiếng Việt** có dấu rõ ràng, chuyên nghiệp và dễ hiểu.
   - **Lưu đúng layout thư mục** (mục 5.3 của skill) — evidence nằm trong thư mục module, không tách ra ngoài:
     ```
     docs/requirements/<module>/requirements_<module>.md      ← INDEX, tên file bất biến
     docs/requirements/<module>/evidence/*.png
     docs/requirements/<module>/stories/story_NN_<slug>.md     ← chỉ khi tách
     ```
   - **BẮT BUỘC cập nhật danh mục** `docs/requirements/README.md`: thêm/sửa dòng của module ở bảng mục 1 (`REQ đã dùng`, `Mã kế tiếp`, `AMB treo`, `Story`, `Cập nhật`), bảng trạng thái mục 2, và ambiguity 🔴 High ở mục 3.
   - Nếu tài liệu bị tách nhiều file: file index **vẫn phải là** `requirements_<module>.md` và **BẮT BUỘC** chứa mục `## Bản đồ tài liệu` liệt kê file con kèm dải REQ.
   - **Checklist trước khi bàn giao:** đối chiếu đủ 6 mục bất biến tại **mục 5.4** của skill (REQ ID giữ nguyên · mỗi REQ thuộc đúng 1 Story · tổng REQ khớp · AMB/RISK đánh số toàn module · không nhân bản hạng mục cắt ngang · link 2 chiều index ↔ story).
   - Nhắc user: tài liệu này (với REQ ID) là input chuẩn cho `/generate_manual_testcases_rbt` và `/generate_testcases_from_requirements`.
