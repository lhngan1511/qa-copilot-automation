import AIAnalysisResult from "../models/AIAnalysisResult.js";


class AIAnalysisEngine {


    constructor(){

    }



    analyze(requirement){


        const result =
            new AIAnalysisResult();



        /*
            Feature Understanding

            Hiện tại lấy trực tiếp từ RequirementObject.
            Sau này thay bằng AI Prompt.
        */

        result.featureUnderstanding =
            requirement.purpose
            ||
            requirement.feature;



        /*
            Test Focus

            Lấy từ các khu vực nghiệp vụ.
        */

        result.testFocus = [

            ...requirement.businessRules,

            ...requirement.edgeCases

        ];



        /*
            Risk Areas

            Hiện tại lấy từ:
            - Business Rules
            - Edge Cases
        */

        result.riskAreas = [

            ...requirement.businessRules,

            ...requirement.edgeCases

        ];



        /*
            Suggested Scenarios

            Mock AI sinh scenario.
        */

        result.suggestedScenarios = [

            `${requirement.feature} thành công`,

            ...requirement.edgeCases.map(
                item =>
                `${requirement.feature} - ${item}`
            )

        ];



        result.questions =
            requirement.questions;



        result.notes =
            requirement.notes;



        /*
            Confidence giả lập

            Sau này lấy từ AI Provider.
        */

        result.confidence = 0.8;



        return result;


    }


}


export default AIAnalysisEngine;