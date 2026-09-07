# Quy tắc cho Claude Code trong dự án này

Khi viết/sửa code Playwright hoặc logic liên quan đến locator, tham chiếu:

- [`.claude/rules/locator_strategy.md`](.claude/rules/locator_strategy.md) — thứ tự ưu tiên chọn locator, nghiêm cấm gì
- [`.claude/rules/playwright_rules.md`](.claude/rules/playwright_rules.md) — chiến lược chờ đợi, cấu hình chạy hiện tại
- [`.claude/rules/codegen_pipeline.md`](.claude/rules/codegen_pipeline.md) — pipeline CodeGen thật của dự án (Recording → Render → Generate → Run → Diagnose)

Nguyên tắc cốt lõi cần nhớ trước khi động vào locator: **locator trong spec sinh ra đến từ
Recording, không phải AI/heuristic đoán** — sửa lỗi locator nghĩa là quay lại Ghi màn hình, không
sửa tay file `.spec.js` đã sinh (bị Generate lần sau ghi đè).
