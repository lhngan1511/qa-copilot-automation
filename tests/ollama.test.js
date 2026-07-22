import "dotenv/config";

import AIProviderFactory 
from "../src/providers/AIProviderFactory.js";


const provider =
    AIProviderFactory.create();



console.log(
    "Provider:",
    provider.constructor.name
);



const result =
    await provider.generate(
        "QA Copilot là gì? Trả lời ngắn gọn."
    );


console.log("\nAI Response:");
console.log(result);