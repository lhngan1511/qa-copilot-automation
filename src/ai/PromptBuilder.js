class PromptBuilder {

    /**
     * Build Prompt Object
     * dùng cho Requirement Analysis
     */
    static buildRequirementAnalysisPrompt(requirement) {

        return {

            role:
                "Senior QA Engineer",

            task:
                "Requirement Analysis",

            instruction: [

                "Bạn là chuyên gia QA Manual và Automation.",

                "Đọc Requirement.",

                "Phân tích Requirement.",

                "Không giải thích.",

                "Không markdown.",

                "Chỉ trả về JSON hợp lệ."

            ],

            input: {

                feature:
                    requirement.feature,

                purpose:
                    requirement.purpose,

                businessRules:
                    requirement.businessRules,

                expectedResults:
                    requirement.expectedResults,

                edgeCases:
                    requirement.edgeCases,

                inputDefinitions:
                    requirement.inputDefinitions

            },

            outputSchema: {

                featureUnderstanding:
                    "string",

                riskAreas:
                    [

                        "string"

                    ],

                suggestedScenarios:
                    [

                        "string"

                    ],

                questions:
                    [

                        "string"

                    ],

                notes:
                    [

                        "string"

                    ],

                confidence:
                    "number"

            }

        };

    }

}

export default PromptBuilder;