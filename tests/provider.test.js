import "dotenv/config";

import AIProviderFactory 
from "../src/providers/AIProviderFactory.js";


const provider =
    AIProviderFactory.create();


console.log(
    "Provider:",
    provider.constructor.name
);