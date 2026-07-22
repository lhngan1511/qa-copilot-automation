import MarkdownTableParser 
from "../src/parsers/MarkdownTableParser.js";



console.log("\n=================================");
console.log(" MARKDOWN TABLE PARSER TEST");
console.log("=================================\n");



const parser = new MarkdownTableParser();



const table = `

| Mã | Nội dung |
|----|----------|
| BR01 | Mã thiết bị không được trùng |
| BR02 | Không được bỏ trống các trường bắt buộc |

`;



try {


    const result =
        parser.parse(table);



    console.log("Parsed Result:");

    console.log(result);



    console.log("\nJSON:");

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );



    console.log("\n=================================");
    console.log(" TABLE PARSER TEST COMPLETED");
    console.log("=================================\n");


}
catch(error){


    console.error(
        "\nTABLE PARSER ERROR:"
    );


    console.error(
        error.message
    );


}