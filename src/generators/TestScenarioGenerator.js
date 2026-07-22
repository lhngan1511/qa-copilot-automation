import TestScenario from "../models/TestScenario.js";


class TestScenarioGenerator {


    constructor(){

        this.counter = 1;

    }



    generate(aiResult){


        const scenarios = [];



        if(
            !aiResult ||
            !aiResult.suggestedScenarios
        ){

            return scenarios;

        }



        aiResult.suggestedScenarios.forEach(
            item => {


                const scenario =
                    new TestScenario();



                scenario.id =
                    this.generateId();



                scenario.feature =
                    aiResult.featureUnderstanding;



                scenario.title =
                    item;



                scenario.type =
                    this.detectType(item);



                scenario.riskAreas =
                    aiResult.riskAreas;



                scenario.expectedResults = [

                    "Hệ thống xử lý đúng theo yêu cầu"

                ];



                scenario.severity =
                    this.detectSeverity(
                        scenario.type
                    );



                scenario.priority =
                    "Medium";



                scenario.automationCandidate =
                    true;



                scenarios.push(
                    scenario
                );


            }
        );


        return scenarios;


    }





    generateId(){


        const id =
            String(this.counter)
            .padStart(3,"0");


        this.counter++;


        return `SC${id}`;


    }





    detectType(title){


        const negativeKeywords = [

            "trùng",

            "thiếu",

            "không",

            "sai",

            "tồn tại"

        ];



        const lower =
            title.toLowerCase();



        const isNegative =
            negativeKeywords.some(
                keyword =>
                lower.includes(keyword)
            );



        return isNegative
            ? "NEGATIVE"
            : "POSITIVE";


    }





    detectSeverity(type){


        if(type === "NEGATIVE"){

            return "High";

        }


        return "Medium";


    }


}


export default TestScenarioGenerator;