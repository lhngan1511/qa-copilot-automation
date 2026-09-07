import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";
import IntelligenceScenarioGenerator from "../src/generators/IntelligenceScenarioGenerator.js";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";

/* Bug thật báo lại 2026-09-04 (2 lỗi cùng lúc, cả 2 đều do RequirementKnowledgeMapper):

   1. "Phần testcase sinh từ CodeGen bị trùng nhau" — 1 câu hỏi làm rõ chung chung (targetField rỗng,
      câu hỏi tự do không nhắc tên trường cụ thể, rất phổ biến khi requirement dựng từ bản ghi
      CodeGen) từng bị bơm "an toàn hơn bỏ sót" vào TẤT CẢ function -> mỗi function có trường liên
      quan (vd nhiều function cùng có input dạng ngày) tự sinh RIÊNG 1 testcase giống hệt nhau ->
      NHÂN BẢN. Test này xác nhận: câu hỏi không xác định được field cụ thể chỉ được ghi ở
      knowledge[field] cấp toàn cục (traceability), KHÔNG được bơm vào bất kỳ function nào (thà bỏ
      sót còn hơn nhân bản sai).

   2. "Testcase tạo từ file .md không lấy giá trị từ câu hỏi của AI" — composeClarificationFact() chỉ
      nhận diện vài mẫu câu Yes/No cố định (duy nhất/xóa đang dùng/trùng tên/bắt buộc); câu hỏi khác
      mẫu (vd "có phân biệt chữ hoa/chữ thường không?") dù có targetField rõ ràng vẫn bị bỏ rơi hoàn
      toàn (trả về fact rỗng). Test này xác nhận: câu hỏi Yes/No bất kỳ, có targetField đúng, phải
      tạo được fact KHÔNG RỖNG và fact đó phải tới được đúng function tương ứng. */

const requirement = {
    module: { id: "MOD-NHAPHOC", name: "Đợt nhập học" },
    features: [
        {
            id: "CREATE",
            name: "Thêm mới đợt nhập học",
            inputs: [{ name: "Ngày bắt đầu nộp lệ phí", required: false, description: "" }],
            flow: ["Người dùng nhập ngày bắt đầu", "Người dùng nhấn nút Thực hiện"],
            expectedResults: ["Đợt nhập học mới được thêm vào danh sách"]
        },
        {
            id: "UPDATE",
            name: "Sửa đợt nhập học",
            inputs: [{ name: "Ngày kết thúc nộp lệ phí", required: false, description: "" }],
            flow: ["Người dùng thay đổi ngày kết thúc", "Người dùng nhấn nút Thực hiện"],
            expectedResults: ["Thông tin đợt nhập học được cập nhật thành công"]
        },
        {
            id: "LOGIN",
            name: "Đăng nhập",
            inputs: [{ name: "Tài khoản", required: true, description: "" }],
            flow: ["Người dùng nhập tài khoản", "Người dùng nhấn Đăng nhập"],
            expectedResults: ["Người dùng đăng nhập thành công"]
        }
    ]
};

const approvedArtifact = {
    approvalStatus: "approved",
    requirement,
    aiAnalysis: {
        functions: requirement.features.map(feature => ({ id: feature.id, name: feature.name, description: feature.name }))
    },
    questions: [
        // Câu hỏi chung chung, không nhắc tên trường cụ thể nào -> không xác định được function.
        {
            id: "CQ-AMBIGUOUS",
            category: "Business Rule",
            question: "Có quy tắc nào về khoảng thời gian giữa các mốc thời gian không?",
            targetField: "",
            answer: "ngày bắt đầu phải trước ngày kết thúc",
            status: "answered"
        },
        // Câu hỏi Yes/No không khớp mẫu cố định nào (không phải duy nhất/xóa/trùng/bắt buộc), NHƯNG
        // có targetField rõ ràng -> phải correlate và tạo fact được.
        {
            id: "CQ-CASE-SENSITIVE",
            category: "Validation",
            question: "Hệ thống có phân biệt chữ hoa và chữ thường đối với trường Tài khoản không?",
            targetField: "Tài khoản",
            answer: "Có",
            status: "answered"
        }
    ]
};

const knowledge = new RequirementKnowledgeMapper().map({ approvedArtifact });

// 1. Câu hỏi chung chung (không xác định được field) KHÔNG được lọt vào bất kỳ function nào —
// chỉ còn ở knowledge.businessRules cấp toàn cục (traceability), không nhân bản.
{
    const touchedFunctions = knowledge.functions.filter(func =>
        (func.businessRules ?? []).some(rule => rule.includes("ngày bắt đầu phải trước ngày kết thúc"))
    );
    assert.equal(touchedFunctions.length, 0, "câu hỏi chung chung không xác định được field không được bơm vào BẤT KỲ function nào (tránh nhân bản)");
    assert.ok(
        knowledge.businessRules.includes("ngày bắt đầu phải trước ngày kết thúc"),
        "câu trả lời vẫn phải được giữ lại ở cấp toàn cục để truy vết, chỉ là không tự sinh scenario mới"
    );
}

// 2. Câu hỏi Yes/No lạ (không khớp mẫu cố định) NHƯNG có targetField đúng -> vẫn phải tạo fact
// KHÔNG RỖNG và đúng function "Đăng nhập" (nơi có input "Tài khoản").
{
    const loginFunction = knowledge.functions.find(f => f.id === "LOGIN");
    assert.ok(loginFunction, "phải tìm thấy function LOGIN");
    assert.ok(
        loginFunction.validationRules.some(rule => /phân biệt chữ hoa/.test(rule)),
        "câu hỏi Yes/No lạ có targetField đúng vẫn phải tạo được fact và bơm vào đúng function — không được rơi mất như bug đã báo"
    );
    // Không lọt sang các function khác không liên quan.
    const otherFunctions = knowledge.functions.filter(f => f.id !== "LOGIN");
    assert.ok(
        otherFunctions.every(f => !(f.validationRules ?? []).some(rule => /phân biệt chữ hoa/.test(rule))),
        "fact của câu hỏi có targetField cụ thể không được lan sang function khác"
    );
}

// 3. Chạy hết pipeline thật -> không sinh testcase trùng nhau cho câu hỏi chung chung (đúng bug đã
// báo: cùng 1 nội dung xuất hiện lặp lại ở nhiều dòng testcase khác nhau).
{
    const recommendations = new ScenarioRecommendationEngine().generate(knowledge, requirement);
    const scenarios = new IntelligenceScenarioGenerator().generate(recommendations, requirement);
    const testCases = new TestCaseGenerator().generate(scenarios);
    const boundaryLikeCases = testCases.filter(testCase =>
        String(testCase.testScenario ?? testCase.scenario ?? "").includes("ngày bắt đầu phải trước ngày kết thúc") ||
        String(testCase.expectedResult ?? "").includes("ngày bắt đầu phải trước ngày kết thúc")
    );
    assert.ok(boundaryLikeCases.length <= 1, `câu hỏi chung chung không được nhân bản thành nhiều testcase giống nhau ở nhiều function, thấy ${boundaryLikeCases.length}`);
}

console.log("Clarification ambiguous-question no-duplication test: PASS");
