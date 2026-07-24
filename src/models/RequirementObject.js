class RequirementObject {


    constructor() {


        // ==========================
        // Requirement Identity
        // ==========================

        // Tên chức năng / module

        this.feature = "";


        // Mục đích chức năng

        this.purpose = "";



        // ==========================
        // Business Understanding
        // ==========================

        // Các đối tượng nghiệp vụ

        // Ví dụ:
        // Thiết bị
        // Nhân viên
        // Phiếu nhập

        this.entities = [];



        // Các hành động người dùng

        // Ví dụ:
        // thêm
        // sửa
        // xóa
        // tìm kiếm

        this.actions = [];



        // ==========================
        // Input Intelligence
        // ==========================

        // Danh sách input đơn giản

        this.inputs = [];



        // Chi tiết định nghĩa input

        // {
        //   name,
        //   type,
        //   required,
        //   format,
        //   validation
        // }

        this.inputDefinitions = [];



        // ==========================
        // Business Rules
        // ==========================

        this.conditions = [];


        this.businessRules = [];



        // ==========================
        // Expected Behavior
        // ==========================

        this.expectedResults = [];



        // ==========================
        // Risk Analysis
        // ==========================

        // Các trường hợp biên

        this.edgeCases = [];


        // Các câu hỏi cần AI làm rõ

        this.questions = [];



        // ==========================
        // Traceability
        // ==========================

        // Module bị ảnh hưởng

        this.affectedModules = [];



        // ==========================
        // Metadata
        // ==========================

        this.notes = [];


        // Requirement version

        this.version = "1.0";


        // Source document

        this.source = "";


    }


}


export default RequirementObject;