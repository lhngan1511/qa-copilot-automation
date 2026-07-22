import RequirementObject from "../models/RequirementObject.js";
import MarkdownTableParser from "./MarkdownTableParser.js";
import DataDefinitionParser from "./DataDefinitionParser.js";

class MarkdownParser {


    constructor(){

    this.tableParser =
        new MarkdownTableParser();


    this.dataDefinitionParser =
        new DataDefinitionParser();

}



    parse(markdown) {


        const requirement = new RequirementObject();



        requirement.feature =
            this.extractTitle(markdown);



        requirement.purpose =
            this.extractSection(
                markdown,
                "Mục đích trang"
            );



        requirement.businessRules =
            this.extractBusinessRules(markdown);



        requirement.expectedResults =
            this.extractListSection(
                markdown,
                "Kết quả mong đợi"
            );



        requirement.edgeCases =
            this.extractEdgeCases(markdown);


        requirement.inputDefinitions =
            this.extractDataDefinitions(markdown);



        return requirement;

    }




    extractBusinessRules(markdown){


        const section =
            this.extractSection(
                markdown,
                "Quy tắc nghiệp vụ"
            );


        if(!section){

            return [];

        }


        // Xử lý Markdown Table

        if(section.includes("|")){


            const rows =
                this.tableParser.parse(section);



            return rows
                .map(row => row["Nội dung"])
                .filter(Boolean);


        }



        return this.extractListSection(
            markdown,
            "Quy tắc nghiệp vụ"
        );

    }





    extractEdgeCases(markdown){


        const section =
            this.extractSection(
                markdown,
                "Trường hợp ngoại lệ"
            );


        if(!section){

            return [];

        }



        // Xử lý Markdown Table

        if(section.includes("|")){


            const rows =
                this.tableParser.parse(section);



            return rows
                .map(row => row["Nội dung"])
                .filter(Boolean);


        }



        return this.extractListSection(
            markdown,
            "Trường hợp ngoại lệ"
        );

    }



    extractDataDefinitions(markdown){


    const section =
        this.extractSection(
            markdown,
            "Dữ liệu dùng chung"
        );


    if(!section){

        return [];

    }


    if(section.includes("|")){


        return this.dataDefinitionParser.parse(
            section
        );


    }


    return [];

    }

    extractTitle(markdown) {


        const match =
            markdown.match(/^# (.+)$/m);



        return match
            ? match[1].trim()
            : "";

    }





    extractSection(markdown, title) {


        const regex =
            new RegExp(
                `## ${title}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`
            );



        const match =
            markdown.match(regex);



        return match
            ? match[1].trim()
            : "";

    }





    extractListSection(markdown, title) {


        const content =
            this.extractSection(
                markdown,
                title
            );



        if(!content){

            return [];

        }



        return content
            .split("\n")
            .map(line =>
                line
                    .replace(/^[-*]\s*/, "")
                    .trim()
            )
            .filter(line =>
                line &&
                line !== "--" &&
                line !== "---"
            );

    }


}


export default MarkdownParser;