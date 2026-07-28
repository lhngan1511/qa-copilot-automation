# Module: Đăng nhập

## Thông tin chung

### Mục đích

Cho phép người dùng đăng nhập vào hệ thống.

### Quyền truy cập

- Người dùng chưa đăng nhập.
- Người dùng có tài khoản trong hệ thống.

# Features

## Feature: Đăng nhập

### Mô tả

Người dùng nhập thông tin đăng nhập để truy cập hệ thống.

### Điều kiện tiên quyết

- Người dùng đang ở màn hình đăng nhập.

### Dữ liệu đầu vào

| Trường      | Bắt buộc | Mô tả                        |
| ----------- | -------- | ---------------------------- |
| Tài khoản   | Có       | Tài khoản đăng nhập          |
| Mật khẩu    | Có       | Mật khẩu của tài khoản       |
| Mã xác nhận | Có       | Hiện tại cho phép nhập tùy ý |

### Luồng chính

1. Người dùng nhập tài khoản.
2. Người dùng nhập mật khẩu.
3. Người dùng nhập mã xác nhận.
4. Người dùng chọn Đăng nhập.
5. Hệ thống kiểm tra tài khoản và mật khẩu.
6. Hệ thống chuyển người dùng vào trang chính.

### Kết quả mong đợi

- Người dùng đăng nhập thành công khi tài khoản và mật khẩu hợp lệ.
- Người dùng được chuyển vào hệ thống.

### Quy tắc cơ bản

- Tài khoản không được để trống.
- Mật khẩu không được để trống.
- Mã xác nhận không được để trống.
- Mã xác nhận hiện tại không cần giống CAPTCHA hiển thị.
- Sai tài khoản hoặc mật khẩu thì không được đăng nhập.

### Automation

Screen: Login

Operation: Login
