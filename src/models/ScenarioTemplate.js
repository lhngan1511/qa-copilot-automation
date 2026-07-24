class ScenarioTemplate {

    constructor() {

        /*
         * ID Template
         * TMP001
         */
        this.id = "";

        /*
         * Chức năng
         */
        this.feature = "";

        /*
         * Tên Scenario
         */
        this.title = "";

        /*
         * Positive
         * Negative
         * Boundary
         * Security
         * Permission
         * DataIntegrity
         */
        this.type = "";

        /*
         * Business Rule liên quan
         */
        this.businessRule = "";

        /*
         * Requirement Reference
         */
        this.requirementReference = "";

        /*
         * Lý do sinh Scenario
         */
        this.reason = "";

        /*
         * Nhóm rủi ro
         */
        this.riskCategory = "";

        /*
         * Risk Level
         * Low
         * Medium
         * High
         * Critical
         */
        this.riskLevel = "";

        /*
         * Priority
         */
        this.priority = "";

        /*
         * Điều kiện trước
         */
        this.preconditions = [];

        /*
         * Input cần chuẩn bị
         */
        this.inputDefinitions = [];

        /*
         * Test Data gợi ý
         */
        this.testData = [];

        /*
         * Validation Rules
         */
        this.validationRules = [];

        /*
         * Automation Candidate
         */
        this.automationCandidate = true;

        /*
         * Playwright Metadata
         */
        this.automation = {

            page: "",

            action: "",

            locatorGroup: "",

            assertion: ""

        };

    }

}

export default ScenarioTemplate;