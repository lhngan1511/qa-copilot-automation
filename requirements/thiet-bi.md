# Thiết bị


## Mục đích trang

Quản lý thông tin thiết bị trong hệ thống.


## Mô tả

Cho phép người dùng thao tác thêm, sửa, xóa và tìm kiếm thiết bị.


## Quyền truy cập

- Người dùng đã đăng nhập vào hệ thống
- Người dùng có quyền quản lý thiết bị



## Dữ liệu dùng chung

| Trường | Control Type | Nguồn dữ liệu | Bắt buộc | Mô tả |
|--------|--------------|---------------|----------|-------|
| Mã thiết bị | TextBox | Người dùng nhập | Có | Mã duy nhất của thiết bị |
| Tên thiết bị | TextBox | Người dùng nhập | Có | Tên hiển thị của thiết bị |
| Loại thiết bị | Dropdown | Danh mục | Có | Chọn từ danh mục loại thiết bị |



## Quan hệ dữ liệu

| Đối tượng liên quan | Quan hệ | Mô tả |
|--------------------|---------|------|
| Phiếu nhập | Phụ thuộc | Không được xóa thiết bị đã được sử dụng trong phiếu nhập |

# Tính năng


# 1. Thêm thiết bị

## Mô tả

Cho phép người dùng thêm mới thiết bị.

---

## Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền quản lý thiết bị.
- Danh mục loại thiết bị đã tồn tại.

---

## Luồng xử lý

1. Người dùng mở màn hình Thêm thiết bị.
2. Nhập Mã thiết bị.
3. Nhập Tên thiết bị.
4. Chọn Loại thiết bị.
5. Nhấn nút Lưu.
6. Hệ thống kiểm tra thông tin.
7. Hệ thống lưu dữ liệu.

---

## Quy tắc nghiệp vụ

| Mã | Nội dung |
|----|----------|
| BR01 | Mã thiết bị không được trùng. |
| BR02 | Không được bỏ trống các trường bắt buộc. |

---

## Kết quả mong đợi

- Hiển thị thông báo "Thêm thiết bị thành công".
- Thiết bị mới hiển thị trong danh sách.

---

## Trường hợp ngoại lệ

| Mã | Nội dung |
|----|----------|
| EX01 | Mã thiết bị đã tồn tại. |
| EX02 | Thiếu thông tin bắt buộc. |



# 2. Sửa thiết bị

## Mô tả

Cho phép người dùng cập nhật thông tin thiết bị.

---

## Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền quản lý thiết bị.
- Thiết bị cần sửa đã tồn tại trong hệ thống.

---

## Luồng xử lý

1. Người dùng mở danh sách thiết bị.
2. Chọn thiết bị cần sửa.
3. Hệ thống hiển thị thông tin hiện tại.
4. Người dùng cập nhật thông tin.
5. Nhấn nút Lưu.
6. Hệ thống kiểm tra dữ liệu.
7. Hệ thống cập nhật thông tin.

---

## Quy tắc nghiệp vụ

| Mã | Nội dung |
|----|----------|
| BR03 | Không được bỏ trống các trường bắt buộc. |

---

## Kết quả mong đợi

- Hiển thị thông báo cập nhật thành công.
- Thông tin thiết bị được cập nhật trong danh sách.

---

## Trường hợp ngoại lệ

| Mã | Nội dung |
|----|----------|
| EX03 | Thiết bị không tồn tại. |


## 3. Xóa thiết bị


### Mô tả

Cho phép người dùng xóa thiết bị.


### Luồng xử lý

- Chọn thiết bị
- Nhấn nút Xóa
- Xác nhận xóa


### Quy tắc nghiệp vụ

- Không được xóa thiết bị đã sử dụng trong Phiếu Nhập


### Kết quả mong đợi

- Thiết bị được xóa khỏi danh sách


### Trường hợp ngoại lệ

- Thiết bị đang được sử dụng



# 4. Tìm kiếm thiết bị

## Mô tả

Cho phép người dùng tìm kiếm thiết bị theo điều kiện.

---

## Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Hệ thống có dữ liệu thiết bị.

---

## Luồng xử lý

1. Người dùng mở màn hình danh sách thiết bị.
2. Nhập từ khóa tìm kiếm.
3. Nhấn nút Tìm kiếm.
4. Hệ thống thực hiện tìm kiếm.
5. Hệ thống hiển thị kết quả.

---

## Quy tắc nghiệp vụ

| Mã | Nội dung |
|----|----------|
| BR05 | Kết quả tìm kiếm phải đúng với điều kiện tìm kiếm. |

---

## Kết quả mong đợi

- Hiển thị danh sách thiết bị phù hợp.
- Không hiển thị dữ liệu không liên quan.

---

## Trường hợp ngoại lệ

| Mã | Nội dung |
|----|----------|
| EX05 | Không tìm thấy dữ liệu phù hợp. |