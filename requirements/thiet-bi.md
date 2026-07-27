# Module: Thiết bị

## Thông tin chung

### Mục đích

Quản lý thông tin thiết bị trong hệ thống.

### Mô tả

Cho phép người dùng thực hiện các chức năng:

- Thêm thiết bị
- Sửa thiết bị
- Xóa thiết bị
- Tìm kiếm thiết bị

### Quyền truy cập

- Người dùng đã đăng nhập vào hệ thống.
- Người dùng có quyền truy cập màn hình quản lý thiết bị.
- Người dùng có quyền thực hiện chức năng tương ứng.

### Dữ liệu dùng chung

| Trường        | Control Type | Nguồn dữ liệu          | Bắt buộc | Mô tả                             |
| ------------- | ------------ | ---------------------- | -------- | --------------------------------- |
| Mã thiết bị   | TextBox      | Người dùng nhập        | Có       | Mã duy nhất của thiết bị          |
| Tên thiết bị  | TextBox      | Người dùng nhập        | Có       | Tên hiển thị của thiết bị         |
| Loại thiết bị | Dropdown     | Danh mục loại thiết bị | Có       | Loại của thiết bị                 |
| Trạng thái    | Dropdown     | Danh mục trạng thái    | Không    | Trạng thái hoạt động của thiết bị |
| Ghi chú       | TextArea     | Người dùng nhập        | Không    | Thông tin ghi chú bổ sung         |

### Quan hệ dữ liệu

- Mã thiết bị không được trùng với thiết bị đã tồn tại.
- Loại thiết bị phải tồn tại trong danh mục loại thiết bị.
- Thiết bị có thể được tham chiếu bởi các dữ liệu nghiệp vụ khác.
- Không được xóa thiết bị khi thiết bị đang được sử dụng hoặc đang có dữ liệu liên quan.

# Features

## Feature: Thêm thiết bị

### Mô tả

Cho phép người dùng thêm mới một thiết bị vào hệ thống.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Input

| Trường        | Bắt buộc | Quy tắc                                           |
| ------------- | -------- | ------------------------------------------------- |
| Mã thiết bị   | Có       | Không được để trống và không được trùng           |
| Tên thiết bị  | Có       | Không được để trống                               |
| Loại thiết bị | Có       | Phải chọn một giá trị hợp lệ                      |
| Trạng thái    | Không    | Nếu không chọn, hệ thống sử dụng giá trị mặc định |
| Ghi chú       | Không    | Cho phép nhập nội dung mô tả bổ sung              |

### Luồng chính

1. Người dùng mở chức năng thêm thiết bị.
2. Hệ thống hiển thị biểu mẫu thêm mới.
3. Người dùng nhập thông tin thiết bị.
4. Người dùng thực hiện lưu dữ liệu.
5. Hệ thống kiểm tra dữ liệu nhập.
6. Hệ thống tạo mới thiết bị.
7. Hệ thống thông báo thêm thiết bị thành công.
8. Thiết bị mới được hiển thị trong danh sách.

### Quy tắc nghiệp vụ

- Mã thiết bị phải là duy nhất.
- Loại thiết bị phải tồn tại trong danh mục loại thiết bị.
- Người dùng phải có quyền thêm thiết bị.
- Dữ liệu chỉ được lưu khi tất cả trường bắt buộc hợp lệ.

### Validation

- Mã thiết bị không được để trống.
- Tên thiết bị không được để trống.
- Loại thiết bị không được để trống.
- Mã thiết bị không được trùng.
- Mã thiết bị không được chỉ chứa khoảng trắng.
- Tên thiết bị không được chỉ chứa khoảng trắng.
- Dữ liệu nhập phải tuân thủ giới hạn độ dài do hệ thống quy định.

### Kết quả mong đợi

- Thiết bị được tạo thành công.
- Dữ liệu được lưu chính xác.
- Hệ thống hiển thị thông báo thành công.
- Thiết bị mới xuất hiện trong danh sách thiết bị.

### Ngoại lệ

- Người dùng không có quyền thêm thiết bị.
- Mã thiết bị đã tồn tại.
- Trường bắt buộc bị bỏ trống.
- Loại thiết bị không hợp lệ.
- Dữ liệu vượt quá độ dài cho phép.
- Hệ thống xảy ra lỗi trong quá trình lưu.

### Automation

Screen: Device

Operation: Create

Priority: High

Automation Candidate: Yes

Tags:

- smoke
- regression
- device
- create

---

## Feature: Sửa thiết bị

### Mô tả

Cho phép người dùng cập nhật thông tin của một thiết bị đã tồn tại.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền sửa thiết bị.
- Thiết bị cần sửa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Input

| Trường           | Bắt buộc | Quy tắc                                                   |
| ---------------- | -------- | --------------------------------------------------------- |
| Thiết bị cần sửa | Có       | Phải tồn tại trong hệ thống                               |
| Mã thiết bị      | Có       | Không được để trống và không được trùng với thiết bị khác |
| Tên thiết bị     | Có       | Không được để trống                                       |
| Loại thiết bị    | Có       | Phải chọn một giá trị hợp lệ                              |
| Trạng thái       | Không    | Phải thuộc danh mục trạng thái                            |
| Ghi chú          | Không    | Cho phép cập nhật nội dung                                |

### Luồng chính

1. Người dùng tìm kiếm thiết bị cần sửa.
2. Người dùng chọn thiết bị.
3. Người dùng mở chức năng sửa.
4. Hệ thống hiển thị thông tin hiện tại của thiết bị.
5. Người dùng thay đổi thông tin.
6. Người dùng thực hiện lưu dữ liệu.
7. Hệ thống kiểm tra dữ liệu cập nhật.
8. Hệ thống lưu thông tin mới.
9. Hệ thống thông báo cập nhật thành công.
10. Danh sách thiết bị hiển thị dữ liệu đã cập nhật.

### Quy tắc nghiệp vụ

- Thiết bị cần sửa phải tồn tại.
- Mã thiết bị sau khi sửa không được trùng với thiết bị khác.
- Người dùng phải có quyền sửa thiết bị.
- Dữ liệu cũ chỉ được thay đổi khi dữ liệu mới hợp lệ.
- Hệ thống phải ghi nhận thông tin cập nhật theo cơ chế audit nếu có.

### Validation

- Mã thiết bị không được để trống.
- Tên thiết bị không được để trống.
- Loại thiết bị không được để trống.
- Mã thiết bị không được trùng với thiết bị khác.
- Các giá trị danh mục phải hợp lệ.
- Dữ liệu nhập phải tuân thủ giới hạn độ dài do hệ thống quy định.

### Kết quả mong đợi

- Thông tin thiết bị được cập nhật thành công.
- Dữ liệu mới được lưu chính xác.
- Hệ thống hiển thị thông báo cập nhật thành công.
- Danh sách thiết bị hiển thị thông tin mới.

### Ngoại lệ

- Người dùng không có quyền sửa thiết bị.
- Thiết bị không còn tồn tại.
- Thiết bị đã bị người dùng khác thay đổi.
- Mã thiết bị bị trùng.
- Trường bắt buộc bị bỏ trống.
- Dữ liệu cập nhật không hợp lệ.
- Hệ thống xảy ra lỗi trong quá trình lưu.

### Automation

Screen: Device

Operation: Update

Priority: High

Automation Candidate: Yes

Tags:

- smoke
- regression
- device
- update

---

## Feature: Xóa thiết bị

### Mô tả

Cho phép người dùng xóa một thiết bị khỏi hệ thống.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền xóa thiết bị.
- Thiết bị cần xóa đã tồn tại.
- Người dùng đang ở màn hình quản lý thiết bị.

### Input

| Trường           | Bắt buộc | Quy tắc                                |
| ---------------- | -------- | -------------------------------------- |
| Thiết bị cần xóa | Có       | Phải tồn tại trong hệ thống            |
| Xác nhận xóa     | Có       | Người dùng phải xác nhận trước khi xóa |

### Luồng chính

1. Người dùng tìm kiếm thiết bị cần xóa.
2. Người dùng chọn thiết bị.
3. Người dùng thực hiện chức năng xóa.
4. Hệ thống hiển thị thông báo xác nhận.
5. Người dùng xác nhận xóa.
6. Hệ thống kiểm tra quyền và dữ liệu liên quan.
7. Hệ thống xóa thiết bị.
8. Hệ thống thông báo xóa thành công.
9. Thiết bị không còn hiển thị trong danh sách.

### Quy tắc nghiệp vụ

- Thiết bị cần xóa phải tồn tại.
- Người dùng phải có quyền xóa thiết bị.
- Không được xóa thiết bị đang được sử dụng.
- Không được xóa thiết bị có dữ liệu liên quan nếu hệ thống không cho phép.
- Hệ thống phải yêu cầu xác nhận trước khi xóa.
- Việc xóa có thể là xóa mềm hoặc xóa vật lý tùy thiết kế hệ thống.

### Validation

- Phải chọn một thiết bị hợp lệ.
- Thiết bị phải tồn tại tại thời điểm xóa.
- Thiết bị không được có ràng buộc ngăn cản việc xóa.
- Người dùng phải xác nhận thao tác xóa.

### Kết quả mong đợi

- Thiết bị được xóa thành công.
- Hệ thống hiển thị thông báo thành công.
- Thiết bị không còn xuất hiện trong danh sách hoạt động.
- Các dữ liệu không liên quan không bị ảnh hưởng.

### Ngoại lệ

- Người dùng không có quyền xóa thiết bị.
- Thiết bị không tồn tại.
- Thiết bị đã bị người dùng khác xóa.
- Thiết bị đang được sử dụng.
- Thiết bị có dữ liệu liên quan.
- Người dùng hủy xác nhận xóa.
- Hệ thống xảy ra lỗi trong quá trình xóa.

### Automation

Screen: Device

Operation: Delete

Priority: High

Automation Candidate: Yes

Tags:

- regression
- device
- delete

---

## Feature: Tìm kiếm thiết bị

### Mô tả

Cho phép người dùng tìm kiếm thiết bị theo một hoặc nhiều điều kiện.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh sách thiết bị.
- Người dùng đang ở màn hình quản lý thiết bị.

### Input

| Trường        | Bắt buộc | Quy tắc                                           |
| ------------- | -------- | ------------------------------------------------- |
| Mã thiết bị   | Không    | Cho phép tìm chính xác hoặc gần đúng tùy thiết kế |
| Tên thiết bị  | Không    | Cho phép tìm theo từ khóa                         |
| Loại thiết bị | Không    | Phải thuộc danh mục loại thiết bị                 |
| Trạng thái    | Không    | Phải thuộc danh mục trạng thái                    |

### Luồng chính

1. Người dùng mở màn hình quản lý thiết bị.
2. Người dùng nhập một hoặc nhiều điều kiện tìm kiếm.
3. Người dùng thực hiện tìm kiếm.
4. Hệ thống kiểm tra điều kiện tìm kiếm.
5. Hệ thống truy vấn dữ liệu phù hợp.
6. Hệ thống hiển thị danh sách kết quả.
7. Người dùng xem thông tin thiết bị tìm được.

### Quy tắc nghiệp vụ

- Cho phép tìm kiếm bằng một hoặc nhiều điều kiện.
- Các điều kiện tìm kiếm được kết hợp theo quy tắc của hệ thống.
- Khi không nhập điều kiện, hệ thống có thể hiển thị toàn bộ dữ liệu hoặc yêu cầu nhập điều kiện.
- Kết quả phải tuân thủ quyền xem dữ liệu của người dùng.
- Kết quả có thể được phân trang khi số lượng dữ liệu lớn.

### Validation

- Giá trị loại thiết bị phải hợp lệ.
- Giá trị trạng thái phải hợp lệ.
- Dữ liệu tìm kiếm phải tuân thủ giới hạn độ dài.
- Khoảng trắng đầu và cuối phải được xử lý phù hợp.
- Ký tự đặc biệt không được làm lỗi truy vấn.

### Kết quả mong đợi

- Hệ thống hiển thị đúng các thiết bị phù hợp.
- Không hiển thị thiết bị không thỏa mãn điều kiện.
- Hiển thị thông báo phù hợp khi không có kết quả.
- Kết quả tìm kiếm được phân trang đúng nếu có.
- Dữ liệu hiển thị đúng và đầy đủ.

### Ngoại lệ

- Người dùng không có quyền xem thiết bị.
- Điều kiện tìm kiếm không hợp lệ.
- Không tìm thấy dữ liệu phù hợp.
- Ký tự đặc biệt gây lỗi xử lý.
- Hệ thống xảy ra lỗi trong quá trình truy vấn.

### Automation

Screen: Device

Operation: Search

Priority: Medium

Automation Candidate: Yes

Tags:

- smoke
- regression
- device
- search
