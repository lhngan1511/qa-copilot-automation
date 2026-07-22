class NegativeCaseAnalyzer {


    analyze(requirement, knowledge) {


        if(
            !requirement ||
            !knowledge
        ){

            return;

        }


        this.analyzeBusinessRules(
            knowledge
        );


        this.analyzeDataIntegrity(
            knowledge
        );


        this.analyzeBoundary(
            knowledge
        );


        this.analyzeEdgeCases(
            requirement,
            knowledge
        );


    }





    analyzeBusinessRules(knowledge){


        knowledge.validationRules.forEach(
            rule => {


                const lower =
                    rule.toLowerCase();



                if(
                    lower.includes("không") ||
                    lower.includes("không được")
                ){

                    knowledge.negativeCases.push(
                        rule
                    );

                }


            }
        );


    }






    analyzeDataIntegrity(knowledge){


        knowledge.dataIntegrityCases.forEach(
            item => {


                knowledge.negativeCases.push(
                    item
                );


            }
        );


    }






    analyzeBoundary(knowledge){


        knowledge.boundaryCases.forEach(
            item => {


                knowledge.negativeCases.push(
                    item
                );


            }
        );


    }






    analyzeEdgeCases(
        requirement,
        knowledge
    ){


        const edgeCases =
            requirement.edgeCases || [];



        edgeCases.forEach(
            item => {


                knowledge.negativeCases.push(
                    item
                );


            }
        );


    }


}


export default NegativeCaseAnalyzer;