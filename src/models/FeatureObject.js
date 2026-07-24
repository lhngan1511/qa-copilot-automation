class FeatureObject {


    constructor() {


        // =====================================
        // Identity
        // =====================================

        this.id = "";

        this.name = "";



        // =====================================
        // Basic Information
        // =====================================

        this.description = "";



        // =====================================
        // Preconditions
        // =====================================

        this.preconditions = [];



        // =====================================
        // Main Flow
        // =====================================

        this.flow = [];



        // =====================================
        // Business Rules
        // =====================================

        this.businessRules = [];



        // =====================================
        // Expected Results
        // =====================================

        this.expectedResults = [];



        // =====================================
        // Exceptions / Negative Cases
        // =====================================

        this.exceptions = [];



        // =====================================
        // Future Extension
        // =====================================

        this.testScenarios = [];

        this.testCases = [];


    }



    addPrecondition(condition) {

        if (
            condition &&
            !this.preconditions.includes(condition)
        ) {

            this.preconditions.push(condition);

        }

    }



    addFlow(step) {

        if (
            step &&
            !this.flow.includes(step)
        ) {

            this.flow.push(step);

        }

    }



    addBusinessRule(rule) {

        if (
            rule &&
            !this.businessRules.includes(rule)
        ) {

            this.businessRules.push(rule);

        }

    }



    addExpectedResult(result) {

        if (
            result &&
            !this.expectedResults.includes(result)
        ) {

            this.expectedResults.push(result);

        }

    }



    addException(exception) {

        if (
            exception &&
            !this.exceptions.includes(exception)
        ) {

            this.exceptions.push(exception);

        }

    }


}

export default FeatureObject;