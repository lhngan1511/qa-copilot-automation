class PositiveCaseAnalyzer {


    analyze(requirement, knowledge) {


        if(
            !requirement ||
            !knowledge
        ){

            return;

        }


        this.analyzeFeature(
            requirement,
            knowledge
        );


        this.analyzeExpectedResults(
            requirement,
            knowledge
        );


    }






    analyzeFeature(
        requirement,
        knowledge
    ){


        if(
            requirement.feature
        ){

            knowledge.positiveCases.push(
                `${requirement.feature} với dữ liệu hợp lệ`
            );

        }


    }







    analyzeExpectedResults(
        requirement,
        knowledge
    ){


        const results =
            requirement.expectedResults || [];



        results.forEach(
            result => {


                knowledge.positiveCases.push(
                    result
                );


            }
        );


    }


}


export default PositiveCaseAnalyzer;