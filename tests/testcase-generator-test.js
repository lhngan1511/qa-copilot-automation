import assert from "node:assert/strict";
import TestCaseGenerator 
from "../src/generators/TestCaseGenerator.js";


import TestScenario 
from "../src/models/TestScenario.js";



console.log("\n=================================");
console.log(" TEST CASE GENERATOR TEST");
console.log("=================================\n");



const scenario1 =
    new TestScenario();



scenario1.id = "SC001";

scenario1.feature =
    "Thiết bị";


scenario1.title =
    "Thêm thiết bị thành công";


scenario1.type =
    "POSITIVE";


scenario1.preconditions = [

    "Người dùng đã đăng nhập",

    "Có quyền quản lý thiết bị"

];


scenario1.testData = {

    "Mã thiết bị":"TB001",

    "Tên thiết bị":"Máy in",

    "Loại thiết bị":"Văn phòng"

};


scenario1.expectedResults = [

    "Hiển thị thông báo thêm thiết bị thành công",

    "Thiết bị hiển thị trong danh sách"

];


scenario1.severity =
    "Medium";


scenario1.priority =
    "High";


scenario1.automationCandidate =
    true;





const scenario2 =
    new TestScenario();



scenario2.id = "SC002";


scenario2.feature =
    "Thiết bị";


scenario2.title =
    "Mã thiết bị đã tồn tại";


scenario2.type =
    "NEGATIVE";


scenario2.expectedResults = [

    "Hệ thống không cho phép lưu"

];



scenario2.severity =
    "High";


scenario2.priority =
    "High";


scenario2.automationCandidate =
    true;





const generator =
    new TestCaseGenerator();



const testCases =
    generator.generate(
        [
            scenario1,
            scenario2
        ]
    );



console.log("Generated TestCases:");

console.log(
    testCases
);



testCases.forEach(testCase => {
    assert.ok(testCase.scenario, "Generated testcase must contain scenario");
    assert.equal(testCase.reviewStatus, "PENDING");
    assert.deepEqual(
        testCase.steps,
        [],
        "Generator must not invent execution steps when the scenario has none"
    );
});

console.log("\nJSON:");

console.log(
    JSON.stringify(
        testCases,
        null,
        2
    )
);



console.log("\n=================================");
console.log(" TEST CASE GENERATOR TEST COMPLETED");
console.log("=================================\n");