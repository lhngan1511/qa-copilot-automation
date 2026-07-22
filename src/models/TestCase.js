class TestCase {

    constructor() {

        // Mã định danh testcase
        // Ví dụ: TC001
        this.id = "";


        // Chức năng được kiểm thử
        // Ví dụ: Thêm thiết bị
        this.feature = "";


        // Tên mô tả testcase
        // Ví dụ: Thêm thiết bị với dữ liệu hợp lệ
        this.title = "";


        // Loại testcase
        // Positive / Negative / Boundary
        this.type = "";


        // Điều kiện trước khi chạy test
        this.preconditions = [];


        // Dữ liệu sử dụng trong testcase
        this.testData = null;


        // Các bước thực hiện
        this.steps = [];


        // Kết quả mong đợi
        this.expectedResults = [];


        // Mức độ ảnh hưởng
        // High / Medium / Low
        this.severity = "Medium";


        // Mức độ ưu tiên
        // High / Medium / Low
        this.priority = "Medium";


        // Có thể tự động hóa bằng Playwright không
        this.automationCandidate = false;

    }

}


export default TestCase;