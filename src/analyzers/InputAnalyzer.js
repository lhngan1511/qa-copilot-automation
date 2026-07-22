class InputAnalyzer {


    analyze(requirement, knowledge) {


        if(
            !requirement ||
            !knowledge
        ){

            return;

        }


        const inputs =
            requirement.inputDefinitions || [];



        inputs.forEach(
            input => {


                this.analyzeRequired(
                    input,
                    knowledge
                );


                this.analyzeControlType(
                    input,
                    knowledge
                );


                this.analyzeDescription(
                    input,
                    knowledge
                );


            }
        );


    }





    analyzeRequired(
        input,
        knowledge
    ){

        if(input.required){

            knowledge.validationRules.push(
                `${input.name} không được để trống`
            );


            knowledge.riskAreas.push(
                `Thiếu ${input.name}`
            );

        }

    }






    analyzeControlType(
        input,
        knowledge
    ){


        if(
            input.controlType === "Dropdown"
        ){

            knowledge.validationRules.push(
                `${input.name} phải chọn giá trị hợp lệ`
            );


            knowledge.riskAreas.push(
                `${input.name} không thuộc danh mục`
            );

        }


    }







    analyzeDescription(
        input,
        knowledge
    ){


        const description =
            (input.description || "")
            .toLowerCase();



        if(
            description.includes("duy nhất") ||
            description.includes("không trùng")
        ){

            knowledge.validationRules.push(
                `${input.name} phải duy nhất`
            );


            knowledge.dataIntegrityCases.push(
                `${input.name} bị trùng`
            );

        }


    }


}


export default InputAnalyzer;