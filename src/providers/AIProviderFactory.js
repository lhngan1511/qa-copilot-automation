import AIConfig from "../config/AIConfig.js";

import OpenAIProvider from "./OpenAIProvider.js";
import GeminiProvider from "./GeminiProvider.js";
import ClaudeProvider from "./ClaudeProvider.js";
import OllamaProvider from "./OllamaProvider.js";


class AIProviderFactory {


    static create() {


        const provider =
            AIConfig.provider.toLowerCase();



        switch(provider) {


            case "openai":

                return new OpenAIProvider(
                    AIConfig.openai
                );



            case "gemini":

                return new GeminiProvider(
                    AIConfig.gemini
                );



            case "claude":

                return new ClaudeProvider(
                    AIConfig.claude
                );



            case "ollama":

                return new OllamaProvider(
                    AIConfig.ollama
                );



            default:

                throw new Error(
                    `Unsupported AI Provider: ${provider}`
                );


        }


    }


}


export default AIProviderFactory;