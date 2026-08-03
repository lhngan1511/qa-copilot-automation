# Sprint MVP — TC001 Đăng nhập — Bàn giao chạy local

## Kiến trúc luồng

```
approved-testcases.json
  + Playwright Codegen
  + Gemini (.env)
      ↓
AI Mapping (AIAutomationMapper) → validate locator trong Codegen
      ↓
Tester Review / Approve (Web UI)
      ↓
AI Code Generation (AIAutomationCodegen) → validate syntax/locator/credential/testcaseId
      ↓
Run Playwright (PlaywrightRunner.runFile)
      ↓
Web UI hiển thị kết quả
```

## File gọi Gemini

| Việc | File | Provider |
|---|---|---|
| Đọc `.env` | `src/server/startServer.js` (`import "dotenv/config"`), `src/providers/GeminiProvider.js` | — |
| Khởi tạo GeminiProvider | `src/providers/AIProviderFactory.js` → `createProvider("gemini")` | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| **AI Mapping** | `src/automation/ai/AIAutomationMapper.js` | `this.aiProvider.generate(prompt)` |
| **AI Codegen** | `src/automation/ai/AIAutomationCodegen.js` | `this.aiProvider.generate(prompt)` |
| Điều phối + DI | `src/automation/ai/AIAutomationService.js` | mặc định GeminiProvider; test inject FakeAIProvider |

Production path: `AIAutomationService` → `AIProviderFactory.createProvider("gemini")`.
KHÔNG có runtime fallback sang mock. Gemini lỗi → trả diagnostic rõ, dừng.

## Cấu hình `.env` cần có (trên máy local)

```
AI_PROVIDER=gemini
GEMINI_API_KEY=<key của bạn>
GEMINI_MODEL=gemini-3.1-flash-lite
BASE_URL=http://172.16.1.100:9230
LOGIN_USERNAME=<tài khoản>
LOGIN_PASSWORD=<mật khẩu>
```

> Lưu ý: `.env` hiện đang có `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.1-flash-lite`, `GEMINI_API_KEY` (đã set). **Cần bổ sung** `LOGIN_USERNAME` và `LOGIN_PASSWORD` (máy local).

## Lệnh chạy (máy local)

```bash
# 1. Cài dependencies (root)
npm install

# 2. Cài Chromium (máy local có mạng)
npx playwright install chromium

# 3. Chạy backend (đọc .env, khởi tạo GeminiProvider, routes /api/automation)
node src/server/startServer.js

# 4. Chạy Web UI (dev)
cd web-ui && npm install && npm run dev
# mở http://localhost:5173/automation/ai

# (hoặc build static)
cd web-ui && npm run build
```

## Thực hiện TC001 trên Web UI `/automation/ai`

1. **Bước 1 — Input:** Paste `approved-testcases.json` (TC001–TC004) + paste nội dung `tests/fixtures/playwright-codegen-Login.js`. Bấm **Load Inputs**, chọn **TC001**.
2. **Bước 2 — AI Mapping:** Bấm **AI Analyze & Map**. Hiển thị business step / action / locator / confidence / status. Approve từng step (và route). Nút Generate bật khi tất cả approved.
3. **Bước 3 — AI Generate Code:** Bấm **AI Generate Automation**. Xem code Playwright sinh ra + validation.
4. **Bước 4 — Run:** Bấm **Run Automation**. Xem PASS/FAIL, duration, error, log, diagnostic.

## Đọc log khi Gemini/Playwright lỗi

- Backend log (console của `node src/server/startServer.js`) — in `[Gemini Error]` kèm nguyên nhân network/API.
- Nếu Gemini lỗi: `/api/automation/analyze` trả `{ error: { diagnostic: "AI_MAPPING_FAILED", message } }`.
- Nếu Chromium chưa cài: `/api/automation/run` trả `status: "DIAGNOSTIC"` kèm chỉ dẫn `npx playwright install chromium`.
- Nếu app `172.16.1.100:9230` không truy cập được: `status: "FAILED_APP_UNREACHABLE"`.

## Kết quả kiểm chứng trong sandbox

| Hạng mục | Kết quả |
|---|---|
| Unit/integration test (FakeAIProvider) | PASS (4 suite) |
| Web UI build (`npm run build`) | PASS |
| Syntax validation | PASS |
| Runner diagnostic (thiếu browser) | DIAGNOSTIC (đúng) |
| Gemini live call | `BLOCKED_BY_NETWORK` (sandbox chặn TLS) |
| Real browser/app execution | `REQUIRES_LOCAL_ENVIRONMENT` |

## File tạo/sửa

- `src/automation/ai/AIAutomationMapper.js`
- `src/automation/ai/AIAutomationCodegen.js`
- `src/automation/ai/AIAutomationService.js`
- `src/automation/ai/locatorValidation.js`
- `src/routes/automationRoutes.js` (thêm analyze/generate/run)
- `src/automation/PlaywrightRunner.js` (thêm runFile)
- `web-ui/src/pages/AIAutomationPage.jsx`
- `web-ui/src/api/automationApi.js`
- `web-ui/src/app/router.jsx`
- `tests/helpers/FakeAIProvider.js`
- `tests/automation-ai-{mapper,codegen,api,runner}-test.js`
- `tests/fixtures/playwright-codegen-Login.js`
