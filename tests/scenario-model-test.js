import TestScenario from "../src/models/TestScenario.js";


console.log("\n=================================");
console.log(" TEST SCENARIO MODEL TEST");
console.log("=================================\n");



const scenario =
    new TestScenario();



scenario.id =
    "SC001";


scenario.feature =
    "Thiết bị";


scenario.title =
    "Thêm thiết bị thành công";


scenario.type =
    "POSITIVE";


scenario.preconditions = [

    "Người dùng đã đăng nhập",

    "Có quyền quản lý thiết bị"

];



scenario.testData = {

    "Mã thiết bị": "TB001",

    "Tên thiết bị": "Máy in",

    "Loại thiết bị": "Văn phòng"

};



scenario.steps = [

    "Mở màn hình thêm thiết bị",

    "Nhập thông tin thiết bị",

    "Nhấn nút Lưu"

];



scenario.expectedResults = [

    "Hiển thị thông báo thêm thành công",

    "Thiết bị xuất hiện trong danh sách"

];



scenario.severity =
    "Medium";


scenario.priority =
    "High";


scenario.automationCandidate =
    true;



console.log("Test Scenario:");

console.log(scenario);



console.log("\nJSON:");

console.log(
    JSON.stringify(
        scenario,
        null,
        2
    )
);



console.log("\n=================================");
console.log(" SCENARIO MODEL TEST COMPLETED");
console.log("=================================\n");