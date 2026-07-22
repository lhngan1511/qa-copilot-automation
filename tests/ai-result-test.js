import AIAnalysisResult 
from "../src/models/AIAnalysisResult.js";


console.log("\n=================================");
console.log(" AI ANALYSIS RESULT TEST");
console.log("=================================\n");



const result =
    new AIAnalysisResult();



result.featureUnderstanding =
    "Quản lý thiết bị trong hệ thống";


result.testFocus = [

    "Thêm thiết bị",

    "Kiểm tra dữ liệu bắt buộc",

    "Kiểm tra mã thiết bị trùng"

];



result.riskAreas = [

    "Mã thiết bị đã tồn tại",

    "Thiếu thông tin bắt buộc"

];



result.suggestedScenarios = [

    "Thêm thiết bị thành công",

    "Thêm thiết bị với mã đã tồn tại",

    "Thêm thiết bị thiếu tên thiết bị"

];



result.questions = [

    "Quy tắc sinh mã thiết bị?"

];



result.notes = [

    "Cần kiểm tra quyền quản lý thiết bị"

];



result.confidence = 0.85;



console.log("AI Analysis Result:");

console.log(result);



console.log("\nJSON:");

console.log(
    JSON.stringify(
        result,
        null,
        2
    )
);



console.log("\n=================================");
console.log(" AI RESULT TEST COMPLETED");
console.log("=================================\n");