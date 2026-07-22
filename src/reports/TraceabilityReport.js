class TraceabilityReport {


    constructor(){

        this.feature = "";

        this.totalRequirements = 0;

        this.coveredRequirements = 0;

        this.coveragePercentage = 0;

        this.items = [];

    }




    generate(
        feature,
        scenarios
    ){


        this.feature = feature || "";

        this.items = [];



        if(
            !scenarios ||
            !Array.isArray(scenarios)
        ){

            return this.buildResult();

        }



        const requirementMap =
            new Map();



        scenarios.forEach(
            scenario => {


                const requirement =
                    scenario.requirementReference
                    ||
                    scenario.title
                    ||
                    "";



                if(requirement){

                    if(!requirementMap.has(requirement)){

                        requirementMap.set(
                            requirement,
                            []
                        );

                    }


                    requirementMap
                        .get(requirement)
                        .push(
                            scenario
                        );

                }


            }
        );





        requirementMap.forEach(
            (
                scenarioList,
                requirement
            ) => {


                const firstScenario =
                    scenarioList[0];



                this.items.push({

                    requirement,


                    covered:true,


                    scenarioId:
                    firstScenario.id,


                    scenarioCount:
                    scenarioList.length,


                    riskCategory:
                    firstScenario.riskCategory || "",


                    source:
                    firstScenario.source || ""


                });


            }
        );





        this.totalRequirements =
            this.items.length;



        this.coveredRequirements =
            this.items.filter(
                item =>
                item.covered
            ).length;



        this.coveragePercentage =
            this.totalRequirements === 0
            ?
            0
            :
            Math.round(
                (
                    this.coveredRequirements
                    /
                    this.totalRequirements
                )
                *
                100
            );



        return this.buildResult();


    }





    buildResult(){


        return {

            feature:
            this.feature,


            totalRequirements:
            this.totalRequirements,


            coveredRequirements:
            this.coveredRequirements,


            coveragePercentage:
            this.coveragePercentage,


            items:
            this.items

        };


    }


}


export default TraceabilityReport;