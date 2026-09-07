# Prompt Templates — Dùng Nhanh với Claude Code

Thư mục này chứa các prompt mẫu dùng nhanh (copy → paste → gửi) đã được thiết kế tối ưu cho **Claude Code**. Các prompt này hỗ trợ gọi trực tiếp slash command hoặc thực thi đơn lẻ theo tiêu chuẩn chất lượng cao.

> **📌 Nguyên tắc thiết kế prompt:** Prompt chỉ chứa **INPUT của lần chạy** (slash command + context + data + lựa chọn per-run như Mode, format output). KHÔNG lặp lại CONSTRAINTS / OUTPUT FORMAT / quy trình — những phần đó đã được định nghĩa duy nhất trong `.claude/skills/` và `.claude/commands/`, agent tự nạp khi gọi command. Lặp lại sẽ gây drift khi nâng cấp skill.
>
> **📌 KHÔNG khai báo thứ agent tự đọc được từ repo.** Bỏ hẳn các dòng kiểu `Dự án`, `Stack`, `Framework`, `Language`, `Build tool`, `Design Pattern`, `Test Runner` — agent mở `package.json` / `pom.xml` / source code là biết. Điền tay chỉ tốn công và sai lệch khi dự án đổi.
>
> **Chỉ giữ thứ agent KHÔNG suy ra được:** URL · tài khoản test · môi trường (Dev/Staging/Prod, có dùng chung không) · Mode · phạm vi chạy · trọng tâm · dữ liệu dán trực tiếp.
>
> *Ngoại lệ duy nhất:* `03_create_framework_*` và `04_generate_script_*` vẫn ghi công nghệ, vì hai bộ này có nhánh **chưa có project — agent tự scaffold**. Lúc đó chưa có code để đọc, dòng công nghệ chính là lựa chọn cần chốt. Đã có project sẵn thì xoá dòng đó đi.

---

## Danh Sách Prompt Mẫu

| # | File | Command Tương Ứng | Skill Tích Hợp | Mô Tả & Cải Tiến Mới |
|---|------|-------------------|----------------|----------------------|
| 01 | `prompt_01_generate_requirements.txt` | `/generate_requirements_from_website` | `skills-requirements-analyzer` | Phân tích website/sơ đồ để sinh tài liệu Yêu cầu |
| 02 | `prompt_02_generate_test_cases.txt` | `/generate_manual_testcases_rbt` | `skills-rbt-manual-testing` | **[Nâng cấp mới]** Sinh Manual TCs chuẩn RBT, Checklist 15 loại input fields, Race condition, Session, A11y, AI Self-Quality Gate & Automation Metadata |
| 03 | `prompt_03_create_framework_playwright.txt` | `/generate_automation_framework` | `skills-framework-architect` | Dựng khung dự án Automation Playwright TypeScript |
| 03 | `prompt_03_create_framework_selenium.txt` | `/generate_automation_framework` | `skills-framework-architect` | Dựng khung dự án Automation Selenium Java |
| 03 | `prompt_03_create_framework_appium.txt` | `/generate_automation_framework` | `skills-framework-architect` | Dựng khung dự án Automation Appium Java (Mobile) |
| 04 | `prompt_04_generate_script_playwright.txt` | `/generate_automation_from_testcases` | `skills-qa-automation-engineer` | Viết kịch bản tự động Playwright TypeScript theo POM |
| 04 | `prompt_04_generate_script_selenium.txt` | `/generate_automation_from_testcases` | `skills-qa-automation-engineer` | Viết kịch bản tự động Selenium Java theo POM |
| 05 | `prompt_05_convert_manual_to_automation.txt` | `/generate_automation_from_testcases` | `skills-qa-automation-engineer` | Chuyển đổi Manual Test Cases sang Automation Script |
| 06 | `prompt_06_generate_test_data.txt` | `/generate_test_data` | `skills-test-data-generator` | Sinh dữ liệu kiểm thử có cấu trúc |
| 07 | `prompt_07_analyze_flaky_tests.txt` | `/analyze_flaky_tests` | `skills-flaky-test-analyzer` | Phân tích và khắc phục Flaky Tests |
| 08 | `prompt_08_generate_api_tests.txt` | `/generate_api_tests_from_swagger` | `skills-qa-automation-engineer` | **[Nâng cấp mới]** Sinh API tests từ Swagger/OpenAPI cover 12 HTTP Status Codes, OWASP API Security (BOLA/IDOR, Mass Assignment, ReDoS), SLA < 2s & Dynamic Auth Token |

## Cách Sử Dụng Trong Claude Code

1. Chọn prompt phù hợp với nhu cầu.
2. Mở file `.txt` và thay thế các thông tin trong ngoặc vuông `[...]` bằng dữ liệu thực tế dự án của bạn.
3. Copy toàn bộ nội dung file → Paste vào ô chat của **Claude Code**.
4. Agent sẽ tự động nạp skill, nhận diện command và thực thi quy trình theo đúng chuẩn tiêu chuẩn cao.
