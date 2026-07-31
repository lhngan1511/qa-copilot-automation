class TestCase {
    constructor() {
        /*
        =====================================================
         Identification
        =====================================================
        */

        this.id = "";

        this.scenarioId = "";

        this.moduleId = "";

        this.functionId = "";

        this.function = "";

        /*
        =====================================================
         Module / Feature
        =====================================================
        */

        this.module = "";

        this.feature = "";

        /*
        =====================================================
         Business Test Case
        =====================================================
        */

        this.title = "";

        this.testScenario = "";

        this.scenario = "";

        this.type = "";

        this.testObjective = "";

        this.objective = "";

        /*
        =====================================================
         Requirement Trace
        =====================================================
        */

        this.requirementReference = "";

        this.requirementReferences = [];

        this.coveredRules = [];

        this.businessRuleIds = [];

        this.sourceItem = null;

        this.ruleClassification = "";

        this.needsClarification = false;

        this.requiresRuntimeSupport = false;

        this.needsEnrichment = false;

        this.executable = false;

        this.postconditions = [];

        this.automationNotes = "";

        this.automationCandidate = false;

        /*
        =====================================================
         Preconditions
        =====================================================
        */

        this.preconditions = [];

        /*
        =====================================================
         Test Data
        =====================================================
        */

        this.testData = {
            requirement: "",

            value: ""
        };

        this.executionReadiness = "READY";

        /*
        =====================================================
         Execution Steps
        =====================================================

         Một testcase nghiệp vụ có thể chứa nhiều bước.

         Ví dụ:

         [
             {
                 order: 1,
                 action: "OPEN_FEATURE",
                 target: "Thêm thiết bị",
                 description: "Mở chức năng Thêm thiết bị"
             },
             {
                 order: 2,
                 action: "FILL",
                 target: "Mã thiết bị",
                 valueRef: "testData.inputs.maThietBi"
             }
         ]

        =====================================================
        */

        this.steps = [];

        /*
        =====================================================
         Automation Assertions
        =====================================================

         Assertions dùng để sinh các lệnh expect()
         trong Playwright.

         Một testcase có thể có nhiều assertions.

         Ví dụ:

         [
             {
                 type: "MESSAGE_VISIBLE",
                 target: "Thông báo thành công",
                 expected: "Thêm thiết bị thành công"
             },
             {
                 type: "DATA_VISIBLE",
                 target: "Danh sách thiết bị",
                 valueRef: "testData.inputs.maThietBi"
             }
         ]

        =====================================================
        */

        this.assertions = [];

        /*
        =====================================================
         Business Expected Result
        =====================================================

         expectedResult:
         - Kết quả nghiệp vụ tổng hợp
         - Phù hợp để xuất Excel / Markdown

         expectedResults:
         - Giữ lại để tương thích với framework hiện tại
         - Có thể chứa nhiều kết quả chi tiết
         - Sau này sẽ được chuyển thành assertions

        =====================================================
        */

        this.expectedResult = "";

        this.expectedResults = [];

        /*
        =====================================================
         Execution Result
        =====================================================
        */

        this.actualResult = "";

        this.status = "Not Tested";

        this.reviewStatus = "PENDING";

        /*
        =====================================================
         Priority / Severity
        =====================================================
        */

        this.priority = "MEDIUM";

        this.severity = "MEDIUM";

        /*
        =====================================================
         Automation Metadata
        =====================================================
        */

        this.automation = {
            candidate: false,

            framework: "Playwright",

            pageObject: "",

            locatorStrategy: "",

            locator: "",

            tags: []
        };

        /*
        =====================================================
         AI Intelligence
        =====================================================
        */

        this.intelligence = null;

        /*
        =====================================================
         Traceability
        =====================================================
        */

        this.traceability = {
            requirementId: "",

            scenarioId: ""
        };

        /*
        =====================================================
         Metadata
        =====================================================
        */

        this.source = "QA-Copilot";

        this.reason = "";

        this.riskCategory = "";

        this.createdBy = "QA-Copilot";

        this.version = "1.1";
    }
}

export default TestCase;
