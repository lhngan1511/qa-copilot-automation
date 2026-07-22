class TestData {

    constructor() {

        // Tên trường dữ liệu
        // Ví dụ: Mã thiết bị, Captcha, Email
        this.field = "";


        // Loại dữ liệu
        // STATIC
        // AUTO_GENERATED
        // RANDOM
        // CURRENT_DATE
        // USER_INPUT
        // SYSTEM_VALUE
        // NOT_AUTOMATABLE
        this.type = "STATIC";


        // Giá trị dữ liệu cụ thể
        // Ví dụ:
        // TB001
        // Laptop Dell
        this.value = "";


        // Quy tắc sinh dữ liệu
        // Ví dụ:
        // DEVICE_CODE_GENERATOR
        // EMAIL_GENERATOR
        this.generator = "";


        // Nguồn dữ liệu
        // USER
        // SYSTEM
        // DATABASE
        // API
        // CONFIG
        this.source = "USER";


        // Ghi chú xử lý đặc biệt
        // Ví dụ:
        // Captcha cho phép nhập bất kỳ giá trị
        // OTP không automation
        this.note = "";


        // Có cho phép automation hay không
        // Dùng để hỗ trợ Playwright Generator sau này
        this.automationAllowed = true;

    }

}


export default TestData;