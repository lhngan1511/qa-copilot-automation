export default class ScenarioIntelligencePromptBuilder {
    build(input) {
        const data = typeof input?.toJSON === "function" ? input.toJSON() : input;
        return `You are a Senior QA Analyst, Risk-Based Testing Specialist, and Test Design Specialist.
Use only approved module/functions. Clarification answers override inference.
Do not generate test cases or invent UI/API behavior. Each scenario belongs to exactly one function.
Do not repeat rule scenarios with the same objective. Each scenario needs coveredRules or requirementReferences.
Respect constraints and return an empty scenarios array when rule coverage is sufficient.
Return JSON only without markdown fences or surrounding explanation.

INPUT:
${JSON.stringify(data, null, 2)}

OUTPUT:
{"scenarios":[{"id":"","moduleId":"","functionId":"","title":"","description":"","type":"positive|negative|boundary|permission|exception|security|data-integrity","priority":"Critical|High|Medium|Low","preconditions":[],"testDataHints":[],"steps":[],"expectedResults":[],"requirementReferences":[],"coveredRules":[],"riskReason":"","source":"ai"}],"notes":[],"confidence":0}`;
    }
}
