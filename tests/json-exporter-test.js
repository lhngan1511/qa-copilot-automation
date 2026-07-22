import fs from "fs";

import JsonExporter from "../src/exporters/JsonExporter.js";
import TestCase from "../src/models/TestCase.js";

console.log("\n=================================");
console.log(" JSON EXPORTER TEST");
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

const exporter = new JsonExporter();

const outputPath = "./output/testcases.json";

exporter.export(
    [testCase],
    outputPath
);

console.log("\nExported File:");

const json =
    fs.readFileSync(
        outputPath,
        "utf8"
    );

console.log(json);

console.log("\n=================================");
console.log(" JSON EXPORTER COMPLETED");
console.log("=================================\n");