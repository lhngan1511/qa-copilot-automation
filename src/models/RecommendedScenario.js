class RecommendedScenario {
    constructor({
        id = "",

        title = "",

        description = "",

        // Module / Feature Context

        module = "",

        feature = "",

        moduleId = "",

        functionId = "",

        functionName = "",

        // Scenario Classification

        type = "",

        priority = "MEDIUM",

        severity = "MEDIUM",

        // Intelligence Information

        reason = "",

        source = "",

        // Traceability

        requirementReference = "",

        requirementReferences = [],

        coveredRules = [],

        sourceItems = [],

        sourceReferences = [],

        clarificationAnswers = [],

        riskReason = "",

        riskCategory = "",

        // Test Preparation

        preconditions = [],

        inputDefinitions = [],

        // Generated Test Data

        testData = null,

        testDataHints = [],

        // Scenario Execution

        steps = [],

        operation = "",

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

        this.moduleId = moduleId;

        this.functionId = functionId;

        this.function = functionName || feature;

        /*
        =====================================================
         Scenario Information
        =====================================================
        */

        this.title = title;

        this.description = description;

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

        this.requirementReferences = Array.isArray(requirementReferences)
            ? [...requirementReferences]
            : [];

        this.coveredRules = Array.isArray(coveredRules) ? [...coveredRules] : [];

        this.sourceItems = Array.isArray(sourceItems) ? [...sourceItems] : [];

        this.sourceReferences = Array.isArray(sourceReferences) ? [...sourceReferences] : [];

        this.clarificationAnswers = Array.isArray(clarificationAnswers)
            ? clarificationAnswers.map(item =>
                  item && typeof item === "object" ? { ...item } : item
              )
            : [];

        this.riskReason = riskReason;

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

        this.testDataHints = Array.isArray(testDataHints) ? [...testDataHints] : [];

        /*
        =====================================================
         Execution Steps
        =====================================================
        */

        this.steps = Array.isArray(steps) ? steps : [];

        this.operation = typeof operation === "string" ? operation.trim() : "";

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
