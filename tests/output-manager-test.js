import OutputManager from "../src/managers/OutputManager.js";
import TestCase from "../src/models/TestCase.js";

console.log("\n=================================");
console.log(" OUTPUT MANAGER TEST");
console.log("=================================\n");

const testCase = new TestCase();

testCase.id = "TC001";
testCase.feature = "Thiết bị";
testCase.title = "Thêm thiết bị thành công";
testCase.type = "POSITIVE";

testCase.steps = [
    "Mở màn hình",
    "Nhập dữ liệu",
    "Nhấn Lưu"
];

testCase.expectedResults = [
    "Thêm thiết bị thành công"
];

const manager =
    new OutputManager();

const file = manager.export(
    [testCase],
    "json",
    "thiet-bi"
);

console.log("\nGenerated File:");

console.log(file);

console.log("\n=================================");
console.log(" OUTPUT MANAGER COMPLETED");
console.log("=================================\n");