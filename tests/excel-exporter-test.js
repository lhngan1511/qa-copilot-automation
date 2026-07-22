import ExcelExporter from "../src/exporters/ExcelExporter.js";
import TestCase from "../src/models/TestCase.js";

console.log("\n=================================");
console.log(" EXCEL EXPORTER TEST");
console.log("=================================\n");

const testCase = new TestCase();

testCase.id = "TC001";

testCase.feature = "Thiết bị";

testCase.title = "Thêm thiết bị thành công";

testCase.type = "POSITIVE";

testCase.preconditions = [
    "Người dùng đã đăng nhập",
    "Có quyền quản lý thiết bị"
];

testCase.steps = [
    "Mở màn hình",
    "Nhập dữ liệu",
    "Nhấn Lưu"
];

testCase.expectedResults = [
    "Thêm thiết bị thành công"
];

testCase.severity = "Medium";

testCase.priority = "High";

testCase.automationCandidate = true;

const exporter = new ExcelExporter();

const outputPath = "./output/testcases.xlsx";

exporter.export(
    [testCase],
    outputPath
);

console.log("\nExcel file created:");

console.log(outputPath);

console.log("\n=================================");
console.log(" EXCEL EXPORTER COMPLETED");
console.log("=================================\n");