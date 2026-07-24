import AIAnalysisResult from "../models/AIAnalysisResult.js";
import AIProviderFactory from "../providers/AIProviderFactory.js";


class AIAnalysisEngine {


    constructor() {


        this.aiProvider =
            AIProviderFactory.create();


    }





    async analyze(requirement) {


        const result =
            new AIAnalysisResult();



        try {


            const prompt =
                this.buildPrompt(
                    requirement
                );



            const aiResponse =
                await this.aiProvider.generate(
                    prompt
                );



            const parsedResult =
                this.parseAIResponse(
                    aiResponse
                );



            result.featureUnderstanding =
                parsedResult.featureUnderstanding
                ||
                requirement.feature;



            result.testFocus =
                parsedResult.testFocus
                ||
                [];



            result.riskAreas =
                parsedResult.riskAreas
                ||
                [];



            result.suggestedScenarios =
                parsedResult.suggestedScenarios
                ||
                [];



            result.questions =
                parsedResult.questions
                ||
                [];



            result.notes =
                parsedResult.notes
                ||
                [];



            result.confidence =
                parsedResult.confidence
                ||
                0.8;



            return result;



        }
        catch(error){



            console.error(
                "AI Analysis failed:",
                error.message
            );



            return this.fallbackAnalysis(
                requirement
            );


        }


    }






    buildPrompt(requirement){



        return `

Bạn là chuyên gia QA Senior.

Hãy phân tích yêu cầu phần mềm sau.

Chức năng:
${requirement.feature}


Mục đích:
${requirement.purpose}


Quy tắc nghiệp vụ:
${JSON.stringify(
    requirement.businessRules,
    null,
    2
)}


Trường hợp ngoại lệ:
${JSON.stringify(
    requirement.edgeCases,
    null,
    2
)}


Dữ liệu đầu vào:
${JSON.stringify(
    requirement.inputDefinitions,
    null,
    2
)}



Hãy sinh kết quả JSON duy nhất theo format:

{
 "featureUnderstanding":"",
 "testFocus":[],
 "riskAreas":[],
 "suggestedScenarios":[],
 "questions":[],
 "notes":[],
 "confidence":0.0
}


Yêu cầu:

- Không trả lời giải thích.
- Chỉ trả về JSON.
- Sinh testcase scenario phù hợp QA.
- Bao gồm Positive, Negative, Validation, Business Rule.


`;

    }








    parseAIResponse(response){


        try {


            let json =
                response;



            if(
                response.includes("```")
            ){


                json =
                    response
                    .replace(/```json/g,"")
                    .replace(/```/g,"")
                    .trim();


            }



            return JSON.parse(json);



        }
        catch(error){


            console.error(
                "Cannot parse AI JSON response"
            );


            return {};

        }


    }








    fallbackAnalysis(requirement){



        const result =
            new AIAnalysisResult();




        result.featureUnderstanding =
            requirement.feature;




        result.testFocus = [

            ...requirement.businessRules,

            ...requirement.edgeCases

        ];




        result.riskAreas = [

            ...requirement.businessRules,

            ...requirement.edgeCases

        ];




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



        result.confidence =
            0.5;



        return result;


    }



}


export default AIAnalysisEngine;