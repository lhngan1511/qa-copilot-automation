class RequirementIntelligenceSummary {


    constructor(){


        // ==========================
        // Requirement Information
        // ==========================

        // Chức năng

        this.feature = "";



        // ==========================
        // Intelligence Statistics
        // ==========================

        // Tổng số rule validation

        this.totalValidationRules = 0;



        // Tổng số positive case

        this.totalPositiveCases = 0;



        // Tổng số negative case

        this.totalNegativeCases = 0;



        // Tổng số boundary case

        this.totalBoundaryCases = 0;



        // Tổng số security case

        this.totalSecurityCases = 0;



        // Tổng số permission case

        this.totalPermissionCases = 0;



        // Tổng số data integrity case

        this.totalDataIntegrityCases = 0;



        // ==========================
        // Risk Assessment
        // ==========================

        // LOW / MEDIUM / HIGH

        this.riskLevel = "LOW";



        // ==========================
        // Recommendation
        // ==========================

        // Nhóm kiểm thử đề xuất

        this.recommendedTesting = [];



        // Số lượng scenario dự kiến

        this.recommendedScenarioCount = 0;



        // ==========================
        // AI Metadata
        // ==========================

        this.confidence = 0;


        this.questions = [];



        // Version

        this.version = "1.0";


    }


}


export default RequirementIntelligenceSummary;