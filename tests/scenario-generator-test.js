import TestScenarioGenerator 
from "../src/generators/TestScenarioGenerator.js";


import AIAnalysisResult 
from "../src/models/AIAnalysisResult.js";


console.log("\n=================================");
console.log(" TEST SCENARIO GENERATOR TEST");
console.log("=================================\n");



const aiResult =
    new AIAnalysisResult();



aiResult.featureUnderstanding =
    "Quản lý thiết bị trong hệ thống";



aiResult.riskAreas = [

    "Mã thiết bị không được trùng",

    "Thiếu thông tin bắt buộc"

];



aiResult.suggestedScenarios = [

    "Thêm thiết bị thành công",

    "Thêm thiết bị với mã đã tồn tại",

    "Thêm thiết bị thiếu thông tin bắt buộc"

];



const generator =
    new TestScenarioGenerator();



const scenarios =
    generator.generate(
        aiResult.suggestedScenarios
    );



console.log("Generated Scenarios:");

console.log(
    scenarios
);



console.log("\nJSON:");

console.log(
    JSON.stringify(
        scenarios,
        null,
        2
    )
);



console.log("\n=================================");
console.log(" SCENARIO GENERATOR TEST COMPLETED");
console.log("=================================\n");