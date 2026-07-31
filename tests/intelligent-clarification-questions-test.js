import assert from "node:assert/strict";
import AIAnalysisEngine from "../src/engines/AIAnalysisEngine.js";
import FallbackAIProvider from "../src/providers/FallbackAIProvider.js";
import QACopilot from "../src/QACopilot.js";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";

class GeminiProvider {
    async generate() {
        throw new Error("Gemini unavailable");
    }
}
class OllamaProvider {
    async generate() {
        return JSON.stringify({
            purpose: "Kiểm tra xóa thiết bị",
            functions: [],
            risks: [],
            clarificationQuestions: [
                {
                    id: "CL001",
                    category: "Business Rule",
                    priority: "High",
                    question: "Có cho phép xóa thiết bị đang được sử dụng không?",
                    type: "YES_NO",
                    reason: "Câu trả lời quyết định expected result của ca kiểm thử xóa.",
                    targetRule: "Xóa thiết bị đang sử dụng",
                    options: [],
                    allowNotSpecified: true
                }
            ],
            requirementComplete: false
        });
    }
}

const fallbackProvider = new FallbackAIProvider(new GeminiProvider(), new OllamaProvider());
const fallbackEngine = new AIAnalysisEngine(fallbackProvider);
const ollamaResult = await fallbackEngine.analyze({
    module: "Thiết bị",
    feature: "Xóa thiết bị"
});
assert.equal(fallbackProvider.lastSuccessfulProviderName, "ollama");
assert.equal(ollamaResult.analysisStatus, "SUCCESS");
assert.equal(ollamaResult.questions[0].type, "YES_NO");
assert.deepEqual(ollamaResult.questions[0].options, ["Có", "Không", "Requirement không đề cập"]);

const failedEngine = new AIAnalysisEngine({
    async generate() {
        throw new Error("All providers unavailable");
    }
});
const ruleFallback = await failedEngine.analyze({
    module: "Thiết bị",
    questions: [
        {
            question: "Vai trò nào được phép xóa thiết bị?",
            type: "FREE_TEXT",
            targetRule: "Quyền xóa thiết bị",
            allowNotSpecified: true
        }
    ]
});
assert.equal(ruleFallback.analysisStatus, "FALLBACK");
assert.equal(ruleFallback.questions[0].type, "FREE_TEXT");
assert.equal("options" in ruleFallback.questions[0], false);

const qaCopilot = new QACopilot();
const sessionId = "SESSION-INTELLIGENT-CLARIFICATION";
const artifactId = "ARTIFACT-INTELLIGENT-CLARIFICATION";
qaCopilot.workflowCoordinator.startClarificationReview({
    sessionId,
    artifactId,
    clarification: {
        artifactId,
        artifactType: "AI_ANALYSIS_REVIEW",
        approvalStatus: "pending",
        requirement: { module: "Thiết bị" },
        aiAnalysis: { purpose: "Kiểm tra thiết bị", functions: [], risks: [] },
        questions: [
            {
                questionId: "CL001",
                question: "Độ dài tối đa của Mã thiết bị là bao nhiêu?",
                type: "FREE_TEXT",
                targetField: "Mã thiết bị",
                allowNotSpecified: false,
                status: "pending",
                answer: ""
            }
        ]
    }
});
assert.throws(
    () => qaCopilot.approveClarification({ sessionId, artifactId }),
    /All clarification questions must be answered/
);
qaCopilot.answerClarificationQuestion({
    sessionId,
    artifactId,
    questionId: "CL001",
    answer: "20 ký tự",
    answeredBy: "tester"
});
qaCopilot.reviewClarification({ sessionId });
qaCopilot.approveClarification({ sessionId, artifactId, approvedBy: "tester" });

const approvedArtifact = qaCopilot.workflowCoordinator.findArtifact(artifactId);
const knowledge = new RequirementKnowledgeMapper().map({ approvedArtifact });
assert.equal(knowledge.clarificationAnswers[0].answer, "20 ký tự");
assert.equal(knowledge.clarificationQuestions[0].targetField, "Mã thiết bị");

console.log("Intelligent clarification questions test PASSED");
