const DataTypes = {

    // Dữ liệu cố định
    // Ví dụ: Laptop Dell, TB001
    STATIC: "STATIC",


    // Dữ liệu được sinh tự động
    // Ví dụ: mã thiết bị, mã phiếu
    AUTO_GENERATED: "AUTO_GENERATED",


    // Dữ liệu ngẫu nhiên
    // Ví dụ: email, số điện thoại
    RANDOM: "RANDOM",


    // Dữ liệu ngày hiện tại
    CURRENT_DATE: "CURRENT_DATE",


    // Dữ liệu do người dùng nhập
    // Ví dụ: captcha test environment
    USER_INPUT: "USER_INPUT",


    // Dữ liệu lấy từ hệ thống
    // Ví dụ: user login hiện tại
    SYSTEM_VALUE: "SYSTEM_VALUE",


    // Dữ liệu không thể tự động hóa
    // Ví dụ: captcha hình ảnh
    NOT_AUTOMATABLE: "NOT_AUTOMATABLE"

};


export default DataTypes;