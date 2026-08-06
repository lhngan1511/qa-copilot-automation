# Bộ file demo — Automation Workspace (Giai đoạn 2)

Thư mục này chứa **bộ file mẫu** để tải lên ở bước **① Upload** của màn hình
**Automation Workspace** nhằm chạy thử luồng:

```
Upload → AI Mapping → Review → Sinh automation → Chạy → Export
```

## Có gì

| Thư mục       | approved-testcases.json                         | codegen.js                                |
| ------------- | ----------------------------------------------- | ----------------------------------------- |
| `dang-nhap/`  | 3 testcase: đăng nhập thành công / sai mật khẩu / để trống tài khoản | CodeGen màn hình Đăng nhập |
| `don-vi-tinh/`| 3 testcase: thêm mới / tìm kiếm / để trống tên  | CodeGen Danh mục đơn vị tính (kèm đăng nhập) |

Mỗi testcase đều có:
- `id` + `title` + `module`/`feature` → hiển thị trên card.
- `testData.fields` → tab **Dữ liệu kiểm thử**.
- `expectedResult` + `assertions` → tab **Kết quả mong đợi**.
- `executionReadiness` = `READY` (chạy được) hoặc `DATA_REQUIRED` (để demo luồng "Bổ sung dữ liệu").

Mỗi `codegen.js` chứa locator Playwright thật (`getByLabel`, `getByRole`, `getByText`…)
để **AI Mapping** đối chiếu. Locator phải khớp với CodeGen (mapper sẽ đánh dấu
locator không có trong CodeGen thành `NEED_USER_CONFIRMATION`).

## Cách dùng (demo trên máy Windows)

1. Vào **Automation Workspace** → bước ① **Upload dữ liệu**.
2. Tải **`dang-nhap/approved-testcases.json`** và **`dang-nhap/codegen.js`**
   (hoặc bộ `don-vi-tinh`).
3. Bấm **② Chạy AI Mapping** → chờ AI đối chiếu.
4. Bước **③ Review**: xem card, bấm **Xem chi tiết AI** để kiểm tra Mapping /
   Dữ liệu / Kết quả mong đợi; bổ sung dữ liệu nếu có `⚠ Thiếu`.
5. Bước **④ Sinh automation** → **⑤ Chạy** → quan sát **PASS / FAIL**.
6. Bước **⑥ Export** → ra `selected-testcases.json`.

## Bước ⑤ Chạy (Run) cần gì

`Run` dùng **Playwright + Chrome/Edge** và đọc biến môi trường trong file **`.env`**:

```
BASE_URL=<địa chỉ hệ thống, vd http://192.168.1.10/wasuco>
LOGIN_USERNAME=<tài khoản>
LOGIN_PASSWORD=<mật khẩu>
LOGIN_CAPTCHA=<mã xác nhận (nếu có)>
```

- Sandbox ở đây **không có Chromium/Gemini** nên không thể xác minh bước Run —
  phải chạy trên máy Windows có Chrome/Edge cài sẵn.
- Nếu bước Generate trả về **`AI_CODEGEN_REJECTED`**: đọc `validation.errors` —
  thường do code sinh bị **hardcode URL / credential** hoặc dùng **locator ngoài
  mapping** — đây là hành vi đúng của bộ lọc an toàn, cần chỉnh lại CodeGen/locator.

## Lưu ý

- Bộ file này chỉ là **mẫu demo**, locator/screen/route có thể chưa khớp 100% với
  hệ thống thật của bạn. Để demo chạy được, hãy thay CodeGen bằng file ghi lại
  thật (Playwright Codegen) trên màn hình bạn muốn, hoặc sửa `route`/locator
  cho khớp.
