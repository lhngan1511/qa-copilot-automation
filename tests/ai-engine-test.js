import AIAnalysisEngine 
from "../src/engines/AIAnalysisEngine.js";


import RequirementObject 
from "../src/models/RequirementObject.js";


console.log("\n=================================");
console.log(" AI ANALYSIS ENGINE TEST");
console.log("=================================\n");



const requirement =
    new RequirementObject();



requirement.feature =
    "Thiết bị";


requirement.purpose =
    "Quản lý thông tin thiết bị trong hệ thống.";



requirement.businessRules = [

    "Mã thiết bị không được trùng.",

    "Không được bỏ trống các trường bắt buộc."

];



requirement.edgeCases = [

    "Mã thiết bị đã tồn tại.",

    "Thiếu thông tin bắt buộc."

];



requirement.questions = [];

requirement.notes = [];



const engine =
    new AIAnalysisEngine();



const result =
    engine.analyze(
        requirement
    );



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
console.log(" AI ENGINE TEST COMPLETED");
console.log("=================================\n");