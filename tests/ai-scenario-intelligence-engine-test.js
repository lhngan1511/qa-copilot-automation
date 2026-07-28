import assert from "node:assert/strict";
import AIScenarioIntelligenceEngine from "../src/engines/AIScenarioIntelligenceEngine.js";
import ScenarioIntelligenceInput from "../src/models/ScenarioIntelligenceInput.js";

class FakeProvider {
    constructor(value) { this.value = value; }
    async generate() { return this.value; }
}
const input = new ScenarioIntelligenceInput({
    module: { id: "MOD001", name: "Domain" },
    functions: [{ id: "FUNC001", moduleId: "MOD001", name: "Action" }]
});
const valid = {
    scenarios: [
        { functionId: "FUNC001", title: "Valid", expectedResults: ["Result"], requirementReferences: ["REF"] },
        { functionId: "UNKNOWN", title: "Unknown", requirementReferences: ["REF"] },
        { functionId: "FUNC001", title: "No reference" }
    ],
    confidence: 0.8
};
const result = await new AIScenarioIntelligenceEngine(
    new FakeProvider(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``)
).analyze(input);
assert.equal(result.status, "SUCCESS");
assert.equal(result.source, "fake");
assert.equal(result.scenarios.length, 1);
assert.equal(result.scenarios[0].function, "Action");
assert.equal((await new AIScenarioIntelligenceEngine(new FakeProvider("{bad")).analyze(input)).status, "FAILED");
console.log("AIScenarioIntelligenceEngine test PASSED");
