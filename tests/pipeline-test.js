import QACopilot from "../src/QACopilot.js";

console.log("\n=================================");
console.log(" QA COPILOT PIPELINE TEST");
console.log("=================================\n");

const qaCopilot = new QACopilot();

const result = qaCopilot.run(
    "./requirements/thiet-bi.md"
);

console.log("\n=================================");
console.log(" PIPELINE SUMMARY");
console.log("=================================\n");

console.log("Feature:");
console.log(result.requirement.feature);

console.log("\nPurpose:");
console.log(result.requirement.purpose);

console.log("\nScenarios:");
console.log(result.scenarios.length);

console.log("\nTestCases:");
console.log(result.testCases.length);

console.log("\nOutput:");
console.log(result.output);

console.log("\n=================================");
console.log(" PIPELINE TEST COMPLETED");
console.log("=================================\n");