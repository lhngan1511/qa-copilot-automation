import AIAnalysisResult from "../models/AIAnalysisResult.js";

class AIResponseParser {

    static parse(response) {

        if (!response) {

            throw new Error("AI response is empty.");

        }

        let text = response.trim();

        /*
         * Loại bỏ ```json
         */

        text = text.replace(/```json/gi, "");

        text = text.replace(/```/g, "");

        /*
         * Tìm JSON đầu tiên
         */

        const start = text.indexOf("{");

        const end = text.lastIndexOf("}");

        if (start === -1 || end === -1) {

            throw new Error("Cannot find JSON object.");

        }

        text = text.substring(start, end + 1);

        let json;

        try {

            json = JSON.parse(text);

        }
        catch (error) {

            throw new Error("Invalid AI JSON.");

        }

        const result =
            new AIAnalysisResult();

        result.featureUnderstanding =
            json.featureUnderstanding || "";

        result.testFocus =
            json.testFocus || [];

        result.riskAreas =
            json.riskAreas || [];

        result.suggestedScenarios =
            json.suggestedScenarios || [];

        result.questions =
            json.questions || [];

        result.notes =
            json.notes || [];

        result.confidence =
            json.confidence || 0;

        return result;

    }

}

export default AIResponseParser;