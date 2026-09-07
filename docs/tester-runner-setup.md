# Thêm tester và kết nối Runner

## Thêm tester mới (trên máy server)

```powershell
cd G:\qa-copilot-automation
$env:QA_COPILOT_ENV_FILE="G:\qa-copilot-config\.env"
npm run user:add
```

Nhập `username`, tên hiển thị và mật khẩu. User được lưu vào `data/auth-users.json` với password hash; username trùng bị từ chối.

## Khởi động server

```powershell
cd G:\qa-copilot-automation
$env:QA_COPILOT_ENV_FILE="G:\qa-copilot-config\.env"
$env:HOST="0.0.0.0"
npm start
```

## Trên mỗi máy tester — Cách nhanh (1 lần, khuyến nghị cho Windows)

1. Đăng nhập QA Copilot bằng tài khoản riêng.
2. Mở menu tài khoản → **Kết nối máy chạy này**; nhập tên máy → bấm **"Tải gói cài đặt (.zip)"**
   (file đã điền sẵn `serverUrl`/`agentId`/`token`, không cần gõ tay).
3. Giải nén, double-click **`setup.bat`** trong thư mục vừa giải nén.
4. Script tự động: kiểm tra Node.js (báo lỗi rõ nếu chưa cài), `npm install`, cài trình duyệt
   Chromium cho Playwright, rồi đăng ký chạy nền tự động mỗi lần đăng nhập Windows (Task Scheduler,
   không cần quyền admin) và chạy luôn ngay lúc đó.
5. Mở QA Copilot → menu tài khoản, xác nhận máy hiện "Online" (vài giây). Từ lần đăng nhập Windows
   sau, Runner tự chạy — không cần mở tay lại.

Chạy lại `setup.bat` bất kỳ lúc nào để cập nhật bản mới hoặc sửa lỗi cài đặt — không tạo task trùng.

## Trên mỗi máy tester — Cách thủ công (khi không dùng được gói cài đặt — máy không phải Windows, hoặc cần tuỳ chỉnh)

1. Đăng nhập QA Copilot bằng tài khoản riêng.
2. Mở menu tài khoản → **Kết nối máy chạy này**; nhập tên máy và sao chép `runnerId` cùng token (token chỉ hiện một lần).
3. Copy riêng thư mục `tools/runner/` sang máy tester. Thư mục này đã có `agent.mjs`, `codegenExecution.mjs`, `playwrightExecution.mjs`, `playwrightPath.mjs`, `package.json` và `config.example.json` (kèm cấu hình Playwright runtime).
4. Trong thư mục đã copy, chạy `npm install`.
5. Copy `config.example.json` thành `runner-agent.config.json`, điền `serverUrl`, `agentId` (= runnerId) và `token`.
6. Chạy:

   ```powershell
   node agent.mjs .\runner-agent.config.json
   ```

7. Khi log báo `online`, mở Automation Workspace. Dropdown Runner chỉ hiện máy thuộc tài khoản đang đăng nhập. Chọn máy đó rồi Run testcase; browser sẽ mở trên đúng máy tester.
8. Để chạy nền tự động (không cần giữ terminal mở), tự đăng ký Task Scheduler chạy `node agent.mjs runner-agent.config.json` lúc đăng nhập — hoặc dùng gói cài đặt tự động ở trên.

Runner không cần full source QA Copilot, Git, `npm start` hay source Web UI.
