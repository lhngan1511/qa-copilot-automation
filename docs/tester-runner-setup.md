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

## Trên mỗi máy tester

1. Đăng nhập QA Copilot bằng tài khoản riêng.
2. Mở menu tài khoản → **Kết nối máy chạy này**; nhập tên máy và sao chép `runnerId` cùng token (token chỉ hiện một lần).
3. Copy riêng thư mục `tools/runner/` sang máy tester. Thư mục này đã có `agent.mjs`, `playwrightExecution.mjs`, `playwrightPath.mjs`, `package.json` và `config.example.json` (kèm cấu hình Playwright runtime).
4. Trong thư mục đã copy, chạy `npm install`.
5. Copy `config.example.json` thành `runner-agent.config.json`, điền `serverUrl`, `agentId` (= runnerId) và `token`.
6. Chạy:

   ```powershell
   node agent.mjs .\runner-agent.config.json
   ```

7. Khi log báo `online`, mở Automation Workspace. Dropdown Runner chỉ hiện máy thuộc tài khoản đang đăng nhập. Chọn máy đó rồi Run testcase; browser sẽ mở trên đúng máy tester.

Runner không cần full source QA Copilot, Git, `npm start` hay source Web UI.
