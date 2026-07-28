import "dotenv/config";

import QACopilot from "../src/QACopilot.js";


async function runTest() {

    console.log("\n=================================");
    console.log(" QA COPILOT PIPELINE TEST");
    console.log("=================================\n");


    const qaCopilot =
        new QACopilot();


    const result =
        await qaCopilot.run(
            "./requirements/thiet-bi.md"
        );


    console.log("\n=================================");
    console.log(" PIPELINE SUMMARY");
    console.log("=================================\n");


    console.log("RAW RESULT:");
    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );


    if (!result) {

        console.log(
            "❌ Pipeline returned empty result"
        );

        return;

    }

    console.log("AI Analysis Status:", result.aiAnalysis?.analysisStatus);
    console.log("AI Analysis Source:", result.aiAnalysis?.analysisSource);
    console.log("AI Feature Understanding:", result.aiAnalysis?.featureUnderstanding);
    console.log("AI Questions:", result.aiAnalysis?.questions);
    console.log(
        "AI Suggested Scenario Count:",
        result.aiAnalysis?.suggestedScenarios?.length ?? 0
    );


    if (result.requirement) {

        console.log("\nFeature:");
        console.log(
            result.requirement.feature
        );


        console.log("\nPurpose:");
        console.log(
            result.requirement.purpose
        );

    }


    if (result.scenarios) {

        console.log("\nScenarios:");
        console.log(
            result.scenarios.length
        );

    }


    if (result.testCases) {

        console.log("\nTestCases:");
        console.log(
            result.testCases.length
        );

    }


    console.log("\nOutput:");

    console.log(
        result.output
    );


    console.log("\n=================================");
    console.log(" PIPELINE TEST COMPLETED");
    console.log("=================================\n");

}


runTest()
    .catch(error => {

        console.error(
            "\n❌ PIPELINE ERROR:"
        );

        console.error(error);

    });
