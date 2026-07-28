import "dotenv/config";

import QACopilot from "./QACopilot.js";

const copilot =
    new QACopilot();

const requirementFile =
    process.argv[2]?.trim();

if (!requirementFile) {
    console.error(
        [
            "Usage:",
            "node src/index.js <requirement-file>",
            "",
            "Example:",
            "node src/index.js requirements/thiet-bi.md"
        ].join("\n")
    );

    process.exitCode = 1;
}
else {
    const result =
        await copilot.run(
            requirementFile
        );

    console.log("\n====== FINAL RESULT ======");

    console.log(
        JSON.stringify(
            result.testCases,
            null,
            2
        )
    );
}
