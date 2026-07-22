import RequirementKnowledge from "../models/RequirementKnowledge.js";
import BusinessRuleAnalyzer from "../analyzers/BusinessRuleAnalyzer.js";
import InputAnalyzer from "../analyzers/InputAnalyzer.js";
import BoundaryAnalyzer from "../analyzers/BoundaryAnalyzer.js";
import NegativeCaseAnalyzer from "../analyzers/NegativeCaseAnalyzer.js";
import PositiveCaseAnalyzer from "../analyzers/PositiveCaseAnalyzer.js";
import SecurityCaseAnalyzer from "../analyzers/SecurityCaseAnalyzer.js";
import PermissionCaseAnalyzer from "../analyzers/PermissionCaseAnalyzer.js";


class RequirementIntelligenceEngine {


    constructor() {

        this.analyzers = [];


        this.register(
            new BusinessRuleAnalyzer()
        );


        this.register(
            new InputAnalyzer()
        );

        this.register(
            new BoundaryAnalyzer()
        );

        this.register(
            new NegativeCaseAnalyzer()
        );

        this.register(
            new PositiveCaseAnalyzer()
        );

        this.register(
            new SecurityCaseAnalyzer()
        );

        this.register(
            new PermissionCaseAnalyzer()
        );
    }



    register(analyzer) {

        this.analyzers.push(analyzer);

    }



    analyze(requirement) {


        const knowledge =
            new RequirementKnowledge();



        this.analyzers.forEach(
            analyzer => {


                analyzer.analyze(
                    requirement,
                    knowledge
                );


            }
        );


        return knowledge;


    }


}


export default RequirementIntelligenceEngine;