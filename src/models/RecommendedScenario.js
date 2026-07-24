class RecommendedScenario {


    constructor({

        id = "",

        title = "",

        type = "",

        priority = "",

        reason = "",

        source = "",


        // Traceability

        requirementReference = "",

        riskCategory = ""


    } = {}) {



        // ==========================
        // Identity
        // ==========================

        this.id = id;



        // ==========================
        // Scenario Information
        // ==========================

        this.title = title;



        // POSITIVE
        // NEGATIVE
        // BOUNDARY
        // BUSINESS_RULE
        // SECURITY
        // PERMISSION
        // DATA_INTEGRITY
        // PERFORMANCE

        this.type = type;



        // HIGH / MEDIUM / LOW

        this.priority = priority;



        // ==========================
        // Intelligence Reason
        // ==========================

        this.reason = reason;



        // Rule Engine / AI / Intelligence Engine

        this.source = source;



        // ==========================
        // Traceability
        // ==========================

        // Requirement tạo ra scenario

        this.requirementReference =
            requirementReference;



        // ==========================
        // Risk Classification
        // ==========================

        this.riskCategory =
            riskCategory || type;



        // ==========================
        // Automation Metadata
        // ==========================

        this.automationCandidate = false;



        // ==========================
        // Version
        // ==========================

        this.version = "1.0";


    }


}


export default RecommendedScenario;