import "dotenv/config";

import OpenAIProvider 
from "../src/providers/OpenAIProvider.js";


const provider =
    new OpenAIProvider();


const result =
    await provider.generate(
        "Trả lời ngắn gọn: QA Copilot là gì?"
    );


console.log(
    result
);