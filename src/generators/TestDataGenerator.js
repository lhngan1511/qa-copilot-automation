import TestData from "../models/TestData.js";


class TestDataGenerator {


    generate(
        inputDefinitions,
        scenario = {}
    ) {


        const testData =
            new TestData();



        if (!Array.isArray(inputDefinitions)) {

            return testData;

        }



        const title =
            (scenario.title || "")
            .toLowerCase();



        const type =
            scenario.type || "";




        inputDefinitions.forEach(
            input => {


                const name =
                    input.name;



                /*
                 * Default valid data
                 */

                testData.inputs[name] =
                    this.generateValidValue(
                        input
                    );





                /*
                 * Negative case
                 */

                if (
                    type === "NEGATIVE"
                ) {


                    testData.invalid[name] =
                        this.generateInvalidValue(
                            input,
                            title
                        );


                }





                /*
                 * Boundary case
                 */

                if (
                    type === "BOUNDARY"
                ) {


                    testData.invalid[name] =
                        this.generateBoundaryValue(
                            input,
                            title
                        );


                }



            }
        );



        return testData;


    }









    generateValidValue(input) {


        switch(
            input.dataType
        ) {


            case "NUMBER":

                return 100;



            case "DATE":

                return "2026-01-01";



            case "EMAIL":

                return "test@example.com";



            default:

                return `${input.name}_TEST`;

        }


    }









    generateInvalidValue(
        input,
        title
    ) {



        /*
         * Duplicate data
         */

        if (
            title.includes("trùng") ||
            title.includes("tồn tại")
        ) {


            return `${input.name}_EXISTED`;


        }





        /*
         * Required validation
         */

        if (
            title.includes("thiếu") ||
            title.includes("bắt buộc") ||
            title.includes("trống") ||
            title.includes("không được để trống")
        ) {


            return "";


        }





        /*
         * Dropdown invalid
         */

        if (
            input.controlType === "Dropdown"
        ) {


            return "INVALID_OPTION";


        }





        /*
         * Default invalid
         */

        switch(
            input.dataType
        ) {


            case "NUMBER":

                return -1;



            case "EMAIL":

                return "abc";



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


            return this.getMinValue(
                input
            );


        }





        if (
            title.includes("vượt quá") ||
            title.includes("lớn hơn")
        ) {


            return this.getMaxValue(
                input
            );


        }




        return "";


    }









    getMinValue(input) {


        if (
            input.dataType === "NUMBER"
        ) {


            return (
                input.validation.minValue ?? 0
            );


        }



        if (
            input.validation.minLength
        ) {


            return "X".repeat(
                input.validation.minLength - 1
            );


        }



        return "";

    }









    getMaxValue(input) {


        if (
            input.dataType === "NUMBER"
        ) {


            return (
                input.validation.maxValue ?? 999999
            );


        }





        if (
            input.validation.maxLength
        ) {


            return "X".repeat(
                input.validation.maxLength + 1
            );


        }



        return "";

    }


}


export default TestDataGenerator;