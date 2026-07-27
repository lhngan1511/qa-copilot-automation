class RecommendedScenario {
    constructor({
        id = "",

        title = "",

        // Module / Feature Context

        module = "",

        feature = "",

        // Scenario Classification

        type = "",

        priority = "MEDIUM",

        severity = "MEDIUM",

        // Intelligence Information

        reason = "",

        source = "",

        // Traceability

        requirementReference = "",

        riskCategory = "",

        // Test Preparation

        preconditions = [],

        inputDefinitions = [],

        // Generated Test Data

        testData = null,

        // Scenario Execution

        steps = [],

        // Expected Results

        expectedResult = "",

        expectedResults = [],

        // Automation Assertions

        assertions = [],

        // Automation

        automationCandidate = false
    } = {}) {
        /*
        =====================================================
         Identity
        =====================================================
        */

        this.id = id;

        /*
        =====================================================
         Module / Feature
        =====================================================
        */

        this.module = module;

        this.feature = feature;

        /*
        =====================================================
         Scenario Information
        =====================================================
        */

        this.title = title;

        this.testScenario = title;

        /*
        =====================================================
         Scenario Classification
        =====================================================
        */

        this.type = type;

        this.priority = priority;

        this.severity = severity;

        /*
        =====================================================
         Intelligence Information
        =====================================================
        */

        this.reason = reason;

        this.source = source;

        /*
        =====================================================
         Traceability
        =====================================================
        */

        this.requirementReference = requirementReference;

        /*
        =====================================================
         Risk Classification
        =====================================================
        */

        this.riskCategory = riskCategory || type;

        /*
        =====================================================
         Test Preparation
        =====================================================
        */

        this.preconditions = Array.isArray(preconditions) ? preconditions : [];

        this.inputDefinitions = Array.isArray(inputDefinitions) ? inputDefinitions : [];

        /*
        =====================================================
         Test Data
        =====================================================
        */

        this.testData =
            testData && typeof testData === "object"
                ? testData
                : {
                      valid: {},

                      invalid: {}
                  };

        /*
        =====================================================
         Execution Steps
        =====================================================
        */

        this.steps = Array.isArray(steps) ? steps : [];

        /*
        =====================================================
         Expected Results
        =====================================================
        */

        this.expectedResult = expectedResult;

        this.expectedResults = Array.isArray(expectedResults) ? expectedResults : [];

        /*
        =====================================================
         Automation Assertions
        =====================================================
        */

        this.assertions = Array.isArray(assertions) ? assertions : [];

        /*
        =====================================================
         Automation Metadata
        =====================================================
        */

        this.automationCandidate = Boolean(automationCandidate);

        /*
        =====================================================
         Version
        =====================================================
        */

        this.version = "1.1";
    }
}

export default RecommendedScenario;
