export default class RequirementAnalysisPromptBuilder {
    build(requirement) {
        const requirementData = JSON.stringify(requirement ?? {}, null, 2);

        return `
You are acting as a Senior Business Analyst.

Extract requirement knowledge from the supplied requirement.

EVIDENCE RULES:
- Extract only information supported by the requirement.
- Do not assign or invent a module.
- Do not create module IDs or function IDs.
- Do not infer permissions that are not explicitly supported.
- Do not create boundaries when the requirement has no explicit limit.
- Do not infer technical dependencies, databases, APIs, services, or architecture.
- Record an assumption only when the source explicitly presents it as an assumption.
- Never present an assumption as a confirmed fact.
- Preserve requirement references for functions and rules whenever they can be identified.
- Do not generate testcases or test scenarios.
- Do not generate suggestedScenarios, featureUnderstanding, or testFocus.
- Do not decide approval.

CLARIFICATION QUESTION RULES:
- Ask only about missing information that directly affects testcase design or expected results.
- Use short, clear questions that a business user can answer easily.
- Each question must address exactly one issue.
- Ask no more than 5 clarification questions.
- Prioritize categories in this order: Business Rule, Validation, Permission, Boundary, Exception.
- Each question must contain between 2 and 5 options.
- Every question must include the option "Chưa xác định".
- The reason must briefly explain why the answer affects testcase design.
- Do not answer clarification questions on the user's behalf.
- Do not infer rules without evidence in the requirement.
- If no clarification is needed, return an empty clarificationQuestions array.

OUTPUT CONTRACT:
Return only valid JSON. Do not return Markdown, commentary, or code fences.
Use exactly this structure:
{
  "purpose": "string",
  "functions": [
    {
      "name": "string",
      "description": "string",
      "businessRules": ["string"],
      "validationRules": ["string"],
      "permissions": ["string"],
      "dependencies": ["string"],
      "assumptions": ["string"],
      "requirementReferences": ["string"]
    }
  ],
  "risks": ["string"],
  "clarificationQuestions": [
    {
      "id": "CL001",
      "category": "Business Rule | Validation | Permission | Boundary | Exception | General",
      "priority": "High | Medium | Low",
      "question": "string",
      "reason": "string",
      "options": ["string", "string", "Chưa xác định"],
      "requirementReferences": ["string"]
    }
  ],
  "requirementComplete": false
}

Clarification question IDs must be unique within the response and sequential:
CL001, CL002, CL003, and so on.

REQUIREMENT DATA:
${requirementData}
`.trim();
    }
}
