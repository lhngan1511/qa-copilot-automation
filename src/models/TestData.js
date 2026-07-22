class TestData {

    constructor() {

        // ==========================
        // Input Data
        // ==========================

        this.inputs = {};

        // Ví dụ:
        // {
        //     deviceCode: "TB001",
        //     deviceName: "Laptop Dell",
        //     category: "Laptop"
        // }

        // ==========================
        // Expected Data
        // ==========================

        this.expected = {};

        // Ví dụ:
        // {
        //     message: "Thêm thiết bị thành công"
        // }

        // ==========================
        // Invalid Data
        // ==========================

        this.invalid = {};

        // Ví dụ:
        // {
        //     deviceCode: "",
        //     email: "abc",
        //     quantity: -1
        // }

    }

}

export default TestData;