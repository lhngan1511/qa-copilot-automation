import TestData from "../models/TestData.js";


class TestDataGenerator {


    generate(
        inputDefinitions = [],
        scenario = {}
    ) {


        const testData =
            new TestData();



        if (
            !Array.isArray(inputDefinitions)
        ) {

            return testData;

        }



        const title =
            (scenario.title || "")
            .toLowerCase();



        const type =
            scenario.type || "";




        inputDefinitions.forEach(input => {



            const name =
                this.resolveName(input);



            if (!name) {

                return;

            }




            testData.inputs[name] =
                this.generateValidValue(
                    input,
                    name
                );





            if (

                [
                    "NEGATIVE",
                    "SECURITY",
                    "PERMISSION",
                    "DATA_INTEGRITY"

                ].includes(type)

            ) {



                testData.invalid[name] =
                    this.generateInvalidValue(
                        input,
                        title,
                        name
                    );


            }






            if (
                type === "BOUNDARY"
            ) {



                testData.invalid[name] =
                    this.generateBoundaryValue(
                        input,
                        title
                    );


            }



        });




        return testData;



    }









    resolveName(input) {


        return (

            input.name
            ||
            input.field
            ||
            input.label
            ||
            input.controlName
            ||
            input.key
            ||
            null

        );


    }









    getDataType(input) {


        return (

            input.dataType
            ||
            input.type
            ||
            "STRING"

        )
        .toUpperCase();


    }









    generateValidValue(
        input,
        name
    ) {


        const type =
            this.getDataType(input);




        switch(type) {


            case "NUMBER":

                return 100;




            case "DATE":

                return "2026-01-01";




            case "EMAIL":

                return "test@example.com";




            case "PHONE":

                return "0900000000";




            default:

                return `${name}_TEST`;


        }


    }









    generateInvalidValue(
        input,
        title,
        name
    ) {



        if (

            title.includes("trùng")
            ||
            title.includes("tồn tại")
            ||
            title.includes("đã tồn tại")

        ) {



            return `${name}_EXISTED`;

        }








        if (

            title.includes("trống")
            ||
            title.includes("bắt buộc")
            ||
            title.includes("thiếu")

        ) {



            return "";

        }








        const type =
            this.getDataType(input);




        switch(type) {


            case "NUMBER":

                return -1;




            case "EMAIL":

                return "invalid";




            case "DATE":

                return "invalid-date";




            case "PHONE":

                return "invalid-phone";




            default:

                return "";


        }


    }









    generateBoundaryValue(
        input,
        title
    ) {


        if (
            title.includes("nhỏ hơn")
        ) {


            return this.getMinValue(input);


        }




        if (

            title.includes("lớn hơn")
            ||
            title.includes("vượt quá")

        ) {


            return this.getMaxValue(input);


        }



        return "";


    }









    getMinValue(input) {


        if (

            this.getDataType(input)
            ===
            "NUMBER"

        ) {


            return (

                input.validation?.minValue
                ??
                input.minValue
                ??
                0

            );


        }



        return "";


    }









    getMaxValue(input) {


        if (

            this.getDataType(input)
            ===
            "NUMBER"

        ) {


            return (

                input.validation?.maxValue
                ??
                input.maxValue
                ??
                999999

            );


        }



        return "";


    }


}


export default TestDataGenerator;