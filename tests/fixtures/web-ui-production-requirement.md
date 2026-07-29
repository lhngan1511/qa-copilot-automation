# Module: Quản lý thiết bị

## Thông tin chung

### Mục đích

Quản lý thông tin thiết bị.

### Quyền truy cập

- Người dùng phải có quyền thêm thiết bị.

# Features

## Feature: Thêm thiết bị

### Mô tả

Cho phép người dùng thêm một thiết bị mới.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.

### Input

| Trường       | Bắt buộc | Quy tắc                              |
| ------------ | -------- | ------------------------------------ |
| Mã thiết bị  | Có       | Không được để trống và phải duy nhất |
| Tên thiết bị | Có       | Không được để trống                  |

### Luồng chính

1. Người dùng mở chức năng thêm thiết bị.
2. Người dùng nhập thông tin.
3. Người dùng lưu dữ liệu.
4. Hệ thống kiểm tra và tạo thiết bị.

### Quy tắc nghiệp vụ

- Mã thiết bị phải duy nhất.
- Người dùng phải có quyền thêm thiết bị.

### Validation

- Mã thiết bị không được để trống.
- Tên thiết bị không được để trống.

### Kết quả mong đợi

- Thiết bị được tạo thành công khi dữ liệu hợp lệ.
