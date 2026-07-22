class RequirementObject {

    constructor() {

        // Tên chức năng / module
        this.feature = "";


        // Mục đích của chức năng
        this.purpose = "";


        // Các đối tượng nghiệp vụ
        // Ví dụ: Thiết bị, Nhân viên, Phiếu nhập
        this.entities = [];


        // Các hành động người dùng có thể thực hiện
        // Ví dụ: thêm, sửa, xóa, tìm kiếm
        this.actions = [];


        // Danh sách dữ liệu đầu vào
        this.inputs = [];


        // Định nghĩa chi tiết input
        // Ví dụ: required, type, format
        this.inputDefinitions = [];


        // Điều kiện trước khi thực hiện
        this.conditions = [];


        // Quy tắc nghiệp vụ
        this.businessRules = [];


        // Kết quả mong đợi
        this.expectedResults = [];


        // Các trường hợp ngoại lệ
        this.edgeCases = [];


        // Module bị ảnh hưởng
        this.affectedModules = [];


        // Các câu hỏi AI cần làm rõ
        this.questions = [];


        // Ghi chú bổ sung
        this.notes = [];

    }

}


export default RequirementObject;