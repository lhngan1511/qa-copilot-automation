export default class RequirementAnalysisPromptBuilder {
    build(requirement) {
        const requirementData = JSON.stringify(requirement ?? {}, null, 2);

        return `
You are acting as a Senior Business Analyst supporting software testers.

Extract requirement knowledge from the supplied requirement.

EVIDENCE RULES:
- Extract only information supported by the requirement.
- Do not assign or invent a module, IDs, permissions, limits, formats, defaults, dependencies, APIs, services, databases, or architecture.
- In particular, never invent maximum or minimum lengths when the requirement contains no evidence that such a limit exists.
- Record an assumption only when the source contains enough evidence for one specific, testable assumption.
- Never present an assumption as a confirmed fact.
- Preserve requirement references for functions and rules whenever they can be identified.
- Do not generate testcases, test scenarios, suggestedScenarios, featureUnderstanding, or testFocus.
- Do not decide approval.

CLARIFICATION PURPOSE:
Ask only when the answer will materially change testcase inputs, preconditions, execution steps, branching, or expected results.
Return at most 5 highest-impact missing decisions. Return fewer when fewer are justified.

CLARIFICATION QUALITY RULES:
- Do not ask generic questions such as "Can you provide more details?" or "Is this correct?".
- Do not ask about information that is already present in the requirement.
- Do not invent a missing rule merely to ask about it.
- Ask one question for one missing decision. Never combine unrelated fields or rules.
- Make every question specific enough for a business user to answer without interpretation.
- Do not produce duplicate, punctuation-only, capitalization-only, or semantically equivalent questions.
- When multiple gaps exist, prioritize: Business Rule, Validation, Permission, Boundary, Exception.
- The reason must state exactly how the answer changes testcase generation.
- Use targetField for a question about one input field.
- Use targetRule for a question about one named or quoted business rule.
- allowNotSpecified must be true only when "Requirement không đề cập" is an acceptable explicit tester answer.

QUESTION TYPES:
- YES_NO: only a genuine binary decision. Do not provide options; the application supplies Có/Không and optionally Requirement không đề cập.
- SINGLE_CHOICE: only when the requirement provides real, mutually exclusive alternatives. Include only those alternatives in options. Never invent alternatives.
- FREE_TEXT: when a concrete value, limit, format, role, message, or other value must be supplied. Do not provide options.
- CONFIRM_ASSUMPTION: only when asking the tester to confirm one explicit, specific assumption. Write that assumption in the question. Do not provide options.

Examples of valid clarification contracts:
- FREE_TEXT: {"question":"Độ dài tối đa của trường Mã thiết bị là bao nhiêu ký tự?","type":"FREE_TEXT","targetField":"Mã thiết bị","options":[]}
  Use this only if the requirement indicates a length constraint exists but omits its value. Do not ask it otherwise.
- YES_NO: {"question":"Có cho phép xóa thiết bị đang được sử dụng không?","type":"YES_NO","targetRule":"Xóa thiết bị đang được sử dụng","options":[]}
- SINGLE_CHOICE: {"question":"Khi tạo mới, trạng thái ban đầu là giá trị nào?","type":"SINGLE_CHOICE","targetField":"Trạng thái","options":["Hoạt động","Ngừng hoạt động"]}
  Use only if those alternatives are present in the requirement.
- CONFIRM_ASSUMPTION: {"question":"Xác nhận giả định: mã thiết bị được so sánh không phân biệt chữ hoa và chữ thường?","type":"CONFIRM_ASSUMPTION","targetRule":"Tính duy nhất của mã thiết bị","options":[]}

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
      "type": "YES_NO | SINGLE_CHOICE | FREE_TEXT | CONFIRM_ASSUMPTION",
      "reason": "string",
      "targetField": "optional string",
      "targetRule": "optional string",
      "options": [],
      "allowNotSpecified": false,
      "requirementReferences": ["string"]
    }
  ],
  "requirementComplete": false
}

For FREE_TEXT, YES_NO, and CONFIRM_ASSUMPTION, options must be an empty array.
For SINGLE_CHOICE, options must contain 2 to 5 real alternatives supported by the requirement.
Clarification IDs must be unique and sequential: CL001, CL002, CL003, and so on.
If no material clarification is needed, return an empty clarificationQuestions array.
Do not answer clarification questions on the user's behalf.

REQUIREMENT DATA:
${requirementData}
`.trim();
    }
}
