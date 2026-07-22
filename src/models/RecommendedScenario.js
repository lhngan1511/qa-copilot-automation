class RecommendedScenario {


    constructor({

        id = "",

        title = "",

        type = "",

        priority = "",

        reason = "",

        source = "",


        // Sprint 15.5
        requirementReference = "",

        riskCategory = ""


    } = {}) {



        // Scenario identity

        this.id = id;



        // Nội dung scenario

        this.title = title;



        // POSITIVE
        // NEGATIVE
        // BOUNDARY
        // SECURITY
        // PERMISSION
        // DATA_INTEGRITY

        this.type = type;



        // HIGH / MEDIUM / LOW

        this.priority = priority;



        // Lý do sinh testcase

        this.reason = reason;



        // Nguồn sinh

        this.source = source;



        // Sprint 15.5 Traceability

        // Requirement nào tạo ra scenario này

        this.requirementReference =
            requirementReference;



        // Nhóm rủi ro

        this.riskCategory =
            riskCategory || type;


    }


}


export default RecommendedScenario;