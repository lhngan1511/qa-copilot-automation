class RecommendedScenario {


    constructor({

        id = "",

        title = "",


        // Module / Feature Context

        module = "",

        feature = "",


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


        /*
            Module cấp cao

            Ví dụ:
            Thiết bị
        */

        this.module = module;



        /*
            Chức năng thực tế

            Ví dụ:
            Thêm thiết bị
        */

        this.feature = feature;



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