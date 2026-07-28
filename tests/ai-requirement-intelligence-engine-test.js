import assert from "node:assert/strict";
import AIRequirementIntelligenceEngine from "../src/engines/AIRequirementIntelligenceEngine.js";
import RequirementIntelligenceInput from "../src/models/RequirementIntelligenceInput.js";

class FakeProvider {
    constructor(response) {
        this.response = response;
    }
    async generate() {
        return this.response;
    }
}

const input = new RequirementIntelligenceInput({
    requirement: { module: "Customer" },
    approvedRequirement: { approvalStatus: "approved" }
});
const validResponse = {
    module: { id: "MOD001", name: "Customer", purpose: "Manage customers" },
    functions: [
        {
            id: "FUNC001",
            moduleId: "MOD001",
            name: "Create customer",
            businessRules: ["Unique code"],
            requirementReferences: ["Create customer"]
        }
    ],
    notes: [],
    confidence: 0.9
};
const success = await new AIRequirementIntelligenceEngine(
    new FakeProvider(`text\n\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\``)
).analyze(input);
assert.equal(success.status, "SUCCESS");
assert.equal(success.source, "fake");
assert.equal(success.knowledge.functions.length, 1);

const malformed = await new AIRequirementIntelligenceEngine(
    new FakeProvider("{bad")
).analyze(input);
assert.equal(malformed.status, "FAILED");
const missingModule = await new AIRequirementIntelligenceEngine(
    new FakeProvider(JSON.stringify({ functions: validResponse.functions }))
).analyze(input);
assert.equal(missingModule.status, "FAILED");
const missingFunctions = await new AIRequirementIntelligenceEngine(
    new FakeProvider(JSON.stringify({ module: validResponse.module, functions: [] }))
).analyze(input);
assert.equal(missingFunctions.status, "FAILED");
const validatorError = await new AIRequirementIntelligenceEngine(
    new FakeProvider(
        JSON.stringify({
            module: validResponse.module,
            functions: [{ ...validResponse.functions[0], moduleId: "MOD999" }]
        })
    )
).analyze(input);
assert.equal(validatorError.status, "FAILED");

console.log("AIRequirementIntelligenceEngine test PASSED");
