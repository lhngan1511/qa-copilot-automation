# Module: Danh mục đơn vị tính

## Thông tin chung

### Mục đích

Quản lý danh mục đơn vị tính được sử dụng trong hệ thống.

### Mô tả

Cho phép người dùng thực hiện các chức năng:

- Tìm kiếm đơn vị tính.
- Thêm mới đơn vị tính.

### Quyền truy cập

- Người dùng đã đăng nhập vào hệ thống.
- Người dùng có quyền truy cập chức năng Danh mục.
- Người dùng có quyền xem danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính khi thực hiện chức năng thêm.

### Dữ liệu dùng chung

| Trường          | Control Type | Nguồn dữ liệu                         | Bắt buộc | Mô tả                        |
| --------------- | ------------ | ------------------------------------- | -------- | ---------------------------- |
| Mã đơn vị tính  | TextBox      | Người dùng nhập hoặc hệ thống tự sinh | Không    | Mã nhận diện của đơn vị tính |
| Tên đơn vị tính | TextBox      | Người dùng nhập                       | Có       | Tên hiển thị của đơn vị tính |
| Ghi chú         | TextArea     | Người dùng nhập                       | Không    | Nội dung ghi chú bổ sung     |

### Quan hệ dữ liệu

- Mã đơn vị tính phải là duy nhất trong hệ thống.
- Tên đơn vị tính không được để trống.
- Đơn vị tính có thể được sử dụng tại các chức năng quản lý thiết bị, vật tư hoặc nghiệp vụ liên quan.
- Khi mã đơn vị tính được để trống, hệ thống tự sinh mã nếu người dùng sử dụng chức năng sinh mã hoặc hệ thống hỗ trợ tự sinh khi lưu.

# Features

## Feature: Thêm mới đơn vị tính

### Mô tả

Cho phép người dùng thêm mới một đơn vị tính vào danh mục.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền truy cập danh mục đơn vị tính.
- Người dùng có quyền thêm mới đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.

### Input

| Trường          | Bắt buộc | Quy tắc                                                  |
| --------------- | -------- | -------------------------------------------------------- |
| Mã đơn vị tính  | Không    | Người dùng có thể nhập hoặc để trống để hệ thống tự sinh |
| Tên đơn vị tính | Có       | Không được để trống                                      |
| Ghi chú         | Không    | Cho phép nhập nội dung mô tả bổ sung                     |

### Luồng chính

1. Người dùng mở màn hình Danh mục đơn vị tính.
2. Người dùng chọn chức năng thêm mới.
3. Hệ thống hiển thị biểu mẫu thêm mới đơn vị tính.
4. Người dùng nhập mã đơn vị tính hoặc sử dụng chức năng sinh mã.
5. Người dùng nhập tên đơn vị tính.
6. Người dùng nhập ghi chú nếu cần.
7. Người dùng thực hiện lưu dữ liệu.
8. Hệ thống kiểm tra tính hợp lệ của dữ liệu.
9. Hệ thống tạo mới đơn vị tính.
10. Hệ thống hiển thị thông báo thêm mới thành công.
11. Đơn vị tính mới được hiển thị trong danh sách.

### Quy tắc nghiệp vụ

- Tên đơn vị tính là trường bắt buộc.
- Mã đơn vị tính phải là duy nhất.
- Người dùng được phép nhập mã thủ công.
- Người dùng được phép sử dụng chức năng sinh mã.
- Khi mã đơn vị tính được để trống, hệ thống xử lý tự sinh mã theo cấu hình.
- Dữ liệu chỉ được lưu khi các trường bắt buộc hợp lệ.
- Người dùng phải có quyền thêm mới đơn vị tính.

### Validation

- Tên đơn vị tính không được để trống.
- Tên đơn vị tính không được chỉ chứa khoảng trắng.
- Mã đơn vị tính không được trùng với dữ liệu đã tồn tại.
- Mã đơn vị tính không được chỉ chứa khoảng trắng khi người dùng nhập thủ công.
- Mã tự sinh phải đúng định dạng của hệ thống.
- Dữ liệu nhập phải tuân thủ giới hạn độ dài do hệ thống quy định.
- Khoảng trắng đầu và cuối phải được xử lý phù hợp.
- Ký tự đặc biệt phải được xử lý an toàn.

### Kết quả mong đợi

- Đơn vị tính được tạo thành công.
- Dữ liệu được lưu chính xác.
- Mã đơn vị tính được lưu đúng với giá trị người dùng nhập hoặc giá trị hệ thống tự sinh.
- Hệ thống hiển thị thông báo thêm mới thành công.
- Đơn vị tính mới xuất hiện trong danh sách.
- Biểu mẫu thêm mới được đóng hoặc đặt lại theo thiết kế của hệ thống.

### Ngoại lệ

- Người dùng không có quyền thêm mới đơn vị tính.
- Tên đơn vị tính bị bỏ trống.
- Tên đơn vị tính chỉ chứa khoảng trắng.
- Mã đơn vị tính đã tồn tại.
- Mã đơn vị tính không đúng định dạng.
- Chức năng sinh mã không tạo được mã.
- Dữ liệu vượt quá độ dài cho phép.
- Hệ thống xảy ra lỗi trong quá trình lưu.
- Người dùng đóng biểu mẫu mà chưa lưu dữ liệu.

### Automation

Screen: UnitOfMeasure

Operation: Create

Priority: High

Automation Candidate: Yes

Tags:

- smoke
- regression
- category
- unit-of-measure
- create

---

## Feature: Sinh mã đơn vị tính

### Mô tả

Cho phép người dùng yêu cầu hệ thống tự sinh mã đơn vị tính khi thêm mới dữ liệu.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền thêm mới đơn vị tính.
- Biểu mẫu thêm mới đơn vị tính đang được hiển thị.

### Input

| Trường                  | Bắt buộc | Quy tắc                                                |
| ----------------------- | -------- | ------------------------------------------------------ |
| Mã đơn vị tính hiện tại | Không    | Có thể đang trống hoặc chứa giá trị người dùng đã nhập |

### Luồng chính

1. Người dùng mở biểu mẫu thêm mới đơn vị tính.
2. Người dùng chọn chức năng sinh mã.
3. Hệ thống tạo mã đơn vị tính mới.
4. Hệ thống hiển thị mã được sinh tại trường Mã đơn vị tính.
5. Người dùng tiếp tục nhập các thông tin còn lại.
6. Người dùng thực hiện lưu dữ liệu.

### Quy tắc nghiệp vụ

- Mã được sinh phải là duy nhất.
- Mã được sinh phải tuân thủ định dạng mã của hệ thống.
- Chức năng sinh mã chỉ tạo giá trị, chưa thực hiện lưu dữ liệu.
- Mã được sinh có thể được thay đổi thủ công nếu hệ thống cho phép.
- Việc sinh mã không được làm mất dữ liệu tại các trường khác.

### Validation

- Mã được sinh không được để trống.
- Mã được sinh không được trùng.
- Mã được sinh phải đúng định dạng.
- Mã được sinh phải nằm trong giới hạn độ dài cho phép.

### Kết quả mong đợi

- Hệ thống tạo được một mã đơn vị tính hợp lệ.
- Mã được hiển thị đúng tại trường Mã đơn vị tính.
- Các dữ liệu đã nhập tại trường khác vẫn được giữ nguyên.
- Người dùng có thể tiếp tục hoàn thành biểu mẫu và lưu dữ liệu.

### Ngoại lệ

- Hệ thống không thể sinh mã.
- Mã được sinh bị trùng.
- Mã được sinh không đúng định dạng.
- Hệ thống mất kết nối trong quá trình sinh mã.
- Người dùng thực hiện sinh mã nhiều lần liên tiếp.

### Automation

Screen: UnitOfMeasure

Operation: GenerateCode

Priority: Medium

Automation Candidate: Yes

Tags:

- regression
- category
- unit-of-measure
- generate-code

---

## Feature: Tìm kiếm đơn vị tính

### Mô tả

Cho phép người dùng tìm kiếm đơn vị tính theo mã hoặc tên đơn vị tính.

### Điều kiện tiên quyết

- Người dùng đã đăng nhập.
- Người dùng có quyền xem danh mục đơn vị tính.
- Người dùng đang ở màn hình Danh mục đơn vị tính.

### Input

| Trường           | Bắt buộc | Quy tắc                               |
| ---------------- | -------- | ------------------------------------- |
| Từ khóa tìm kiếm | Không    | Cho phép nhập mã hoặc tên đơn vị tính |

### Luồng chính

1. Người dùng mở màn hình Danh mục đơn vị tính.
2. Hệ thống hiển thị ô tìm kiếm với hướng dẫn tìm theo mã hoặc tên đơn vị tính.
3. Người dùng nhập từ khóa tìm kiếm.
4. Người dùng thực hiện tìm kiếm hoặc hệ thống tự động tìm kiếm theo thiết kế.
5. Hệ thống xử lý từ khóa.
6. Hệ thống truy vấn các đơn vị tính phù hợp.
7. Hệ thống hiển thị kết quả trong danh sách.

### Quy tắc nghiệp vụ

- Cho phép tìm kiếm theo mã đơn vị tính.
- Cho phép tìm kiếm theo tên đơn vị tính.
- Từ khóa có thể được tìm theo giá trị chính xác hoặc gần đúng tùy thiết kế hệ thống.
- Khi không nhập từ khóa, hệ thống có thể hiển thị toàn bộ danh sách.
- Kết quả tìm kiếm phải tuân thủ quyền xem dữ liệu của người dùng.
- Kết quả có thể được phân trang khi số lượng dữ liệu lớn.

### Validation

- Khoảng trắng đầu và cuối của từ khóa phải được xử lý phù hợp.
- Từ khóa chỉ chứa khoảng trắng phải được xử lý như dữ liệu trống.
- Ký tự đặc biệt không được làm lỗi truy vấn.
- Từ khóa phải tuân thủ giới hạn độ dài do hệ thống quy định.
- Nội dung nhập không được gây lỗi bảo mật hoặc lỗi truy vấn dữ liệu.

### Kết quả mong đợi

- Hệ thống hiển thị đúng các đơn vị tính có mã hoặc tên phù hợp.
- Không hiển thị dữ liệu không thỏa mãn điều kiện tìm kiếm.
- Danh sách hiển thị các cột phù hợp, bao gồm số thứ tự và mã đơn vị tính.
- Hệ thống hiển thị trạng thái phù hợp khi không có kết quả.
- Dữ liệu hiển thị chính xác và không bị trùng lặp.
- Kết quả được phân trang đúng nếu có.

### Ngoại lệ

- Người dùng không có quyền xem danh mục đơn vị tính.
- Không tìm thấy dữ liệu phù hợp.
- Từ khóa vượt quá độ dài cho phép.
- Từ khóa chứa ký tự đặc biệt.
- Từ khóa chỉ chứa khoảng trắng.
- Hệ thống xảy ra lỗi trong quá trình truy vấn.
- Hệ thống mất kết nối khi đang tìm kiếm.

### Automation

Screen: UnitOfMeasure

Operation: Search

Priority: High

Automation Candidate: Yes

Tags:

- smoke
- regression
- category
- unit-of-measure
- search
