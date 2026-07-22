import TestScenario from "../src/models/TestScenario.js";
import TestStepGenerator from "../src/generators/TestStepGenerator.js";

console.log("\n=================================");
console.log(" TEST STEP GENERATOR TEST");
console.log("=================================\n");

const scenario = new TestScenario();

scenario.feature = "Thiết bị";
scenario.title = "Thêm thiết bị thành công";
scenario.type = "POSITIVE";

const generator = new TestStepGenerator();

const steps = generator.generate(scenario);

console.log("Generated Steps:");
console.log(steps);

console.log("\nJSON:");
console.log(
    JSON.stringify(
        steps,
        null,
        2
    )
);

console.log("\n=================================");
console.log(" TEST STEP GENERATOR COMPLETED");
console.log("=================================\n");