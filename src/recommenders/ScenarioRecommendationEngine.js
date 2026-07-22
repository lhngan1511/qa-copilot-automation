import RecommendedScenario from "../models/RecommendedScenario.js";


class ScenarioRecommendationEngine {


    constructor(){

        this.counter = 1;

    }



    generate(knowledge){


        if(!knowledge){

            return [];

        }



        const scenarios = [];



        this.generateFromList(
            knowledge.positiveCases,
            "POSITIVE",
            "MEDIUM",
            scenarios
        );



        this.generateFromList(
            knowledge.negativeCases,
            "NEGATIVE",
            "HIGH",
            scenarios
        );



        this.generateFromList(
            knowledge.boundaryCases,
            "BOUNDARY",
            "MEDIUM",
            scenarios
        );



        this.generateFromList(
            knowledge.securityCases,
            "SECURITY",
            "HIGH",
            scenarios
        );



        this.generateFromList(
            knowledge.permissionCases,
            "PERMISSION",
            "HIGH",
            scenarios
        );



        this.generateFromList(
            knowledge.dataIntegrityCases,
            "DATA_INTEGRITY",
            "HIGH",
            scenarios
        );



        return scenarios;


    }






    generateFromList(
        list,
        type,
        priority,
        scenarios
    ){



        if(
            !list ||
            list.length === 0
        ){

            return;

        }





        list.forEach(
            item => {


                const scenario =
                    new RecommendedScenario({

                        id:
                        `SC${String(this.counter++)
                        .padStart(3,"0")}`,



                        title:item,



                        type,



                        priority,



                        reason:
                        `${type} risk detected`,



                        source:
                        "Requirement Intelligence",



                        // Sprint 15.5 Traceability

                        requirementReference:
                        item,



                        riskCategory:
                        type


                    });



                scenarios.push(
                    scenario
                );


            }
        );


    }


}


export default ScenarioRecommendationEngine;