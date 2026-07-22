import AIProvider from "./AIProvider.js";


class OllamaProvider extends AIProvider {


    constructor(config = {}) {

        super();


        this.host =
            config.host ||
            process.env.OLLAMA_HOST ||
            "http://localhost:11434";


        this.model =
            config.model ||
            process.env.OLLAMA_MODEL ||
            "qwen2.5:7b";

    }





    async generate(prompt) {


        try {


            const response =
                await fetch(
                    `${this.host}/api/generate`,
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },


                        body:
                            JSON.stringify({

                                model:
                                    this.model,


                                prompt,


                                stream:false

                            })

                    }
                );



            if(!response.ok){


                throw new Error(
                    `Ollama error: ${response.status}`
                );


            }



            const data =
                await response.json();



            return data.response;



        }
        catch(error){


            console.error(
                "Ollama Provider Error:",
                error.message
            );


            throw error;


        }


    }


}


export default OllamaProvider;