# QA Copilot V2 - Test Specification

Module: Tài sản

Feature: Thêm thiết bị, Ngừng sử dụng thiết bị, Tìm kiếm thiết bị, Khôi phục thiết bị

Generated: 08:18:01 29 thg 7, 2026

Total Test Cases: 37

---

## TC001 - TestCase đã chỉnh sửa khi review

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC001 |
| Scenario ID | SC001 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | POSITIVE |
| Objective | Xác nhận nội dung Approved TestCase được export |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | Yes |
| Automation Notes | Approved TestCase export marker |
| Requirement References | 1 Thêm thiết bị BR01 BR02 BR03 BR04 EX01 EX02 EX03 EX04 EX05 EX06 |
| Covered Rules | 1 Thêm thiết bị BR01 BR02 BR03 BR04 EX01 EX02 EX03 EX04 EX05 EX06 |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Mã thiết bị: DEVICE_NEW_001
Tên thiết bị: Tên thiết bị kiểm thử
Loại thiết bị: Danh mục loại thiết bị - giá trị hợp lệ
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Nhập dữ liệu | Trường Mã thiết bị nhận giá trị đã nhập |
| 6 | Nhập dữ liệu | Trường Tên thiết bị nhận giá trị đã nhập |
| 7 | Chọn giá trị | Trường Loại thiết bị nhận giá trị đã nhập |
| 8 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 9 | Kiểm tra kết quả nghiệp vụ | Thiết bị được tạo thành công. |

### Kết quả mong đợi

- Kết quả đã duyệt

---

## TC003 - Để trống Tên thiết bị khi thực hiện Thêm thiết bị

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC003 |
| Scenario ID | SC003 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh trường Tên thiết bị là bắt buộc |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Tên thiết bị không được để trống |
| Covered Rules | Tên thiết bị không được để trống |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Mã thiết bị: Mã thiết bị kiểm thử
Loại thiết bị: Loại thiết bị kiểm thử
```

#### Dữ liệu không hợp lệ

```text
Tên thiết bị: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Nhập dữ liệu hợp lệ cho các trường còn lại | Các trường còn lại có dữ liệu hợp lệ |
| 3 | Để trống Tên thiết bị | Tên thiết bị không có giá trị |
| 4 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 5 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Thêm thiết bị và đánh dấu trường Tên thiết bị là không hợp lệ; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Thêm thiết bị và đánh dấu trường Tên thiết bị là không hợp lệ; dữ liệu không thay đổi.

---

## TC004 - Để trống Loại thiết bị khi thực hiện Thêm thiết bị

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC004 |
| Scenario ID | SC003 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh trường Loại thiết bị là bắt buộc |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Loại thiết bị không được để trống |
| Covered Rules | Loại thiết bị không được để trống |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Mã thiết bị: Mã thiết bị kiểm thử
Tên thiết bị: Tên thiết bị kiểm thử
```

#### Dữ liệu không hợp lệ

```text
Loại thiết bị: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Nhập dữ liệu hợp lệ cho các trường còn lại | Các trường còn lại có dữ liệu hợp lệ |
| 3 | Để trống Loại thiết bị | Loại thiết bị không có giá trị |
| 4 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 5 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Thêm thiết bị và đánh dấu trường Loại thiết bị là không hợp lệ; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Thêm thiết bị và đánh dấu trường Loại thiết bị là không hợp lệ; dữ liệu không thay đổi.

---

## TC005 - Mã thiết bị phải là duy nhất.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC005 |
| Scenario ID | SC004 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh quy tắc: Mã thiết bị phải là duy nhất. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Mã thiết bị phải là duy nhất. Mã thiết bị đã tồn tại. |
| Covered Rules | Mã thiết bị phải là duy nhất. Mã thiết bị đã tồn tại. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Tên thiết bị: Tên thiết bị kiểm thử
Loại thiết bị: Loại thiết bị kiểm thử
```

#### Dữ liệu không hợp lệ

```text
Mã thiết bị: MA_THIET_BI_EXISTING_001
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Nhập giá trị đã tồn tại cho Mã thiết bị | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không tạo bản ghi mới bằng giá trị Mã thiết bị đã tồn tại; dữ liệu hiện có không thay đổi. |

### Kết quả mong đợi

- Hệ thống không tạo bản ghi mới bằng giá trị Mã thiết bị đã tồn tại; dữ liệu hiện có không thay đổi.

---

## TC006 - Loại thiết bị phải tồn tại trong danh mục loại thiết bị.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC006 |
| Scenario ID | SC004 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh quy tắc: Loại thiết bị phải tồn tại trong danh mục loại thiết bị. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Loại thiết bị phải tồn tại trong danh mục loại thiết bị. Loại thiết bị không hợp lệ. |
| Covered Rules | Loại thiết bị phải tồn tại trong danh mục loại thiết bị. Loại thiết bị không hợp lệ. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Mã thiết bị: Mã thiết bị kiểm thử
Tên thiết bị: Tên thiết bị kiểm thử
```

#### Dữ liệu không hợp lệ

```text
Loại thiết bị: __INVALID_OPTION__
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Chọn giá trị không hợp lệ cho Loại thiết bị | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không cho phép lưu với Loại thiết bị không thuộc danh sách hợp lệ; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không cho phép lưu với Loại thiết bị không thuộc danh sách hợp lệ; dữ liệu không thay đổi.

---

## TC008 - Dữ liệu chỉ được lưu khi tất cả trường bắt buộc hợp lệ.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC008 |
| Scenario ID | SC004 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh quy tắc: Dữ liệu chỉ được lưu khi tất cả trường bắt buộc hợp lệ. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Dữ liệu chỉ được lưu khi tất cả trường bắt buộc hợp lệ. |
| Covered Rules | Dữ liệu chỉ được lưu khi tất cả trường bắt buộc hợp lệ. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu không hợp lệ

```text
condition: Dữ liệu chỉ được lưu khi tất cả trường bắt buộc hợp lệ.
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Chuẩn bị điều kiện kiểm thử | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Dữ liệu chỉ được lưu khi tất cả trường bắt buộc hợp lệ. |

### Kết quả mong đợi

- Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Dữ liệu chỉ được lưu khi tất cả trường bắt buộc hợp lệ.

---

## TC013 - Người dùng không có quyền thêm thiết bị.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC013 |
| Scenario ID | SC006 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Người dùng không có quyền thêm thiết bị. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Người dùng phải có quyền thêm thiết bị. Kiểm tra Người dùng có quyền thêm thiết bị. Kiểm tra Người dùng phải có quyền thêm thiết bị. Kiểm tra quyền thêm dữ liệu Người dùng không có quyền thêm thiết bị. |
| Covered Rules | Người dùng phải có quyền thêm thiết bị. Kiểm tra Người dùng có quyền thêm thiết bị. Kiểm tra Người dùng phải có quyền thêm thiết bị. Kiểm tra quyền thêm dữ liệu Người dùng không có quyền thêm thiết bị. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Thực hiện thao tác bằng người dùng không có quyền | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không cho phép thực hiện Thêm thiết bị; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không cho phép thực hiện Thêm thiết bị; dữ liệu không thay đổi.

---

## TC015 - Để trống Trường bắt buộc khi thực hiện Thêm thiết bị

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC015 |
| Scenario ID | SC006 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh trường Trường bắt buộc là bắt buộc |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Trường bắt buộc bị bỏ trống. |
| Covered Rules | Trường bắt buộc bị bỏ trống. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Nhập dữ liệu hợp lệ cho các trường còn lại | Các trường còn lại có dữ liệu hợp lệ |
| 3 | Để trống Trường bắt buộc | Trường bắt buộc không có giá trị |
| 4 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 5 | Kiểm tra kết quả nghiệp vụ | Chưa xác định trường bắt buộc cụ thể; cần clarification trước khi tạo dữ liệu kiểm thử. |

### Kết quả mong đợi

- Chưa xác định trường bắt buộc cụ thể; cần clarification trước khi tạo dữ liệu kiểm thử.

---

## TC017 - Dữ liệu vượt quá độ dài cho phép.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC017 |
| Scenario ID | SC006 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Dữ liệu vượt quá độ dài cho phép. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Dữ liệu vượt quá độ dài cho phép. |
| Covered Rules | Dữ liệu vượt quá độ dài cho phép. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Chuẩn bị giá trị vượt giới hạn chưa được xác định | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Chưa thể tạo giá trị biên cụ thể khi giới hạn chưa được xác định; cần clarification. |

### Kết quả mong đợi

- Chưa thể tạo giá trị biên cụ thể khi giới hạn chưa được xác định; cần clarification.

---

## TC018 - Hệ thống xảy ra lỗi trong quá trình lưu.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC018 |
| Scenario ID | SC006 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Hệ thống xảy ra lỗi trong quá trình lưu. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Hệ thống xảy ra lỗi trong quá trình lưu. |
| Covered Rules | Hệ thống xảy ra lỗi trong quá trình lưu. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Thêm thiết bị được hiển thị |
| 2 | Kích hoạt fault injection tại thời điểm xử lý | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Thêm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không tạo dữ liệu không hoàn chỉnh và thể hiện thao tác không thành công. |

### Kết quả mong đợi

- Hệ thống không tạo dữ liệu không hoàn chỉnh và thể hiện thao tác không thành công.

---

## TC020 - Ngừng sử dụng thiết bị

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC020 |
| Scenario ID | SC008 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | POSITIVE |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | 3 Xóa thiết bị BR10 BR11 BR12 BR13 BR14 BR15 EX14 EX15 EX16 EX17 EX18 EX19 EX20 |
| Covered Rules | 3 Xóa thiết bị BR10 BR11 BR12 BR13 BR14 BR15 EX14 EX15 EX16 EX17 EX18 EX19 EX20 |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 5 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 6 | Thực hiện Ngừng sử dụng thiết bị | Yêu cầu được gửi để hệ thống xử lý |
| 7 | Kiểm tra kết quả nghiệp vụ | Cho phép người dùng xóa một thiết bị khỏi hệ thống. |

### Kết quả mong đợi

- Cho phép người dùng xóa một thiết bị khỏi hệ thống.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC021 - Chỉ ngừng sử dụng khi không còn dữ liệu đang xử lý

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC021 |
| Scenario ID | SC009 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | DATA_INTEGRITY |
| Objective | Xác minh quy tắc: Chỉ ngừng sử dụng khi không còn dữ liệu đang xử lý |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Chỉ ngừng sử dụng khi không còn dữ liệu đang xử lý |
| Covered Rules | Chỉ ngừng sử dụng khi không còn dữ liệu đang xử lý |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.
- Bản ghi mục tiêu ở trạng thái còn dữ liệu đang xử lý.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Thực hiện thao tác với bản ghi ở trạng thái bị chặn | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Ngừng sử dụng thiết bị khi bản ghi ở trạng thái bị chặn theo rule; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Ngừng sử dụng thiết bị khi bản ghi ở trạng thái bị chặn theo rule; dữ liệu không thay đổi.

---

## TC022 - Để trống Thiết bị cần xóa khi thực hiện Ngừng sử dụng thiết bị

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC022 |
| Scenario ID | SC010 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh trường Thiết bị cần xóa là bắt buộc |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Thiết bị cần xóa không được để trống |
| Covered Rules | Thiết bị cần xóa không được để trống |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Xác nhận xóa: Xác nhận xóa kiểm thử
```

#### Dữ liệu không hợp lệ

```text
Thiết bị cần xóa: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Nhập dữ liệu hợp lệ cho các trường còn lại | Các trường còn lại có dữ liệu hợp lệ |
| 3 | Để trống Thiết bị cần xóa | Thiết bị cần xóa không có giá trị |
| 4 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 5 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Ngừng sử dụng thiết bị và đánh dấu trường Thiết bị cần xóa là không hợp lệ; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Ngừng sử dụng thiết bị và đánh dấu trường Thiết bị cần xóa là không hợp lệ; dữ liệu không thay đổi.

---

## TC023 - Để trống Xác nhận xóa khi thực hiện Ngừng sử dụng thiết bị

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC023 |
| Scenario ID | SC010 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh trường Xác nhận xóa là bắt buộc |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Xác nhận xóa không được để trống |
| Covered Rules | Xác nhận xóa không được để trống |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Thiết bị cần xóa: Thiết bị cần xóa kiểm thử
```

#### Dữ liệu không hợp lệ

```text
Xác nhận xóa: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Nhập dữ liệu hợp lệ cho các trường còn lại | Các trường còn lại có dữ liệu hợp lệ |
| 3 | Để trống Xác nhận xóa | Xác nhận xóa không có giá trị |
| 4 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 5 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Ngừng sử dụng thiết bị và đánh dấu trường Xác nhận xóa là không hợp lệ; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Ngừng sử dụng thiết bị và đánh dấu trường Xác nhận xóa là không hợp lệ; dữ liệu không thay đổi.

---

## TC026 - Không được xóa thiết bị đang được sử dụng.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC026 |
| Scenario ID | SC011 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh quy tắc: Không được xóa thiết bị đang được sử dụng. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Không được xóa thiết bị đang được sử dụng. Thiết bị đang được sử dụng. |
| Covered Rules | Không được xóa thiết bị đang được sử dụng. Thiết bị đang được sử dụng. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.
- Bản ghi mục tiêu ở trạng thái đang được sử dụng.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Thực hiện thao tác với bản ghi ở trạng thái bị chặn | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Ngừng sử dụng thiết bị khi bản ghi ở trạng thái bị chặn theo rule; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Ngừng sử dụng thiết bị khi bản ghi ở trạng thái bị chặn theo rule; dữ liệu không thay đổi.

---

## TC027 - Không được xóa thiết bị có dữ liệu liên quan nếu hệ thống không cho phép.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC027 |
| Scenario ID | SC011 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh quy tắc: Không được xóa thiết bị có dữ liệu liên quan nếu hệ thống không cho phép. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Không được xóa thiết bị có dữ liệu liên quan nếu hệ thống không cho phép. Thiết bị có dữ liệu liên quan. |
| Covered Rules | Không được xóa thiết bị có dữ liệu liên quan nếu hệ thống không cho phép. Thiết bị có dữ liệu liên quan. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.
- Bản ghi mục tiêu có dữ liệu liên quan.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Thực hiện thao tác với bản ghi có dữ liệu liên quan | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Ngừng sử dụng thiết bị và không làm mất dữ liệu liên quan. |

### Kết quả mong đợi

- Hệ thống không thực hiện Ngừng sử dụng thiết bị và không làm mất dữ liệu liên quan.

---

## TC029 - Việc xóa có thể là xóa mềm hoặc xóa vật lý tùy thiết kế hệ thống.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC029 |
| Scenario ID | SC011 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh quy tắc: Việc xóa có thể là xóa mềm hoặc xóa vật lý tùy thiết kế hệ thống. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Việc xóa có thể là xóa mềm hoặc xóa vật lý tùy thiết kế hệ thống. |
| Covered Rules | Việc xóa có thể là xóa mềm hoặc xóa vật lý tùy thiết kế hệ thống. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu không hợp lệ

```text
condition: Việc xóa có thể là xóa mềm hoặc xóa vật lý tùy thiết kế hệ thống.
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Chuẩn bị điều kiện kiểm thử | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Việc xóa có thể là xóa mềm hoặc xóa vật lý tùy thiết kế hệ thống. |

### Kết quả mong đợi

- Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Việc xóa có thể là xóa mềm hoặc xóa vật lý tùy thiết kế hệ thống.

---

## TC033 - Người dùng không có quyền xóa thiết bị.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC033 |
| Scenario ID | SC013 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Người dùng không có quyền xóa thiết bị. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Người dùng phải có quyền xóa thiết bị. Kiểm tra Người dùng có quyền xóa thiết bị. Kiểm tra Người dùng phải có quyền xóa thiết bị. Kiểm tra quyền xóa dữ liệu Người dùng không có quyền xóa thiết bị. |
| Covered Rules | Người dùng phải có quyền xóa thiết bị. Kiểm tra Người dùng có quyền xóa thiết bị. Kiểm tra Người dùng phải có quyền xóa thiết bị. Kiểm tra quyền xóa dữ liệu Người dùng không có quyền xóa thiết bị. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Thực hiện thao tác bằng người dùng không có quyền | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không cho phép thực hiện Ngừng sử dụng thiết bị; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không cho phép thực hiện Ngừng sử dụng thiết bị; dữ liệu không thay đổi.

---

## TC034 - Thiết bị không tồn tại.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC034 |
| Scenario ID | SC013 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Thiết bị không tồn tại. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Thiết bị cần xóa phải tồn tại. Thiết bị không tồn tại. |
| Covered Rules | Thiết bị cần xóa phải tồn tại. Thiết bị không tồn tại. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu không hợp lệ

```text
targetIdentifier: NON_EXISTING_RECORD
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Thực hiện thao tác với định danh không tồn tại | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Ngừng sử dụng thiết bị với bản ghi không tồn tại; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Ngừng sử dụng thiết bị với bản ghi không tồn tại; dữ liệu không thay đổi.

---

## TC035 - Thiết bị đã bị người dùng khác xóa.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC035 |
| Scenario ID | SC013 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Thiết bị đã bị người dùng khác xóa. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Thiết bị đã bị người dùng khác xóa. |
| Covered Rules | Thiết bị đã bị người dùng khác xóa. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.
- Bản ghi hợp lệ khi mở và bị thay đổi hoặc xóa trước khi gửi thao tác.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Gửi thao tác sau khi bản ghi đã bị thay đổi hoặc xóa | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không ghi đè dữ liệu không còn hợp lệ và yêu cầu tải lại trạng thái mới nhất. |

### Kết quả mong đợi

- Hệ thống không ghi đè dữ liệu không còn hợp lệ và yêu cầu tải lại trạng thái mới nhất.

---

## TC038 - Người dùng hủy xác nhận xóa.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC038 |
| Scenario ID | SC013 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Người dùng hủy xác nhận xóa. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Hệ thống phải yêu cầu xác nhận trước khi xóa. Người dùng hủy xác nhận xóa. |
| Covered Rules | Hệ thống phải yêu cầu xác nhận trước khi xóa. Người dùng hủy xác nhận xóa. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Không xác nhận thao tác | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Ngừng sử dụng thiết bị khi người dùng không xác nhận; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Ngừng sử dụng thiết bị khi người dùng không xác nhận; dữ liệu không thay đổi.

---

## TC039 - Hệ thống xảy ra lỗi trong quá trình xóa.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC039 |
| Scenario ID | SC013 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC003 |
| Function | Ngừng sử dụng thiết bị |
| Chức năng | Ngừng sử dụng thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Hệ thống xảy ra lỗi trong quá trình xóa. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Hệ thống xảy ra lỗi trong quá trình xóa. |
| Covered Rules | Hệ thống xảy ra lỗi trong quá trình xóa. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Ngừng sử dụng thiết bị được hiển thị |
| 2 | Kích hoạt fault injection tại thời điểm xử lý | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Ngừng sử dụng thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không tạo dữ liệu không hoàn chỉnh và thể hiện thao tác không thành công. |

### Kết quả mong đợi

- Hệ thống không tạo dữ liệu không hoàn chỉnh và thể hiện thao tác không thành công.

---

## TC041 - Tìm kiếm thiết bị

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC041 |
| Scenario ID | SC015 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | POSITIVE |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | 4 Tìm kiếm thiết bị BR16 BR17 BR18 BR19 BR20 EX21 EX22 EX23 EX24 EX25 CL001 |
| Covered Rules | 4 Tìm kiếm thiết bị BR16 BR17 BR18 BR19 BR20 EX21 EX22 EX23 EX24 EX25 |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện tìm kiếm | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Hệ thống hiển thị đúng các thiết bị phù hợp. |

### Kết quả mong đợi

- Hệ thống hiển thị đúng các thiết bị phù hợp.
- Không hiển thị thiết bị không thỏa mãn điều kiện.
- Hiển thị thông báo phù hợp khi không có kết quả.
- Kết quả tìm kiếm được phân trang đúng nếu có.
- Dữ liệu hiển thị đúng và đầy đủ.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC042 - Cho phép tìm kiếm bằng một hoặc nhiều điều kiện.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC042 |
| Scenario ID | SC016 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | DATA_INTEGRITY |
| Objective | Xác minh quy tắc: Cho phép tìm kiếm bằng một hoặc nhiều điều kiện. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Cho phép tìm kiếm bằng một hoặc nhiều điều kiện. |
| Covered Rules | Cho phép tìm kiếm bằng một hoặc nhiều điều kiện. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
searchCriteria:
  Mã thiết bị: Ma_thiet_bi_1
  Tên thiết bị: Ten_thiet_bi_2
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Tìm kiếm bằng nhiều điều kiện | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Cần clarification về cách kết hợp điều kiện trước khi xác định kết quả. |

### Kết quả mong đợi

- Cần clarification về cách kết hợp điều kiện trước khi xác định kết quả.

---

## TC043 - Các điều kiện tìm kiếm được kết hợp theo quy tắc của hệ thống.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC043 |
| Scenario ID | SC016 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | DATA_INTEGRITY |
| Objective | Xác minh quy tắc: Các điều kiện tìm kiếm được kết hợp theo quy tắc của hệ thống. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Các điều kiện tìm kiếm được kết hợp theo quy tắc của hệ thống. |
| Covered Rules | Các điều kiện tìm kiếm được kết hợp theo quy tắc của hệ thống. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
searchCriteria:
  Mã thiết bị: Ma_thiet_bi_1
  Tên thiết bị: Ten_thiet_bi_2
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Tìm kiếm bằng nhiều điều kiện | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Cần clarification về cách kết hợp điều kiện trước khi xác định kết quả. |

### Kết quả mong đợi

- Cần clarification về cách kết hợp điều kiện trước khi xác định kết quả.

---

## TC044 - Khi không nhập điều kiện, hệ thống có thể hiển thị toàn bộ dữ liệu hoặc yêu cầu nhập điều kiện.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC044 |
| Scenario ID | SC016 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | DATA_INTEGRITY |
| Objective | Xác minh quy tắc: Khi không nhập điều kiện, hệ thống có thể hiển thị toàn bộ dữ liệu hoặc yêu cầu nhập điều kiện. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Khi không nhập điều kiện, hệ thống có thể hiển thị toàn bộ dữ liệu hoặc yêu cầu nhập điều kiện. |
| Covered Rules | Khi không nhập điều kiện, hệ thống có thể hiển thị toàn bộ dữ liệu hoặc yêu cầu nhập điều kiện. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
searchCriteria:
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Thực hiện tìm kiếm với toàn bộ điều kiện để trống | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Chưa thể xác định một kết quả duy nhất khi không nhập điều kiện; cần clarification được phê duyệt. |

### Kết quả mong đợi

- Chưa thể xác định một kết quả duy nhất khi không nhập điều kiện; cần clarification được phê duyệt.

---

## TC045 - Kết quả có thể được phân trang khi số lượng dữ liệu lớn.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC045 |
| Scenario ID | SC016 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | DATA_INTEGRITY |
| Objective | Xác minh quy tắc: Kết quả có thể được phân trang khi số lượng dữ liệu lớn. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Kết quả có thể được phân trang khi số lượng dữ liệu lớn. |
| Covered Rules | Kết quả có thể được phân trang khi số lượng dữ liệu lớn. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu không hợp lệ

```text
condition: Kết quả có thể được phân trang khi số lượng dữ liệu lớn.
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Chuẩn bị điều kiện kiểm thử | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Kết quả có thể được phân trang khi số lượng dữ liệu lớn. |

### Kết quả mong đợi

- Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Kết quả có thể được phân trang khi số lượng dữ liệu lớn.

---

## TC049 - Kết quả phải tuân thủ quyền xem dữ liệu của người dùng.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC049 |
| Scenario ID | SC017 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | NEGATIVE |
| Objective | Xác minh quy tắc: Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. |
| Covered Rules | Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu không hợp lệ

```text
condition: Kết quả phải tuân thủ quyền xem dữ liệu của người dùng.
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Chuẩn bị điều kiện kiểm thử | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. |

### Kết quả mong đợi

- Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Kết quả phải tuân thủ quyền xem dữ liệu của người dùng.

---

## TC052 - Kiểm tra Kết quả phải tuân thủ quyền xem dữ liệu của người dùng.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC052 |
| Scenario ID | SC018 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | PERMISSION |
| Objective | Xác minh quy tắc: Kiểm tra Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Kiểm tra Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. |
| Covered Rules | Kiểm tra Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. Kết quả phải tuân thủ quyền xem dữ liệu của người dùng. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Thực hiện thao tác bằng người dùng không có quyền | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không cho phép thực hiện Tìm kiếm thiết bị; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không cho phép thực hiện Tìm kiếm thiết bị; dữ liệu không thay đổi.

---

## TC055 - Người dùng không có quyền xem thiết bị.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC055 |
| Scenario ID | SC019 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Người dùng không có quyền xem thiết bị. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Kiểm tra Người dùng có quyền xem danh sách thiết bị. Kiểm tra quyền xem dữ liệu Người dùng không có quyền xem thiết bị. |
| Covered Rules | Kiểm tra Người dùng có quyền xem danh sách thiết bị. Kiểm tra quyền xem dữ liệu Người dùng không có quyền xem thiết bị. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Thực hiện thao tác bằng người dùng không có quyền | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không cho phép thực hiện Tìm kiếm thiết bị; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không cho phép thực hiện Tìm kiếm thiết bị; dữ liệu không thay đổi.

---

## TC056 - Điều kiện tìm kiếm không hợp lệ.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC056 |
| Scenario ID | SC019 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Điều kiện tìm kiếm không hợp lệ. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Điều kiện tìm kiếm không hợp lệ. |
| Covered Rules | Điều kiện tìm kiếm không hợp lệ. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu không hợp lệ

```text
condition: Điều kiện tìm kiếm không hợp lệ.
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Chuẩn bị điều kiện kiểm thử | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Điều kiện tìm kiếm không hợp lệ. |

### Kết quả mong đợi

- Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Điều kiện tìm kiếm không hợp lệ.

---

## TC057 - Không tìm thấy dữ liệu phù hợp.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC057 |
| Scenario ID | SC019 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Không tìm thấy dữ liệu phù hợp. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Không tìm thấy dữ liệu phù hợp. |
| Covered Rules | Không tìm thấy dữ liệu phù hợp. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
searchCriteria:
  Mã thiết bị: Ma_thiet_bi_1
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Tìm kiếm bằng tiêu chí không có bản ghi phù hợp | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống hiển thị trạng thái không có dữ liệu phù hợp và không hiển thị bản ghi sai điều kiện. |

### Kết quả mong đợi

- Hệ thống hiển thị trạng thái không có dữ liệu phù hợp và không hiển thị bản ghi sai điều kiện.

---

## TC058 - Ký tự đặc biệt gây lỗi xử lý.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC058 |
| Scenario ID | SC019 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Ký tự đặc biệt gây lỗi xử lý. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Ký tự đặc biệt gây lỗi xử lý. |
| Covered Rules | Ký tự đặc biệt gây lỗi xử lý. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu không hợp lệ

```text
condition: Ký tự đặc biệt gây lỗi xử lý.
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Chuẩn bị điều kiện kiểm thử | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Ký tự đặc biệt gây lỗi xử lý. |

### Kết quả mong đợi

- Chưa có đủ dữ liệu để tạo trạng thái kiểm thử cụ thể cho rule: Ký tự đặc biệt gây lỗi xử lý.

---

## TC059 - Hệ thống xảy ra lỗi trong quá trình truy vấn.

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC059 |
| Scenario ID | SC019 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC004 |
| Function | Tìm kiếm thiết bị |
| Chức năng | Tìm kiếm thiết bị |
| Loại | EXCEPTION |
| Objective | Xác minh quy tắc: Hệ thống xảy ra lỗi trong quá trình truy vấn. |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Hệ thống xảy ra lỗi trong quá trình truy vấn. |
| Covered Rules | Hệ thống xảy ra lỗi trong quá trình truy vấn. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Tìm kiếm thiết bị được hiển thị |
| 2 | Kích hoạt fault injection tại thời điểm xử lý | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Tìm kiếm thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không tạo dữ liệu không hoàn chỉnh và thể hiện thao tác không thành công. |

### Kết quả mong đợi

- Hệ thống không tạo dữ liệu không hoàn chỉnh và thể hiện thao tác không thành công.

---

## TC061 - Khôi phục thiết bị

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC061 |
| Scenario ID | SC021 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC005 |
| Function | Khôi phục thiết bị |
| Chức năng | Khôi phục thiết bị |
| Loại | POSITIVE |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | USER-EDIT-001 |
| Covered Rules | USER-EDIT-001 |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập vào hệ thống.
- Người dùng có quyền truy cập màn hình quản lý thiết bị.
- Người dùng có quyền thực hiện chức năng tương ứng.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 2 | Thực hiện Khôi phục thiết bị | Yêu cầu được gửi để hệ thống xử lý |
| 3 | Kiểm tra kết quả nghiệp vụ | Khôi phục trạng thái sử dụng |

### Kết quả mong đợi

- Khôi phục trạng thái sử dụng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC062 - Chỉ khôi phục thiết bị đã ngừng sử dụng

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC062 |
| Scenario ID | SC022 |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC005 |
| Function | Khôi phục thiết bị |
| Chức năng | Khôi phục thiết bị |
| Loại | DATA_INTEGRITY |
| Objective | Xác minh quy tắc: Chỉ khôi phục thiết bị đã ngừng sử dụng |
| Priority | HIGH |
| Severity | HIGH |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | Chỉ khôi phục thiết bị đã ngừng sử dụng |
| Covered Rules | Chỉ khôi phục thiết bị đã ngừng sử dụng |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập vào hệ thống.
- Người dùng có quyền truy cập màn hình quản lý thiết bị.
- Người dùng có quyền thực hiện chức năng tương ứng.
- Bản ghi mục tiêu ở trạng thái đã ngừng sử dụng.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình hoặc chức năng | Khôi phục thiết bị được hiển thị |
| 2 | Thực hiện thao tác với bản ghi ở trạng thái bị chặn | Điều kiện kiểm thử được thiết lập |
| 3 | Thực hiện Khôi phục thiết bị | Hệ thống kiểm tra điều kiện nghiệp vụ |
| 4 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thực hiện Khôi phục thiết bị khi bản ghi ở trạng thái bị chặn theo rule; dữ liệu không thay đổi. |

### Kết quả mong đợi

- Hệ thống không thực hiện Khôi phục thiết bị khi bản ghi ở trạng thái bị chặn theo rule; dữ liệu không thay đổi.

---

## TC063 - Scenario người dùng thêm

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC063 |
| Scenario ID | SC-USER |
| Module ID | MOD001 |
| Module | Tài sản |
| Function ID | FUNC001 |
| Function | Thêm thiết bị |
| Chức năng | Thêm thiết bị |
| Loại | POSITIVE |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | Yes |
| Automation Notes |  |
| Requirement References | 1 Thêm thiết bị BR01 BR02 BR03 BR04 EX01 EX02 EX03 EX04 EX05 EX06 |
| Covered Rules | 1 Thêm thiết bị BR01 BR02 BR03 BR04 EX01 EX02 EX03 EX04 EX05 EX06 |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Mã thiết bị: DEVICE_NEW_001
Tên thiết bị: Tên thiết bị kiểm thử
Loại thiết bị: Danh mục loại thiết bị - giá trị hợp lệ
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Nhập dữ liệu | Trường Mã thiết bị nhận giá trị đã nhập |
| 6 | Nhập dữ liệu | Trường Tên thiết bị nhận giá trị đã nhập |
| 7 | Chọn giá trị | Trường Loại thiết bị nhận giá trị đã nhập |
| 8 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 9 | Kiểm tra kết quả nghiệp vụ | Thiết bị được tạo thành công. |

### Kết quả mong đợi

- Kết quả người dùng thêm

