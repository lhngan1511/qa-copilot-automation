# QA Copilot V2 - Test Specification

Module: Danh mục đơn vị tính

Feature: Thêm mới đơn vị tính, Sinh mã đơn vị tính, Tìm kiếm đơn vị tính

Generated: 12:58:27 28 thg 7, 2026

Total Test Cases: 23

---

## TC001 - Thêm mới đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC001 |
| Scenario ID | SC001 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC001 |
| Function | Thêm mới đơn vị tính |
| Chức năng | Thêm mới đơn vị tính |
| Loại | POSITIVE |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | No |
| Automation Notes |  |
| Requirement References | 1 Thêm mới đơn vị tính BR01 BR02 BR03 BR04 BR05 BR06 BR07 EX01 EX02 EX03 EX04 EX05 EX06 EX07 EX08 EX09 Sinh mã đơn vị tính BR08 BR09 BR10 BR12 CL001 CL002 |
| Covered Rules | 1 Thêm mới đơn vị tính BR01 BR02 BR03 BR04 BR05 BR06 BR07 EX01 EX02 EX03 EX04 EX05 EX06 EX07 EX08 EX09 Sinh mã đơn vị tính BR08 BR09 BR10 BR12 CL001 |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền truy cập danh mục đơn vị tính
- Người dùng có quyền thêm mới đơn vị tính
- Người dùng đang ở màn hình Danh mục đơn vị tính
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị

### Dữ liệu kiểm thử

#### Dữ liệu hợp lệ

```text
Tên đơn vị tính: Tên đơn vị tính kiểm thử
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 5 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 6 | Nhập dữ liệu | Trường Tên đơn vị tính nhận giá trị đã nhập |
| 7 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 8 | Kiểm tra kết quả nghiệp vụ | Cho phép người dùng thêm mới một đơn vị tính vào danh mục. |

### Kết quả mong đợi

- Cho phép người dùng thêm mới một đơn vị tính vào danh mục.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC002 - Kiểm tra quy tắc nghiệp vụ của Thêm mới đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC002 |
| Scenario ID | SC002 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC001 |
| Function | Thêm mới đơn vị tính |
| Chức năng | Thêm mới đơn vị tính |
| Loại | DATA_INTEGRITY |
| Objective | Kiểm tra tính toàn vẹn dữ liệu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 1 Thêm mới đơn vị tính BR01 BR02 BR03 BR04 BR05 BR06 BR07 EX01 EX02 EX03 EX04 EX05 EX06 EX07 EX08 EX09 Sinh mã đơn vị tính BR08 BR09 BR10 BR12 CL001 CL002 |
| Covered Rules | Tên đơn vị tính là trường bắt buộc. Mã đơn vị tính phải là duy nhất. Người dùng được phép nhập mã thủ công. Người dùng được phép sử dụng chức năng sinh mã. Khi mã đơn vị tính được để trống, hệ thống xử lý tự sinh mã theo cấu hình. Dữ liệu chỉ được lưu khi các trường bắt buộc hợp lệ. Người dùng phải có quyền thêm mới đơn vị tính. Mã đơn vị tính phải là duy nhất Dữ liệu chỉ được lưu khi các trường bắt buộc hợp lệ Mã được sinh phải là duy nhất Mã được sinh phải tuân thủ định dạng của hệ thống Chức năng sinh mã không làm mất dữ liệu tại các trường khác đã nhập trước đó Chức năng sinh mã chỉ tạo giá trị, chưa thực hiện lưu dữ liệu |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền truy cập danh mục đơn vị tính
- Người dùng có quyền thêm mới đơn vị tính
- Người dùng đang ở màn hình Danh mục đơn vị tính
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 5 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 6 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 7 | Kiểm tra kết quả nghiệp vụ | Tên đơn vị tính là trường bắt buộc. |

### Kết quả mong đợi

- Tên đơn vị tính là trường bắt buộc.
- Mã đơn vị tính phải là duy nhất.
- Người dùng được phép nhập mã thủ công.
- Người dùng được phép sử dụng chức năng sinh mã.
- Khi mã đơn vị tính được để trống, hệ thống xử lý tự sinh mã theo cấu hình.
- Dữ liệu chỉ được lưu khi các trường bắt buộc hợp lệ.
- Người dùng phải có quyền thêm mới đơn vị tính.
- Mã đơn vị tính phải là duy nhất
- Dữ liệu chỉ được lưu khi các trường bắt buộc hợp lệ
- Mã được sinh phải là duy nhất
- Mã được sinh phải tuân thủ định dạng của hệ thống
- Chức năng sinh mã không làm mất dữ liệu tại các trường khác đã nhập trước đó
- Chức năng sinh mã chỉ tạo giá trị, chưa thực hiện lưu dữ liệu
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC003 - Kiểm tra dữ liệu không hợp lệ của Thêm mới đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC003 |
| Scenario ID | SC003 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC001 |
| Function | Thêm mới đơn vị tính |
| Chức năng | Thêm mới đơn vị tính |
| Loại | NEGATIVE |
| Objective | Kiểm tra xử lý dữ liệu không hợp lệ |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 1 Thêm mới đơn vị tính BR01 BR02 BR03 BR04 BR05 BR06 BR07 EX01 EX02 EX03 EX04 EX05 EX06 EX07 EX08 EX09 Sinh mã đơn vị tính BR08 BR09 BR10 BR12 CL001 CL002 |
| Covered Rules | Tên đơn vị tính là trường bắt buộc. Mã đơn vị tính phải là duy nhất. Người dùng được phép nhập mã thủ công. Người dùng được phép sử dụng chức năng sinh mã. Khi mã đơn vị tính được để trống, hệ thống xử lý tự sinh mã theo cấu hình. Dữ liệu chỉ được lưu khi các trường bắt buộc hợp lệ. Người dùng phải có quyền thêm mới đơn vị tính. Tên đơn vị tính không được để trống Tên đơn vị tính là trường bắt buộc Mã đơn vị tính không được trùng lặp |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền truy cập danh mục đơn vị tính
- Người dùng có quyền thêm mới đơn vị tính
- Người dùng đang ở màn hình Danh mục đơn vị tính
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 5 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 6 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 7 | Kiểm tra kết quả nghiệp vụ | Tên đơn vị tính là trường bắt buộc. |

### Kết quả mong đợi

- Tên đơn vị tính là trường bắt buộc.
- Mã đơn vị tính phải là duy nhất.
- Người dùng được phép nhập mã thủ công.
- Người dùng được phép sử dụng chức năng sinh mã.
- Khi mã đơn vị tính được để trống, hệ thống xử lý tự sinh mã theo cấu hình.
- Dữ liệu chỉ được lưu khi các trường bắt buộc hợp lệ.
- Người dùng phải có quyền thêm mới đơn vị tính.
- Tên đơn vị tính không được để trống
- Tên đơn vị tính là trường bắt buộc
- Mã đơn vị tính không được trùng lặp
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC004 - Kiểm tra quyền thực hiện Thêm mới đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC004 |
| Scenario ID | SC004 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC001 |
| Function | Thêm mới đơn vị tính |
| Chức năng | Thêm mới đơn vị tính |
| Loại | PERMISSION |
| Objective | Kiểm tra quyền truy cập chức năng |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 1 Thêm mới đơn vị tính BR01 BR02 BR03 BR04 BR05 BR06 BR07 EX01 EX02 EX03 EX04 EX05 EX06 EX07 EX08 EX09 Sinh mã đơn vị tính BR08 BR09 BR10 BR12 CL001 CL002 |
| Covered Rules | Kiểm tra Người dùng có quyền truy cập danh mục đơn vị tính. Kiểm tra Người dùng có quyền thêm mới đơn vị tính. Kiểm tra Người dùng phải có quyền thêm mới đơn vị tính. Kiểm tra quyền thêm dữ liệu Người dùng đã đăng nhập vào hệ thống Người dùng có quyền truy cập chức năng Danh mục Người dùng có quyền xem danh mục đơn vị tính Người dùng có quyền thêm mới đơn vị tính khi thực hiện chức năng thêm Người dùng có quyền thêm mới đơn vị tính |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền truy cập danh mục đơn vị tính
- Người dùng có quyền thêm mới đơn vị tính
- Người dùng đang ở màn hình Danh mục đơn vị tính
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 5 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 6 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 7 | Kiểm tra kết quả nghiệp vụ | Kiểm tra Người dùng có quyền truy cập danh mục đơn vị tính. |

### Kết quả mong đợi

- Kiểm tra Người dùng có quyền truy cập danh mục đơn vị tính.
- Kiểm tra Người dùng có quyền thêm mới đơn vị tính.
- Kiểm tra Người dùng phải có quyền thêm mới đơn vị tính.
- Kiểm tra quyền thêm dữ liệu
- Người dùng đã đăng nhập vào hệ thống
- Người dùng có quyền truy cập chức năng Danh mục
- Người dùng có quyền xem danh mục đơn vị tính
- Người dùng có quyền thêm mới đơn vị tính khi thực hiện chức năng thêm
- Người dùng có quyền thêm mới đơn vị tính
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC005 - Kiểm tra điều kiện biên của Thêm mới đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC005 |
| Scenario ID | SC005 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC001 |
| Function | Thêm mới đơn vị tính |
| Chức năng | Thêm mới đơn vị tính |
| Loại | BOUNDARY |
| Objective | Kiểm tra giới hạn dữ liệu |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | No |
| Automation Notes |  |
| Requirement References | 1 Thêm mới đơn vị tính BR01 BR02 BR03 BR04 BR05 BR06 BR07 EX01 EX02 EX03 EX04 EX05 EX06 EX07 EX08 EX09 Sinh mã đơn vị tính BR08 BR09 BR10 BR12 CL001 CL002 |
| Covered Rules | Độ dài ký tự của mã đơn vị tính Độ dài ký tự của tên đơn vị tính |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền truy cập danh mục đơn vị tính
- Người dùng có quyền thêm mới đơn vị tính
- Người dùng đang ở màn hình Danh mục đơn vị tính
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị

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
| 6 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 7 | Kiểm tra kết quả nghiệp vụ | Độ dài ký tự của mã đơn vị tính |

### Kết quả mong đợi

- Độ dài ký tự của mã đơn vị tính
- Độ dài ký tự của tên đơn vị tính
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC006 - Kiểm tra ngoại lệ của Thêm mới đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC006 |
| Scenario ID | SC006 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC001 |
| Function | Thêm mới đơn vị tính |
| Chức năng | Thêm mới đơn vị tính |
| Loại | EXCEPTION |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 1 Thêm mới đơn vị tính BR01 BR02 BR03 BR04 BR05 BR06 BR07 EX01 EX02 EX03 EX04 EX05 EX06 EX07 EX08 EX09 Sinh mã đơn vị tính BR08 BR09 BR10 BR12 CL001 CL002 |
| Covered Rules | Người dùng không có quyền thêm mới đơn vị tính. Tên đơn vị tính bị bỏ trống. Tên đơn vị tính chỉ chứa khoảng trắng. Mã đơn vị tính đã tồn tại. Mã đơn vị tính không đúng định dạng. Chức năng sinh mã không tạo được mã. Dữ liệu vượt quá độ dài cho phép. Hệ thống xảy ra lỗi trong quá trình lưu. Người dùng đóng biểu mẫu mà chưa lưu dữ liệu. Người dùng không có quyền thêm mới Tên đơn vị tính bị bỏ trống hoặc chỉ chứa khoảng trắng Mã đơn vị tính đã tồn tại Mã đơn vị tính không đúng định dạng Dữ liệu vượt quá độ dài cho phép Lỗi hệ thống khi lưu dữ liệu Hệ thống không thể sinh mã Mã được sinh bị trùng Mã được sinh không đúng định dạng Mất kết nối hệ thống trong quá trình sinh mã |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền truy cập danh mục đơn vị tính
- Người dùng có quyền thêm mới đơn vị tính
- Người dùng đang ở màn hình Danh mục đơn vị tính
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị

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
| 6 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 7 | Kiểm tra kết quả nghiệp vụ | Người dùng không có quyền thêm mới đơn vị tính. |

### Kết quả mong đợi

- Người dùng không có quyền thêm mới đơn vị tính.
- Tên đơn vị tính bị bỏ trống.
- Tên đơn vị tính chỉ chứa khoảng trắng.
- Mã đơn vị tính đã tồn tại.
- Mã đơn vị tính không đúng định dạng.
- Chức năng sinh mã không tạo được mã.
- Dữ liệu vượt quá độ dài cho phép.
- Hệ thống xảy ra lỗi trong quá trình lưu.
- Người dùng đóng biểu mẫu mà chưa lưu dữ liệu.
- Người dùng không có quyền thêm mới
- Tên đơn vị tính bị bỏ trống hoặc chỉ chứa khoảng trắng
- Mã đơn vị tính đã tồn tại
- Mã đơn vị tính không đúng định dạng
- Dữ liệu vượt quá độ dài cho phép
- Lỗi hệ thống khi lưu dữ liệu
- Hệ thống không thể sinh mã
- Mã được sinh bị trùng
- Mã được sinh không đúng định dạng
- Mất kết nối hệ thống trong quá trình sinh mã
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC007 - Kiểm tra rủi ro của Thêm mới đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC007 |
| Scenario ID | SC007 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC001 |
| Function | Thêm mới đơn vị tính |
| Chức năng | Thêm mới đơn vị tính |
| Loại | RISK |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 1 Thêm mới đơn vị tính BR01 BR02 BR03 BR04 BR05 BR06 BR07 EX01 EX02 EX03 EX04 EX05 EX06 EX07 EX08 EX09 Sinh mã đơn vị tính BR08 BR09 BR10 BR12 CL001 CL002 |
| Covered Rules | Người dùng phải có quyền thêm mới đơn vị tính. Xung đột dữ liệu khi nhiều người dùng thêm mới cùng lúc Mất kết nối gây gián đoạn quy trình |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền truy cập danh mục đơn vị tính
- Người dùng có quyền thêm mới đơn vị tính
- Người dùng đang ở màn hình Danh mục đơn vị tính
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị

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
| 6 | Lưu dữ liệu | Yêu cầu được gửi để hệ thống xử lý |
| 7 | Kiểm tra kết quả nghiệp vụ | Người dùng phải có quyền thêm mới đơn vị tính. |

### Kết quả mong đợi

- Người dùng phải có quyền thêm mới đơn vị tính.
- Xung đột dữ liệu khi nhiều người dùng thêm mới cùng lúc
- Mất kết nối gây gián đoạn quy trình
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC008 - Sinh mã đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC008 |
| Scenario ID | SC008 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC002 |
| Function | Sinh mã đơn vị tính |
| Chức năng | Sinh mã đơn vị tính |
| Loại | POSITIVE |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | No |
| Automation Notes |  |
| Requirement References | 2 Sinh mã đơn vị tính BR08 BR09 BR10 BR11 BR12 EX10 EX11 EX12 EX13 EX14 CL001 CL002 |
| Covered Rules | 2 Sinh mã đơn vị tính BR08 BR09 BR10 BR11 BR12 EX10 EX11 EX12 EX13 EX14 |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm mới đơn vị tính.
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện Sinh mã đơn vị tính | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Cho phép người dùng yêu cầu hệ thống tự sinh mã đơn vị tính khi thêm mới dữ liệu. |

### Kết quả mong đợi

- Cho phép người dùng yêu cầu hệ thống tự sinh mã đơn vị tính khi thêm mới dữ liệu.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC009 - Kiểm tra quy tắc nghiệp vụ của Sinh mã đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC009 |
| Scenario ID | SC009 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC002 |
| Function | Sinh mã đơn vị tính |
| Chức năng | Sinh mã đơn vị tính |
| Loại | DATA_INTEGRITY |
| Objective | Kiểm tra tính toàn vẹn dữ liệu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 2 Sinh mã đơn vị tính BR08 BR09 BR10 BR11 BR12 EX10 EX11 EX12 EX13 EX14 CL001 CL002 |
| Covered Rules | Mã được sinh phải là duy nhất. Mã được sinh phải tuân thủ định dạng mã của hệ thống. Chức năng sinh mã chỉ tạo giá trị, chưa thực hiện lưu dữ liệu. Mã được sinh có thể được thay đổi thủ công nếu hệ thống cho phép. Việc sinh mã không được làm mất dữ liệu tại các trường khác. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm mới đơn vị tính.
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị.

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện Sinh mã đơn vị tính | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Mã được sinh phải là duy nhất. |

### Kết quả mong đợi

- Mã được sinh phải là duy nhất.
- Mã được sinh phải tuân thủ định dạng mã của hệ thống.
- Chức năng sinh mã chỉ tạo giá trị, chưa thực hiện lưu dữ liệu.
- Mã được sinh có thể được thay đổi thủ công nếu hệ thống cho phép.
- Việc sinh mã không được làm mất dữ liệu tại các trường khác.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC010 - Kiểm tra dữ liệu không hợp lệ của Sinh mã đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC010 |
| Scenario ID | SC010 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC002 |
| Function | Sinh mã đơn vị tính |
| Chức năng | Sinh mã đơn vị tính |
| Loại | NEGATIVE |
| Objective | Kiểm tra xử lý dữ liệu không hợp lệ |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 2 Sinh mã đơn vị tính BR08 BR09 BR10 BR11 BR12 EX10 EX11 EX12 EX13 EX14 CL001 CL002 |
| Covered Rules | Mã được sinh phải là duy nhất. Mã được sinh phải tuân thủ định dạng mã của hệ thống. Chức năng sinh mã chỉ tạo giá trị, chưa thực hiện lưu dữ liệu. Mã được sinh có thể được thay đổi thủ công nếu hệ thống cho phép. Việc sinh mã không được làm mất dữ liệu tại các trường khác. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm mới đơn vị tính.
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị.

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện Sinh mã đơn vị tính | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Mã được sinh phải là duy nhất. |

### Kết quả mong đợi

- Mã được sinh phải là duy nhất.
- Mã được sinh phải tuân thủ định dạng mã của hệ thống.
- Chức năng sinh mã chỉ tạo giá trị, chưa thực hiện lưu dữ liệu.
- Mã được sinh có thể được thay đổi thủ công nếu hệ thống cho phép.
- Việc sinh mã không được làm mất dữ liệu tại các trường khác.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC011 - Kiểm tra quyền thực hiện Sinh mã đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC011 |
| Scenario ID | SC011 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC002 |
| Function | Sinh mã đơn vị tính |
| Chức năng | Sinh mã đơn vị tính |
| Loại | PERMISSION |
| Objective | Kiểm tra quyền truy cập chức năng |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 2 Sinh mã đơn vị tính BR08 BR09 BR10 BR11 BR12 EX10 EX11 EX12 EX13 EX14 CL001 CL002 |
| Covered Rules | Kiểm tra Người dùng có quyền thêm mới đơn vị tính. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm mới đơn vị tính.
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị.

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện Sinh mã đơn vị tính | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Kiểm tra Người dùng có quyền thêm mới đơn vị tính. |

### Kết quả mong đợi

- Kiểm tra Người dùng có quyền thêm mới đơn vị tính.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC012 - Kiểm tra ngoại lệ của Sinh mã đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC012 |
| Scenario ID | SC012 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC002 |
| Function | Sinh mã đơn vị tính |
| Chức năng | Sinh mã đơn vị tính |
| Loại | EXCEPTION |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 2 Sinh mã đơn vị tính BR08 BR09 BR10 BR11 BR12 EX10 EX11 EX12 EX13 EX14 CL001 CL002 |
| Covered Rules | Hệ thống không thể sinh mã. Mã được sinh bị trùng. Mã được sinh không đúng định dạng. Hệ thống mất kết nối trong quá trình sinh mã. Người dùng thực hiện sinh mã nhiều lần liên tiếp. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm mới đơn vị tính.
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện Sinh mã đơn vị tính | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Hệ thống không thể sinh mã. |

### Kết quả mong đợi

- Hệ thống không thể sinh mã.
- Mã được sinh bị trùng.
- Mã được sinh không đúng định dạng.
- Hệ thống mất kết nối trong quá trình sinh mã.
- Người dùng thực hiện sinh mã nhiều lần liên tiếp.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC013 - Kiểm tra rủi ro của Sinh mã đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC013 |
| Scenario ID | SC013 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC002 |
| Function | Sinh mã đơn vị tính |
| Chức năng | Sinh mã đơn vị tính |
| Loại | RISK |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 2 Sinh mã đơn vị tính BR08 BR09 BR10 BR11 BR12 EX10 EX11 EX12 EX13 EX14 CL001 CL002 |
| Covered Rules | Việc sinh mã không được làm mất dữ liệu tại các trường khác. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm mới đơn vị tính.
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị.

### Dữ liệu kiểm thử

- Không có

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện Sinh mã đơn vị tính | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Việc sinh mã không được làm mất dữ liệu tại các trường khác. |

### Kết quả mong đợi

- Việc sinh mã không được làm mất dữ liệu tại các trường khác.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC014 - Tìm kiếm đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC014 |
| Scenario ID | SC014 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC003 |
| Function | Tìm kiếm đơn vị tính |
| Chức năng | Tìm kiếm đơn vị tính |
| Loại | POSITIVE |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | No |
| Automation Notes |  |
| Requirement References | 3 Tìm kiếm đơn vị tính BR13 BR14 BR15 BR16 BR17 BR18 EX15 EX16 EX17 EX18 EX19 EX20 EX21 CL002 CL001 |
| Covered Rules | 3 Tìm kiếm đơn vị tính BR13 BR14 BR15 BR16 BR17 BR18 EX15 EX16 EX17 EX18 EX19 EX20 EX21 CL002 |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh mục đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền xem danh mục đơn vị tính

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
| 6 | Kiểm tra kết quả nghiệp vụ | Cho phép người dùng tìm kiếm đơn vị tính theo mã hoặc tên đơn vị tính. |

### Kết quả mong đợi

- Cho phép người dùng tìm kiếm đơn vị tính theo mã hoặc tên đơn vị tính.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC015 - Kiểm tra quy tắc nghiệp vụ của Tìm kiếm đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC015 |
| Scenario ID | SC015 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC003 |
| Function | Tìm kiếm đơn vị tính |
| Chức năng | Tìm kiếm đơn vị tính |
| Loại | DATA_INTEGRITY |
| Objective | Kiểm tra tính toàn vẹn dữ liệu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 3 Tìm kiếm đơn vị tính BR13 BR14 BR15 BR16 BR17 BR18 EX15 EX16 EX17 EX18 EX19 EX20 EX21 CL002 CL001 |
| Covered Rules | Cho phép tìm kiếm theo mã đơn vị tính. Cho phép tìm kiếm theo tên đơn vị tính. Từ khóa có thể được tìm theo giá trị chính xác hoặc gần đúng tùy thiết kế hệ thống. Khi không nhập từ khóa, hệ thống có thể hiển thị toàn bộ danh sách. Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng. Kết quả có thể được phân trang khi số lượng dữ liệu lớn. Tìm kiếm theo mã đơn vị tính Tìm kiếm theo tên đơn vị tính Hỗ trợ tìm kiếm gần đúng (chứa từ khóa) Hiển thị toàn bộ danh sách khi không nhập từ khóa Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh mục đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền xem danh mục đơn vị tính

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện tìm kiếm | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Cho phép tìm kiếm theo mã đơn vị tính. |

### Kết quả mong đợi

- Cho phép tìm kiếm theo mã đơn vị tính.
- Cho phép tìm kiếm theo tên đơn vị tính.
- Từ khóa có thể được tìm theo giá trị chính xác hoặc gần đúng tùy thiết kế hệ thống.
- Khi không nhập từ khóa, hệ thống có thể hiển thị toàn bộ danh sách.
- Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng.
- Kết quả có thể được phân trang khi số lượng dữ liệu lớn.
- Tìm kiếm theo mã đơn vị tính
- Tìm kiếm theo tên đơn vị tính
- Hỗ trợ tìm kiếm gần đúng (chứa từ khóa)
- Hiển thị toàn bộ danh sách khi không nhập từ khóa
- Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC016 - Kiểm tra dữ liệu không hợp lệ của Tìm kiếm đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC016 |
| Scenario ID | SC016 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC003 |
| Function | Tìm kiếm đơn vị tính |
| Chức năng | Tìm kiếm đơn vị tính |
| Loại | NEGATIVE |
| Objective | Kiểm tra xử lý dữ liệu không hợp lệ |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 3 Tìm kiếm đơn vị tính BR13 BR14 BR15 BR16 BR17 BR18 EX15 EX16 EX17 EX18 EX19 EX20 EX21 CL002 CL001 |
| Covered Rules | Cho phép tìm kiếm theo mã đơn vị tính. Cho phép tìm kiếm theo tên đơn vị tính. Từ khóa có thể được tìm theo giá trị chính xác hoặc gần đúng tùy thiết kế hệ thống. Khi không nhập từ khóa, hệ thống có thể hiển thị toàn bộ danh sách. Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng. Kết quả có thể được phân trang khi số lượng dữ liệu lớn. |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh mục đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền xem danh mục đơn vị tính

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện tìm kiếm | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Cho phép tìm kiếm theo mã đơn vị tính. |

### Kết quả mong đợi

- Cho phép tìm kiếm theo mã đơn vị tính.
- Cho phép tìm kiếm theo tên đơn vị tính.
- Từ khóa có thể được tìm theo giá trị chính xác hoặc gần đúng tùy thiết kế hệ thống.
- Khi không nhập từ khóa, hệ thống có thể hiển thị toàn bộ danh sách.
- Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng.
- Kết quả có thể được phân trang khi số lượng dữ liệu lớn.
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC017 - Kiểm tra quyền thực hiện Tìm kiếm đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC017 |
| Scenario ID | SC017 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC003 |
| Function | Tìm kiếm đơn vị tính |
| Chức năng | Tìm kiếm đơn vị tính |
| Loại | PERMISSION |
| Objective | Kiểm tra quyền truy cập chức năng |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 3 Tìm kiếm đơn vị tính BR13 BR14 BR15 BR16 BR17 BR18 EX15 EX16 EX17 EX18 EX19 EX20 EX21 CL002 CL001 |
| Covered Rules | Kiểm tra Người dùng có quyền xem danh mục đơn vị tính. Kiểm tra Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng. Kiểm tra quyền xem dữ liệu Người dùng có quyền xem danh mục đơn vị tính |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh mục đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền xem danh mục đơn vị tính

### Dữ liệu kiểm thử

#### Kết quả dữ liệu mong đợi

```text
scenarioCondition: 
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 2 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 3 | Thiết lập điều kiện trước | Điều kiện trước được đáp ứng |
| 4 | Mở màn hình hoặc chức năng | Màn hình hoặc chức năng được hiển thị |
| 5 | Thực hiện tìm kiếm | Yêu cầu được gửi để hệ thống xử lý |
| 6 | Kiểm tra kết quả nghiệp vụ | Kiểm tra Người dùng có quyền xem danh mục đơn vị tính. |

### Kết quả mong đợi

- Kiểm tra Người dùng có quyền xem danh mục đơn vị tính.
- Kiểm tra Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng.
- Kiểm tra quyền xem dữ liệu
- Người dùng có quyền xem danh mục đơn vị tính
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC018 - Kiểm tra ngoại lệ của Tìm kiếm đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC018 |
| Scenario ID | SC018 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC003 |
| Function | Tìm kiếm đơn vị tính |
| Chức năng | Tìm kiếm đơn vị tính |
| Loại | EXCEPTION |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 3 Tìm kiếm đơn vị tính BR13 BR14 BR15 BR16 BR17 BR18 EX15 EX16 EX17 EX18 EX19 EX20 EX21 CL002 CL001 |
| Covered Rules | Người dùng không có quyền xem danh mục đơn vị tính. Không tìm thấy dữ liệu phù hợp. Từ khóa vượt quá độ dài cho phép. Từ khóa chứa ký tự đặc biệt. Từ khóa chỉ chứa khoảng trắng. Hệ thống xảy ra lỗi trong quá trình truy vấn. Hệ thống mất kết nối khi đang tìm kiếm. Người dùng không có quyền xem danh mục Không tìm thấy dữ liệu phù hợp Từ khóa vượt quá độ dài cho phép Từ khóa chứa ký tự đặc biệt Từ khóa chỉ chứa khoảng trắng Lỗi hệ thống khi truy vấn |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh mục đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền xem danh mục đơn vị tính

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
| 6 | Kiểm tra kết quả nghiệp vụ | Người dùng không có quyền xem danh mục đơn vị tính. |

### Kết quả mong đợi

- Người dùng không có quyền xem danh mục đơn vị tính.
- Không tìm thấy dữ liệu phù hợp.
- Từ khóa vượt quá độ dài cho phép.
- Từ khóa chứa ký tự đặc biệt.
- Từ khóa chỉ chứa khoảng trắng.
- Hệ thống xảy ra lỗi trong quá trình truy vấn.
- Hệ thống mất kết nối khi đang tìm kiếm.
- Người dùng không có quyền xem danh mục
- Không tìm thấy dữ liệu phù hợp
- Từ khóa vượt quá độ dài cho phép
- Từ khóa chứa ký tự đặc biệt
- Từ khóa chỉ chứa khoảng trắng
- Lỗi hệ thống khi truy vấn
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC019 - Kiểm tra rủi ro của Tìm kiếm đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC019 |
| Scenario ID | SC019 |
| Module ID | MOD001 |
| Module | Danh mục đơn vị tính |
| Function ID | FUNC003 |
| Function | Tìm kiếm đơn vị tính |
| Chức năng | Tìm kiếm đơn vị tính |
| Loại | RISK |
| Objective | Kiểm tra chức năng hoạt động đúng theo yêu cầu |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes |  |
| Requirement References | 3 Tìm kiếm đơn vị tính BR13 BR14 BR15 BR16 BR17 BR18 EX15 EX16 EX17 EX18 EX19 EX20 EX21 CL002 CL001 |
| Covered Rules | Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng. Lỗi hiển thị khi từ khóa tìm kiếm chứa ký tự đặc biệt |
| Source | Requirement Intelligence Engine |

### Tiền điều kiện

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh mục đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.
- Người dùng đã đăng nhập
- Người dùng có quyền xem danh mục đơn vị tính

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
| 6 | Kiểm tra kết quả nghiệp vụ | Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng. |

### Kết quả mong đợi

- Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng.
- Lỗi hiển thị khi từ khóa tìm kiếm chứa ký tự đặc biệt
- Điều kiện trước được đáp ứng
- Yêu cầu được gửi để hệ thống xử lý

---

## TC020 - Thêm mới đơn vị tính thành công

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC020 |
| Scenario ID | SC001 |
| Module ID | MOD001 |
| Module |  |
| Function ID | FUNC001 |
| Function |  |
| Chức năng |  |
| Loại | POSITIVE |
| Objective | Xác nhận hệ thống cho phép thêm mới đơn vị tính khi cung cấp đầy đủ thông tin hợp lệ |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | No |
| Automation Notes | Cần locator cho trường nhập liệu và nút lưu |
| Requirement References | BR01 BR08 |
| Covered Rules | Thêm mới đơn vị tính |
| Source | gemini |

### Tiền điều kiện

- Người dùng đã đăng nhập
- Người dùng có quyền thêm mới đơn vị tính
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị

### Dữ liệu kiểm thử

```text
name: Tên đơn vị tính
value: Cái
description: Giá trị hợp lệ cho trường tên
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập giá trị 'Cái' vào trường Tên đơn vị tính | Trường Tên đơn vị tính hiển thị giá trị 'Cái' |
| 2 | Nhấn nút Lưu | Dữ liệu được gửi lên hệ thống và thông báo thành công |

### Kết quả mong đợi

- Đơn vị tính được thêm vào danh mục thành công

---

## TC021 - Kiểm tra quy tắc bắt buộc của trường Tên đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC021 |
| Scenario ID | SC002 |
| Module ID | MOD001 |
| Module |  |
| Function ID | FUNC001 |
| Function |  |
| Chức năng |  |
| Loại | DATA_INTEGRITY |
| Objective | Xác nhận hệ thống chặn lưu khi không nhập tên đơn vị tính |
| Priority | HIGH |
| Severity | HIGH |
| Automation | No |
| Automation Notes | Kiểm tra thông báo validate field |
| Requirement References | BR01 |
| Covered Rules | Tên đơn vị tính là trường bắt buộc. |
| Source | gemini |

### Tiền điều kiện

- Người dùng đang ở màn hình thêm mới đơn vị tính

### Dữ liệu kiểm thử

```text
name: Tên đơn vị tính
value: 
description: Để trống trường bắt buộc
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Để trống trường Tên đơn vị tính | Trường không có dữ liệu |
| 2 | Nhấn nút Lưu | Hệ thống hiển thị thông báo lỗi bắt buộc |

### Kết quả mong đợi

- Không thể lưu dữ liệu

---

## TC022 - Kiểm tra chức năng sinh mã đơn vị tính

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC022 |
| Scenario ID | SC008 |
| Module ID | MOD001 |
| Module |  |
| Function ID | FUNC002 |
| Function |  |
| Chức năng |  |
| Loại | POSITIVE |
| Objective | Xác nhận hệ thống tự động sinh mã khi nhấn chức năng sinh mã |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | No |
| Automation Notes | Cần locator cho nút sinh mã và trường mã |
| Requirement References | BR08 CL001 |
| Covered Rules | Sinh mã đơn vị tính Việc sinh mã không được làm mất dữ liệu tại các trường khác. |
| Source | gemini |

### Tiền điều kiện

- Người dùng ở màn hình thêm mới
- Đã nhập tên đơn vị tính

### Dữ liệu kiểm thử

```text
name: Tên đơn vị tính
value: Thùng
description: Dữ liệu hợp lệ
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Nhấn vào chức năng 'Sinh mã' | Trường Mã đơn vị tính được điền tự động |

### Kết quả mong đợi

- Mã đơn vị tính được sinh ra và dữ liệu tên đơn vị tính được giữ nguyên

---

## TC023 - Tìm kiếm đơn vị tính bằng tên

| Thuộc tính | Giá trị |
|---|---|
| TestCase ID | TC023 |
| Scenario ID | SC014 |
| Module ID | MOD001 |
| Module |  |
| Function ID | FUNC003 |
| Function |  |
| Chức năng |  |
| Loại | POSITIVE |
| Objective | Xác nhận chức năng tìm kiếm đơn vị tính hoạt động đúng với từ khóa tìm kiếm |
| Priority | MEDIUM |
| Severity | MEDIUM |
| Automation | No |
| Automation Notes | Kiểm tra kết quả bảng trả về |
| Requirement References | BR13 CL002 |
| Covered Rules | Hỗ trợ tìm kiếm gần đúng (chứa từ khóa) |
| Source | gemini |

### Tiền điều kiện

- Danh mục đã có dữ liệu đơn vị tính

### Dữ liệu kiểm thử

```text
name: Từ khóa
value: Cái
description: Từ khóa tìm kiếm gần đúng
```

### Các bước kiểm thử

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập 'Cái' vào ô tìm kiếm | Từ khóa xuất hiện trong ô |
| 2 | Nhấn nút Tìm kiếm | Hệ thống trả về danh sách có tên chứa 'Cái' |

### Kết quả mong đợi

- Danh sách tìm kiếm hiển thị chính xác

