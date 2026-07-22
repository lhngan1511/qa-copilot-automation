import IntelligenceScenarioGenerator from "./generators/IntelligenceScenarioGenerator.js";
import TestCaseGenerator from "./generators/TestCaseGenerator.js";



const requirement = {

    feature: "Thiết bị",

    conditions: [
        "Người dùng đã đăng nhập",
        "Có quyền thêm thiết bị"
    ]

};



const recommendedScenarios = [

    {
        title: "Thêm thiết bị thành công",
        type: "POSITIVE",
        priority: "MEDIUM"
    },

    {
        title: "Mã thiết bị không được trùng",
        type: "NEGATIVE",
        priority: "HIGH"
    },

    {
        title: "Tên thiết bị không được để trống",
        type: "NEGATIVE",
        priority: "HIGH"
    }

];



const scenarioGenerator =
    new IntelligenceScenarioGenerator();



const scenarios =
    scenarioGenerator.generate(
        recommendedScenarios,
        requirement
    );



console.log("====== SCENARIOS ======");

console.log(
    JSON.stringify(
        scenarios,
        null,
        2
    )
);



const testCaseGenerator =
    new TestCaseGenerator();



const testCases =
    testCaseGenerator.generate(
        scenarios,
        requirement
    );



console.log("====== TEST CASES ======");

console.log(
    JSON.stringify(
        testCases,
        null,
        2
    )
);