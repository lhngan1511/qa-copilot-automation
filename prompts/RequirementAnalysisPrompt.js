class RequirementAnalysisPrompt {


    build(requirement){


        return `

Bạn là chuyên gia QA.

Hãy phân tích yêu cầu sau và sinh kết quả JSON.

Yêu cầu:

Feature:
${requirement.feature}


Mục đích:
${requirement.purpose}


Quy tắc nghiệp vụ:
${JSON.stringify(requirement.businessRules)}


Trường hợp ngoại lệ:
${JSON.stringify(requirement.edgeCases)}


Hãy trả về JSON đúng format:

{
 "featureUnderstanding":"",
 "testFocus":[],
 "riskAreas":[],
 "suggestedScenarios":[],
 "questions":[]
}

Chỉ trả về JSON, không giải thích.

`;

    }


}


export default RequirementAnalysisPrompt;