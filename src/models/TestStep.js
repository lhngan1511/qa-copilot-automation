class TestStep {

    constructor() {

        // Thứ tự thực hiện của bước
        this.order = 0;


        // Hành động cần thực hiện
        // Ví dụ: click, fill, verify
        this.action = "";


        // Đối tượng tác động
        // Ví dụ: Mã thiết bị, nút Lưu
        this.target = "";


        // Giá trị sử dụng
        this.value = "";


        // Kết quả mong đợi tại bước này
        this.expected = "";

    }

}


export default TestStep;