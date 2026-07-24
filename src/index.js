import "dotenv/config";

import QACopilot from "./QACopilot.js";


const copilot =
    new QACopilot();



const result =
    await copilot.run(
        "./REQUIREMENTS/thiet-bi.md"
    );



console.log("\n====== FINAL RESULT ======");


console.log(
    JSON.stringify(
        result.testCases,
        null,
        2
    )
);