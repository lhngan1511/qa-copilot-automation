# Quy trình CodeGen của dự án (đối chiếu với kit tham khảo)

> Đối chiếu `docs/claude-testing-kit-main/.claude/commands/generate_automation_from_ui_flow.md`
> (pipeline lý tưởng: navigate → snapshot DOM → thu locator → sinh Page Object + test → chạy →
> tự vá locator lỗi → xác nhận PASS ổn định 2 lần) với pipeline thật của dự án này.

## Pipeline thật của dự án

```
Ghi màn hình (Recording)          — tester thao tác thật, hệ thống ghi lại action + locator
        ↓  CodeGenRecordingStore / CodeGenSessionManager
Duyệt Recording (APPROVED)        — chỉ recording mới nhất đã duyệt mới được dùng để sinh (pickLatestApproved)
        ↓  recordingParser.js
Xác nhận Test Data / Assertion    — tester xác nhận data + assertion (TESTER_CONFIRMED)
        ↓  rendererV3.js  (RENDER THUẦN — không ghi file, không AI/heuristic đoán locator)
Sinh spec.js                      — GenerateService.js ghi outputs/generated-tests/TC00N.spec.js
        ↓
Chạy (Run)                        — PlaywrightRunner.js, phân loại lỗi qua diagnose.js
        ↓
Chẩn đoán + gợi ý sửa             — LOCATOR_NOT_FOUND → guidanceFor() gợi ý theo loại locator,
                                     trỏ tester quay lại bước Ghi màn hình (không sửa tay spec)
```

## Khác biệt cố ý so với kit tham khảo

| Kit tham khảo | Dự án này | Vì sao |
|---|---|---|
| Agent tự navigate + snapshot DOM sống, tự chọn locator | Locator đến từ Recording thao tác thật của tester | Tránh AI đoán sai locator trên hệ thống nghiệp vụ thật — nguyên tắc gốc của `rendererV3.js` |
| Sinh Page Object Model | Sinh spec phẳng 1 file/testcase | Input là 1 Recording ↔ 1 testcase, không phải code viết tay cần tái sử dụng qua nhiều test |
| Auto-heal locator tự động sửa code khi fail | Gợi ý theo loại locator + trỏ về Ghi màn hình (xem [locator_strategy.md](locator_strategy.md) mục Self-healing) | Sửa tay/tự động locator trong spec đã sinh sẽ bị Generate lần sau ghi đè, mất traceability với recording |

## Còn thiếu so với kit — cân nhắc bổ sung sau (chưa làm, cần xác nhận trước khi đổi)

- **Xác nhận PASS ổn định ≥2 lần liên tiếp** trước khi tester coi testcase là "xong" — hiện tại
  `RunTab` (AutomationInspector.jsx) chỉ hiển thị kết quả lần chạy gần nhất, không có khái niệm
  đếm số lần PASS liên tiếp. Đây là gợi ý từ Definition of Done của kit, **không tự thêm** vì ảnh
  hưởng UI/luồng thao tác của tester — cần trao đổi trước.
