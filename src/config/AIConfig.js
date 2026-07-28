class AIConfig {


    static provider =
        process.env.AI_PROVIDER || "ollama";



    static openai = {

        apiKey:
            process.env.OPENAI_API_KEY || "",

        model:
            process.env.OPENAI_MODEL || "gpt-5.5"

    };



    static gemini = {

        apiKey:
            process.env.GEMINI_API_KEY || "",

        model:
            process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"

    };



    static claude = {

        apiKey:
            process.env.CLAUDE_API_KEY || "",

        model:
            process.env.CLAUDE_MODEL || "claude-sonnet-4"

    };



    static ollama = {

        host:
            process.env.OLLAMA_HOST 
            || 
            "http://localhost:11434",


        model:
            process.env.OLLAMA_MODEL 
            || 
            "qwen2.5:3b"

    };


}


export default AIConfig;
