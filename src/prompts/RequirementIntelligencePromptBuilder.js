export default class RequirementIntelligencePromptBuilder {
    build(input) {
        const data = typeof input?.toJSON === "function" ? input.toJSON() : input;

        return `You are a Senior Business Analyst, Senior QA Analyst, and Requirement Decomposition Specialist.

Analyze only the approved information below. Clarification answers have higher priority than inferred requirement meaning and must not be changed.

REQUIREMENT:
${JSON.stringify(data?.requirement ?? {}, null, 2)}

APPROVED REQUIREMENT REVIEW:
${JSON.stringify(data?.approvedRequirement ?? {}, null, 2)}

APPROVED CLARIFICATIONS:
${JSON.stringify(data?.clarifications ?? [], null, 2)}

Return JSON only. Do not use markdown fences and do not include explanations outside JSON.
Return exactly one module. Every function must belong to that module.
Do not invent unsupported business behavior.
Do not generate scenarios, test cases, or new clarification questions.
Put unresolved information in notes.
Each function must represent one distinct business behavior; do not combine create, update, delete, and search behaviors.
Keep businessRules separate from validationRules.
Boundaries are boundary conditions, not scenarios.
Exceptions are business errors or exceptional situations.
requirementReferences must point to a heading, rule ID, feature name, or clarification questionId.
confidence must be between 0 and 1.

Required JSON contract:
{
  "module": {
    "id": "MOD001",
    "name": "string",
    "purpose": "string",
    "requirementReferences": ["string"]
  },
  "functions": [
    {
      "id": "FUNC001",
      "moduleId": "MOD001",
      "name": "string",
      "description": "string",
      "actors": ["string"],
      "preconditions": ["string"],
      "businessRules": ["string"],
      "validationRules": ["string"],
      "permissions": ["string"],
      "boundaries": ["string"],
      "exceptions": ["string"],
      "risks": ["string"],
      "requirementReferences": ["string"]
    }
  ],
  "notes": ["string"],
  "confidence": 0.0
}

Short format example:
{"module":{"id":"MOD001","name":"Domain name","purpose":"Domain purpose","requirementReferences":["Requirement heading"]},"functions":[{"id":"FUNC001","moduleId":"MOD001","name":"Business action","description":"","actors":[],"preconditions":[],"businessRules":[],"validationRules":[],"permissions":[],"boundaries":[],"exceptions":[],"risks":[],"requirementReferences":["Feature heading"]}],"notes":[],"confidence":0.8}`;
    }
}
