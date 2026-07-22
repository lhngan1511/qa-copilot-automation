class RecommendedScenario {


    constructor({

        id = "",
        title = "",
        type = "",
        priority = "",
        reason = "",
        source = ""

    } = {}) {


        this.id = id;

        this.title = title;

        this.type = type;

        this.priority = priority;

        this.reason = reason;

        this.source = source;


    }


}


export default RecommendedScenario;