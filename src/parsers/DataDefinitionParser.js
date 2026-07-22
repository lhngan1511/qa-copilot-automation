import InputDefinition from "../models/InputDefinition.js";
import MarkdownTableParser from "./MarkdownTableParser.js";


class DataDefinitionParser {


    constructor(){

        this.tableParser =
            new MarkdownTableParser();

    }



    parse(sectionText){


        if(!sectionText){

            return [];

        }



        const rows =
            this.tableParser.parse(
                sectionText
            );



        return rows.map(row => {


            const input =
                new InputDefinition();



            input.name =
                row["Trường"] || "";



            input.controlType =
                row["Control Type"] || "";



            input.source =
                row["Nguồn dữ liệu"] || "";



            input.required =
                this.parseRequired(
                    row["Bắt buộc"]
                );



            input.description =
                row["Mô tả"] || "";



            return input;


        });


    }





    parseRequired(value){


        if(!value){

            return false;

        }



        return (
            value.toLowerCase()
                 .includes("có")
        );


    }


}


export default DataDefinitionParser;