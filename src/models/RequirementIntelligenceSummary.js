class RequirementIntelligenceSummary {


    constructor(){

        // Chức năng
        this.feature = "";


        // Tổng số rule validation
        this.totalValidationRules = 0;


        // Tổng số case thành công
        this.totalPositiveCases = 0;


        // Tổng số case lỗi
        this.totalNegativeCases = 0;


        // Tổng số boundary
        this.totalBoundaryCases = 0;


        // Tổng số security case
        this.totalSecurityCases = 0;


        // Tổng số permission case
        this.totalPermissionCases = 0;


        // Tổng số data integrity case
        this.totalDataIntegrityCases = 0;


        // Mức độ rủi ro
        // LOW / MEDIUM / HIGH
        this.riskLevel = "LOW";


        // Các nhóm test đề xuất
        this.recommendedTesting = [];


        // Số lượng scenario dự kiến
        this.recommendedScenarioCount = 0;


    }


}


export default RequirementIntelligenceSummary;