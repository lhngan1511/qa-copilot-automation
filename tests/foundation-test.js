import TestCase from "../src/models/TestCase.js";
import TestData from "../src/models/TestData.js";

import TestCaseIdGenerator from "../src/utils/TestCaseIdGenerator.js";
import FileNameGenerator from "../src/utils/FileNameGenerator.js";

import DataTypes from "../src/constants/DataTypes.js";


console.log("\n=================================");
console.log(" QA COPILOT FOUNDATION TEST");
console.log("=================================\n");


// 1. Test TestCase Model

const testCase = new TestCase();

testCase.id = "TC001";
testCase.title = "Thêm thiết bị thành công";

console.log("TestCase:");
console.log(testCase);


// 2. Test TestData Model

const testData = new TestData();

testData.field = "Mã thiết bị";
testData.type = DataTypes.AUTO_GENERATED;
testData.generator = "DEVICE_CODE_GENERATOR";

console.log("\nTestData:");
console.log(testData);


// 3. Test TestCaseIdGenerator

const idGenerator = new TestCaseIdGenerator();

console.log("\nGenerated IDs:");

console.log(
    idGenerator.generate()
);

console.log(
    idGenerator.generate()
);


// 4. Test FileNameGenerator

const fileNameGenerator = new FileNameGenerator();

console.log("\nGenerated File Name:");

console.log(
    fileNameGenerator.generate(
        "thiet-bi",
        "json"
    )
);


console.log("\n=================================");
console.log(" FOUNDATION TEST COMPLETED");
console.log("=================================\n");