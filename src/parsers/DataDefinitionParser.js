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



            // ==============================
            // Tên field
            // ==============================

            input.name =
                row["Trường"]
                || row["Field"]
                || row["Tên"]
                || "";



            // ==============================
            // Loại control UI
            // ==============================

            input.controlType =
                row["Control Type"]
                || row["Control"]
                || row["Kiểu điều khiển"]
                || "";



            // ==============================
            // Nguồn dữ liệu
            // ==============================

            input.source =
                row["Nguồn dữ liệu"]
                || row["Source"]
                || "";



            // ==============================
            // Required
            // ==============================

            input.required =
                this.parseRequired(
                    row["Bắt buộc"]
                    || row["Required"]
                );



            // ==============================
            // Description
            // ==============================

            input.description =
                row["Mô tả"]
                || row["Description"]
                || "";



            // ==============================
            // Format / Validation
            // ==============================

            input.format =
                row["Format"]
                || row["Định dạng"]
                || "";



            input.minLength =
                this.parseNumber(
                    row["Min Length"]
                    || row["Độ dài tối thiểu"]
                );



            input.maxLength =
                this.parseNumber(
                    row["Max Length"]
                    || row["Độ dài tối đa"]
                );



            input.minValue =
                this.parseNumber(
                    row["Min Value"]
                    || row["Giá trị tối thiểu"]
                );



            input.maxValue =
                this.parseNumber(
                    row["Max Value"]
                    || row["Giá trị tối đa"]
                );



            return input;


        });


    }





    parseRequired(value){


        if(!value){

            return false;

        }



        const text =
            value
                .toString()
                .toLowerCase();



        return (

            text.includes("có")
            ||
            text.includes("yes")
            ||
            text.includes("true")
            ||
            text.includes("*")

        );


    }





    parseNumber(value){


        if(
            value === undefined
            ||
            value === null
            ||
            value === ""
        ){

            return null;

        }



        const number =
            Number(value);



        return Number.isNaN(number)
            ? null
            : number;


    }


}


export default DataDefinitionParser;