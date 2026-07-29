# Module: Bảng điều khiển

## Thông tin chung

### Mục đích

Cho phép người dùng theo dõi nhanh tình hình quản lý trang thiết bị, công cụ dụng cụ thông qua các thống kê tổng quan, cảnh báo và thao tác nhanh.

### Quyền truy cập

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập chức năng Bảng điều khiển.

---

# Features

## Feature: Thao tác nhanh

### Mô tả

Cho phép người dùng truy cập nhanh đến các chức năng chính của hệ thống.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền sử dụng chức năng tương ứng.

### Dữ liệu đầu vào

| Trường    | Bắt buộc | Mô tả                         |
| --------- | -------- | ----------------------------- |
| Chức năng | Không    | Chức năng người dùng lựa chọn |

### Luồng chính

1. Người dùng mở màn hình Bảng điều khiển.
2. Hệ thống hiển thị danh sách các thao tác nhanh.
3. Người dùng chọn một thao tác nhanh.
4. Hệ thống kiểm tra quyền truy cập của người dùng.
5. Hệ thống chuyển đến chức năng tương ứng.

### Danh sách thao tác

| STT | Thao tác                          | Điều hướng đến                              |
| --- | --------------------------------- | ------------------------------------------- |
| 1   | Lập kế hoạch mua sắm              | Kế hoạch mua sắm                            |
| 2   | Mua mới & cấp phát ngay           | Phiếu nhập thiết bị, công cụ dụng cụ        |
| 3   | Nhập kho                          | Phiếu nhập thiết bị, công cụ dụng cụ        |
| 4   | Theo dõi tài sản, công cụ dụng cụ | Danh sách bộ thiết bị / thiết bị            |
| 5   | Cấp phát                          | Cấp phát Bộ thiết bị / Thiết bị / CCDC      |
| 6   | Kiểm kê                           | Danh sách kiểm kê thiết bị, công cụ dụng cụ |

### Kết quả mong đợi

- Danh sách thao tác nhanh hiển thị đúng.
- Điều hướng đúng chức năng được chọn.

### Quy tắc cơ bản

- Chỉ hiển thị các thao tác mà người dùng có quyền sử dụng.
- Mỗi thao tác phải điều hướng đến đúng chức năng.
- Nếu người dùng không có quyền thì thao tác không được hiển thị hoặc không được phép truy cập.

### Automation

- Verify quick action visibility.
- Verify navigation.
- Verify permission.

---

## Feature: Thống kê nhập xuất

### Mô tả

Hiển thị thống kê tổng quan về tình hình nhập kho, xuất kho và tồn kho.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.

### Dữ liệu đầu vào

| Trường           | Bắt buộc | Mô tả                     |
| ---------------- | -------- | ------------------------- |
| Khoảng thời gian | Không    | Khoảng thời gian thống kê |

### Luồng chính

1. Người dùng mở màn hình Bảng điều khiển.
2. Hệ thống tải dữ liệu thống kê.
3. Người dùng thay đổi khoảng thời gian.
4. Hệ thống cập nhật thống kê.

### Kết quả mong đợi

- Thống kê được tải thành công.
- Dữ liệu được cập nhật theo khoảng thời gian.

### Quy tắc cơ bản

- Chỉ hiển thị dữ liệu người dùng được phép xem.
- Nếu không có dữ liệu thì hiển thị trạng thái phù hợp.

### Automation

- Verify dashboard loads.
- Verify filter.
- Verify refresh.
- Verify empty state.

---

## Feature: Thống kê tình trạng cấp phát

### Mô tả

Hiển thị thống kê tình trạng cấp phát thiết bị và công cụ dụng cụ.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.

### Dữ liệu đầu vào

| Trường           | Bắt buộc | Mô tả                     |
| ---------------- | -------- | ------------------------- |
| Khoảng thời gian | Không    | Khoảng thời gian thống kê |

### Luồng chính

1. Người dùng mở Dashboard.
2. Hệ thống tải dữ liệu cấp phát.
3. Người dùng thay đổi khoảng thời gian.
4. Hệ thống cập nhật thống kê.

### Kết quả mong đợi

- Thống kê được hiển thị thành công.
- Dữ liệu được cập nhật theo khoảng thời gian.

### Quy tắc cơ bản

- Chỉ hiển thị dữ liệu hợp lệ.

### Automation

- Verify dashboard loads.
- Verify filter.
- Verify refresh.
- Verify empty state.

---

## Feature: Yêu cầu bảo trì

### Mô tả

Hiển thị danh sách các yêu cầu bảo trì đang xử lý.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.

### Dữ liệu đầu vào

Không có.

### Luồng chính

1. Người dùng mở Dashboard.
2. Hệ thống tải danh sách yêu cầu bảo trì.

### Kết quả mong đợi

- Danh sách yêu cầu bảo trì hiển thị thành công.

### Quy tắc cơ bản

- Nếu không có dữ liệu thì hiển thị trạng thái phù hợp.

### Automation

- Verify widget display.
- Verify empty state.

---

## Feature: Thiết bị sắp hết hạn bảo hành

### Mô tả

Hiển thị danh sách thiết bị sắp hết hạn bảo hành.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.

### Dữ liệu đầu vào

Không có.

### Luồng chính

1. Người dùng mở Dashboard.
2. Hệ thống tải danh sách thiết bị.

### Kết quả mong đợi

- Danh sách hiển thị thành công.

### Quy tắc cơ bản

- Chỉ hiển thị các thiết bị thuộc phạm vi người dùng được phép xem.

### Automation

- Verify widget display.
- Verify empty state.

---

## Feature: Thiết bị sắp bảo dưỡng

### Mô tả

Hiển thị danh sách thiết bị sắp đến kỳ bảo dưỡng.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.

### Dữ liệu đầu vào

Không có.

### Luồng chính

1. Người dùng mở Dashboard.
2. Hệ thống tải danh sách thiết bị cần bảo dưỡng.

### Kết quả mong đợi

- Danh sách hiển thị thành công.

### Quy tắc cơ bản

- Chỉ hiển thị các thiết bị thuộc phạm vi người dùng được phép xem.

### Automation

- Verify widget display.
- Verify empty state.

---

## Feature: Nhật ký kho gần nhất

### Mô tả

Hiển thị các giao dịch kho gần nhất.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.

### Dữ liệu đầu vào

Không có.

### Luồng chính

1. Người dùng mở Dashboard.
2. Hệ thống tải nhật ký kho gần nhất.

### Kết quả mong đợi

- Nhật ký kho được hiển thị thành công.

### Quy tắc cơ bản

- Chỉ hiển thị các giao dịch người dùng được phép xem.
- Nếu không có dữ liệu thì hiển thị trạng thái phù hợp.

### Automation

- Verify widget display.
- Verify empty state.
