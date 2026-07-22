import RequirementIntelligenceSummary 
from "../models/RequirementIntelligenceSummary.js";



class IntelligenceSummaryGenerator {



    generate(requirement, knowledge){


        const summary =
            new RequirementIntelligenceSummary();



        summary.feature =
            requirement.feature || "";



        summary.totalValidationRules =
            knowledge.validationRules.length;



        summary.totalPositiveCases =
            knowledge.positiveCases.length;



        summary.totalNegativeCases =
            knowledge.negativeCases.length;



        summary.totalBoundaryCases =
            knowledge.boundaryCases.length;



        summary.totalSecurityCases =
            knowledge.securityCases.length;



        summary.totalPermissionCases =
            knowledge.permissionCases.length;



        summary.totalDataIntegrityCases =
            knowledge.dataIntegrityCases.length;



        this.calculateRisk(
            summary
        );



        this.suggestTesting(
            summary
        );



        summary.recommendedScenarioCount =
            this.calculateScenarioCount(
                summary
            );



        return summary;

    }







    calculateRisk(summary){


        let score = 0;



        score += summary.totalNegativeCases;

        score += summary.totalBoundaryCases;

        score += summary.totalSecurityCases * 2;

        score += summary.totalPermissionCases * 2;



        if(score >= 15){

            summary.riskLevel = "HIGH";

        }
        else if(score >= 7){

            summary.riskLevel = "MEDIUM";

        }
        else {

            summary.riskLevel = "LOW";

        }


    }







    suggestTesting(summary){


        if(summary.totalValidationRules){

            summary.recommendedTesting.push(
                "Validation Testing"
            );

        }



        if(summary.totalBoundaryCases){

            summary.recommendedTesting.push(
                "Boundary Testing"
            );

        }



        if(summary.totalPermissionCases){

            summary.recommendedTesting.push(
                "Permission Testing"
            );

        }



        if(summary.totalSecurityCases){

            summary.recommendedTesting.push(
                "Security Testing"
            );

        }


    }







    calculateScenarioCount(summary){


        return (

            summary.totalPositiveCases +

            summary.totalNegativeCases +

            summary.totalBoundaryCases +

            summary.totalPermissionCases +

            summary.totalSecurityCases

        );


    }



}



export default IntelligenceSummaryGenerator;