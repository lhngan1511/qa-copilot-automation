class BoundaryAnalyzer {


    analyze(requirement, knowledge) {


        if(!requirement || !knowledge){
            return;
        }


        const inputs =
            requirement.inputDefinitions || [];



        inputs.forEach(input => {


            this.analyzeLength(
                input,
                knowledge
            );


            this.analyzeValue(
                input,
                knowledge
            );


        });


    }





    analyzeLength(input, knowledge){


        const validation =
            input.validation || {};



        if(validation.minLength !== null){


            knowledge.boundaryCases.push(
                `${input.name} nhỏ hơn độ dài tốiểu`
            );


        }



        if(validation.maxLength !== null){


            knowledge.boundaryCases.push(
                `${input.name} vượt quá độ dài tối đa`
            );


        }


    }







    analyzeValue(input, knowledge){


        const validation =
            input.validation || {};



        if(validation.minValue !== null){


            knowledge.boundaryCases.push(
                `${input.name} nhỏ hơn giá trị tối thiểu`
            );


        }



        if(validation.maxValue !== null){


            knowledge.boundaryCases.push(
                `${input.name} lớn hơn giá trị tối đa`
            );


        }


    }


}


export default BoundaryAnalyzer;