# QA Copilot V3

QA Copilot giúp tester đi từ yêu cầu đến kịch bản Playwright có thể chạy, trong cùng một Project.

Luồng cốt lõi của V3:

```
CodeGen: ghi / dán bản ghi → AI đề xuất cách chia → lưu Thư viện thao tác
Automation: chọn thao tác từ thư viện → ghép thành một luồng nhất quán → sinh spec → chạy thử
```

AI chỉ đề xuất. Tester xác nhận. Hệ thống không tự map testcase và không tự bịa dữ liệu chạy.

Tài liệu mô tả đầy đủ: [docs/QA-Copilot-V3.md](docs/QA-Copilot-V3.md)

## Các khu vực

| Khu vực | Việc làm |
|---|---|
| **AI Test Design** | Tải Markdown hoặc tạo requirement từ ảnh, review, phê duyệt testcase |
| **CodeGen** | Ghi thao tác Playwright, để AI đề xuất, lưu Thư viện thao tác |
| **Automation** | Chọn thư viện, ghép luồng cho từng testcase, sinh và chạy thử |

Mọi khu vực dùng chung dữ liệu của Project đang chọn.

## Chạy local

```bash
npm install
npm run build:web
npm start
```

## Project và PostgreSQL

QA Copilot phân vùng workflow/testcase, CodeGen recording, Thư viện thao tác và Automation Workspace theo Project đang chọn. Khi chưa có Project, giao diện yêu cầu tạo Project trước khi sử dụng.

Để nhiều máy trong mạng nội bộ dùng chung danh mục Project, cấu hình trong file `.env` mà tiến trình server đang nạp:

```env
PROJECT_REPOSITORY_TYPE=postgres
DATABASE_URL=postgresql://qa_copilot:your_password@192.168.1.20:5432/qa_copilot
DATABASE_SSL=false
HOST=0.0.0.0
PORT=3000
```

Không đưa mật khẩu database vào source control. Mỗi máy chạy server chỉ cần trỏ `QA_COPILOT_ENV_FILE` tới file cấu hình riêng; trình duyệt của người dùng không cần biết `DATABASE_URL`.

Nếu chưa khai báo `DATABASE_URL`, danh mục Project dùng file dự phòng `data/projects.json` để môi trường phát triển vẫn khởi động được. Dữ liệu nghiệp vụ hiện tại được gắn `projectId` và lọc ở backend; dữ liệu JSON cũ không có `projectId` được xem là dữ liệu legacy và không tự động trộn vào Project mới.
