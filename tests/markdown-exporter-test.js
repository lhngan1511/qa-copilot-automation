import fs from "fs";
import assert from "node:assert/strict";

import MarkdownExporter from "../src/exporters/MarkdownExporter.js";
import TestCase from "../src/models/TestCase.js";

console.log("\n=================================");
console.log(" MARKDOWN EXPORTER TEST");
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

const exporter = new MarkdownExporter();
const manualTestCase = {
    ...structuredClone(testCase),
    id: "TC008",
    testcaseId: "TC008",
    title: "Xóa kho không thành công",
    testData: {
        fields: {},
        requirement: "",
        value: "Tên kho: kho Trang thiết bị",
        requiresTesterInput: false
    }
};

const outputPath = "./output/testcases.md";

exporter.export(
    [testCase, manualTestCase],
    outputPath
);

console.log("\nExported Markdown:\n");

const markdown = fs.readFileSync(
    outputPath,
    "utf8"
);

console.log(markdown);
assert.match(markdown, /### Dữ liệu kiểm thử[\s\S]*- Tên kho: kho Trang thiết bị/);

console.log("\n=================================");
console.log(" MARKDOWN EXPORTER COMPLETED");
console.log("=================================\n");
