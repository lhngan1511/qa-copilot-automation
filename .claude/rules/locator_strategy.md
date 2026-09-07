# Chiến lược Locator (Playwright)

> Áp dụng khi viết/sửa tay code Playwright trong dự án này (renderer, spec mẫu, tests/, tools/).
> Tham khảo từ `docs/claude-testing-kit-main/.claude/rules/locator_strategy.md`, rút gọn cho đúng
> kiến trúc thật của dự án — xem lưu ý quan trọng bên dưới trước khi áp dụng.

## Lưu ý quan trọng — khác kit gốc

Dự án này **không** sinh locator bằng cách agent tự crawl DOM sống rồi đoán/chọn locator
(cách kit gốc làm qua Playwright MCP). Locator trong spec sinh ra đến từ **Recording** — tester
thao tác thật trên trình duyệt, hệ thống ghi lại locator Playwright tự nhận diện
(`src/codegen/recordingParser.js`, `src/codegen/rendererV3.js`). Nguyên tắc gốc: *"Recording là
nguồn sự thật cho locator/action/thứ tự. Không AI/segment/heuristic."*

→ Rule dưới đây áp dụng cho 2 trường hợp thật sự cần chọn locator bằng tay:
1. `rendererV3.js` tự sinh locator **fallback** cho assertion khi recording không có sẵn locator
   cho target (xem `page.getByLabel(...)` / `page.getByText(...)` trong renderer).
2. Code Playwright viết tay khác trong repo (test helper, tool debug, script trong `tools/`).

**Không** áp dụng rule này để "sửa tay" locator trong file `.spec.js` đã sinh — locator sai ở đó
nghĩa là recording cần ghi lại, không phải sửa file sinh ra (xem phần Self-healing bên dưới).

## Thứ tự ưu tiên (từ cao đến thấp)

1. Thuộc tính accessibility / ARIA (`getByRole`, `aria-label`) — semantic, ổn định nhất
2. `data-testid` / `data-test` (`getByTestId`)
3. `id` / `name` ổn định (không phải id tự sinh)
4. Locator semantic khác của Playwright: `getByLabel`, `getByPlaceholder`, `getByText`
5. CSS selector (thuộc tính ổn định, không phải class động)
6. XPath — chỉ khi không còn lựa chọn nào khác, và phải tương đối (không dựa vị trí)

## Nghiêm cấm

- CSS class động/hash tạm thời (vd `css-1n2xyz-btn`)
- `nth-child` / `nth-of-type` khi có lựa chọn tốt hơn
- ID tự sinh bởi framework
- XPath tuyệt đối dựa trên vị trí (vd `//div[3]/div[2]/form/button`)

## Xác minh trước khi dùng

1. Locator match **đúng 1 phần tử** trong DOM
2. Phần tử match đúng là phần tử tương tác được (không phải overlay/shadow DOM)
3. Locator còn đúng sau khi reload/điều hướng lại trang
4. Ổn định qua nhiều trạng thái trang (đang tải, có data, không có data)

## Self-healing khi locator fail lúc chạy test

Khi chạy testcase báo lỗi `LOCATOR_NOT_FOUND` (xem `src/automation/diagnose.js`,
`web-ui/src/utils/runDiagnose.js`), hệ thống đã tự phân loại loại locator bị fail
(role/label/placeholder/text/testid/css/xpath) và đưa gợi ý tương ứng cho tester. Vì locator đến
từ Recording, hướng xử lý đúng luôn là **quay lại Ghi màn hình để cập nhật locator mới rồi sinh
lại automation** — không tự sửa tay locator trong file `.spec.js` đã sinh (sửa tay sẽ bị ghi đè
ở lần Generate kế tiếp và làm mất traceability recording ↔ spec).
