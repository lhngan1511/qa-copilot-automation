import fs from "fs";
import path from "path";
import XLSX from "xlsx";


class ExcelExporter {


    export(
        testCases = [],
        outputPath
    ){



        if(
            !Array.isArray(testCases)
        ){

            testCases = [];

        }






        const rows =
            testCases.map(
                (tc,index)=>({



                    "STT":
                        index + 1,



                    "Test Case ID":
                        tc.id || "",



                    "Module":
                        tc.module || "",



                    "Chức năng":
                        tc.feature || "",



                    "Mục tiêu kiểm thử":
                        tc.testObjective || "",



                    "Tình huống kiểm tra":
                        tc.testScenario || "",



                    "Điều kiện trước":
                        this.arrayToText(
                            tc.preconditions
                        ),





                    "Dữ liệu đầu vào":
                        this.objectToText(
                            tc.testData
                        ),






                    "Bước thực hiện":
                        this.stepsToText(
                            tc.steps
                        ),






                    "Kết quả mong đợi":
                        this.arrayToText(
                            tc.expectedResults
                        ),





                    "Kết quả thực tế":
                        tc.actualResult || "",





                    "Trạng thái":
                        tc.status || "Not Tested",





                    "Priority":
                        tc.priority || "",





                    "Severity":
                        tc.severity || "",





                    "Automation":
                        tc.automation?.candidate
                        ?
                        "Yes"
                        :
                        "No"




                })
            );








        const worksheet =
            XLSX.utils.json_to_sheet(
                rows
            );







        worksheet["!cols"] = [


            {wch:5},

            {wch:15},

            {wch:15},

            {wch:20},

            {wch:35},

            {wch:40},

            {wch:30},

            {wch:40},

            {wch:60},

            {wch:45},

            {wch:20},

            {wch:15},

            {wch:12},

            {wch:12},

            {wch:12}

        ];








        const workbook =
            XLSX.utils.book_new();






        XLSX.utils.book_append_sheet(

            workbook,

            worksheet,

            "TestCases"

        );








        const folder =
            path.dirname(
                outputPath
            );




        if(
            !fs.existsSync(folder)
        ){

            fs.mkdirSync(
                folder,
                {
                    recursive:true
                }
            );

        }







        XLSX.writeFile(

            workbook,

            outputPath

        );






        return outputPath;


    }









    arrayToText(value){


        if(
            !Array.isArray(value)
        ){

            return value || "";

        }



        return value.join(
            "\n"
        );


    }









    stepsToText(
        steps
    ){



        if(
            !Array.isArray(steps)
        ){

            return "";

        }




        return steps.map(
            step =>
            `${step.order}. ${step.action}\n`+
            `Expected: ${step.expected}`
        )
        .join("\n\n");



    }









    objectToText(
        data
    ){



        if(!data)
            return "";



        let result = "";




        if(data.valid){


            result +=
            "Valid:\n";


            Object.entries(
                data.valid
            )
            .forEach(
                ([k,v])=>{

                    result +=
                    `${k}: ${v}\n`;

                }
            );


        }






        if(data.invalid){


            result +=
            "\nInvalid:\n";



            Object.entries(
                data.invalid
            )
            .forEach(
                ([k,v])=>{


                    result +=
                    `${k}: ${v}\n`;


                }
            );


        }





        return result;


    }



}


export default ExcelExporter;