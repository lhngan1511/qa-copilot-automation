class BoundaryAnalyzer {


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


                this.analyzeLength(
                    input,
                    knowledge
                );


                this.analyzeValue(
                    input,
                    knowledge
                );


            }
        );


    }





    analyzeLength(
        input,
        knowledge
    ){


        if(input.minLength !== undefined){


            knowledge.boundaryCases.push(
                `${input.name} nhỏ hơn độ dài tối thiểu`
            );


        }



        if(input.maxLength !== undefined){


            knowledge.boundaryCases.push(
                `${input.name} vượt quá độ dài tối đa`
            );


        }


    }






    analyzeValue(
        input,
        knowledge
    ){


        if(input.minValue !== undefined){


            knowledge.boundaryCases.push(
                `${input.name} nhỏ hơn giá trị tối thiểu`
            );


        }



        if(input.maxValue !== undefined){


            knowledge.boundaryCases.push(
                `${input.name} lớn hơn giá trị tối đa`
            );


        }


    }


}


export default BoundaryAnalyzer;