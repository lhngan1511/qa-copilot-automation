class RequirementKnowledge {

    constructor() {

        // Những quy tắc kiểm tra suy luận được
        this.validationRules = [];

        // Những rủi ro nghiệp vụ
        this.riskAreas = [];

        // Boundary cần kiểm tra
        this.boundaryCases = [];

        // Negative cần kiểm tra
        this.negativeCases = [];

        // Positive cần kiểm tra
        this.positiveCases = [];

        // Security
        this.securityCases = [];

        // Permission
        this.permissionCases = [];

        // Data Integrity
        this.dataIntegrityCases = [];

        // Scenario AI gợi ý
        this.suggestedScenarios = [];

        // Thiếu thông tin gì?
        this.questions = [];

        // Độ tin cậy
        this.confidence = 0;

    }

}

export default RequirementKnowledge;