import OpenAI from "openai";
import AIProvider from "./AIProvider.js";


class OpenAIProvider extends AIProvider {


    constructor(config = {}) {

        super();


        this.apiKey =
            config.apiKey ||
            process.env.OPENAI_API_KEY;


        this.model =
            config.model ||
            process.env.OPENAI_MODEL ||
            "gpt-5.5-mini";



        if(!this.apiKey){

            throw new Error(
                "OPENAI_API_KEY is missing"
            );

        }



        this.client =
            new OpenAI({

                apiKey:
                    this.apiKey

            });


    }




    async generate(prompt){


        try {


            const response =
                await this.client.responses.create({

                    model:
                        this.model,


                    input:
                        prompt

                });



            return response.output_text;



        }
        catch(error){


            console.error(
                "OpenAI API Error:",
                error.message
            );


            throw error;


        }


    }


}


export default OpenAIProvider;