import DataDefinitionParser 
from "../src/parsers/DataDefinitionParser.js";


console.log("\n=================================");
console.log(" DATA DEFINITION PARSER TEST");
console.log("=================================\n");



const parser =
    new DataDefinitionParser();



const table = `

| Trường | Control Type | Nguồn dữ liệu | Bắt buộc | Mô tả |
|--------|--------------|---------------|----------|------|
| Mã thiết bị | TextBox | Người dùng nhập | Có | Mã duy nhất của thiết bị |
| Tên thiết bị | TextBox | Người dùng nhập | Có | Tên hiển thị của thiết bị |
| Loại thiết bị | Dropdown | Danh mục | Có | Chọn từ danh mục loại thiết bị |

`;



try {


    const result =
        parser.parse(table);



    console.log("Input Definitions:");

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
    console.log(" DATA DEFINITION TEST COMPLETED");
    console.log("=================================\n");


}
catch(error){


    console.error(
        "\nDATA DEFINITION ERROR:"
    );


    console.error(
        error.message
    );

}