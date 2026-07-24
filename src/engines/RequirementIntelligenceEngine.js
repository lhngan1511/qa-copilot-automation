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


        if (!analyzer) {

            return;

        }


        this.analyzers.push(analyzer);


    }




    analyze(requirement) {


        const knowledge =
            new RequirementKnowledge();



        if (requirement.feature) {

            knowledge.feature =
                requirement.feature;

        }



        this.analyzers.forEach(analyzer => {


            if (
                analyzer
                &&
                typeof analyzer.analyze === "function"
            ) {


                analyzer.analyze(
                    requirement,
                    knowledge
                );


            }


        });



        knowledge.confidence =
            this.calculateConfidence(
                knowledge
            );



        return knowledge;


    }




    calculateConfidence(knowledge) {


        let score = 0;



        if (
            knowledge.validationRules.length > 0
        ) {

            score += 15;

        }



        if (
            knowledge.riskAreas.length > 0
        ) {

            score += 15;

        }



        if (
            knowledge.boundaryCases.length > 0
        ) {

            score += 15;

        }



        if (
            knowledge.negativeCases.length > 0
        ) {

            score += 15;

        }



        if (
            knowledge.positiveCases.length > 0
        ) {

            score += 15;

        }



        if (
            knowledge.securityCases.length > 0
        ) {

            score += 10;

        }



        if (
            knowledge.permissionCases.length > 0
        ) {

            score += 15;

        }



        if (
            knowledge.dataIntegrityCases.length > 0
        ) {

            score += 10;

        }



        return Math.min(
            score,
            100
        );


    }


}


export default RequirementIntelligenceEngine;