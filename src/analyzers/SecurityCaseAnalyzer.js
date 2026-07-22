class SecurityCaseAnalyzer {


    analyze(requirement, knowledge) {


        if(
            !requirement ||
            !knowledge
        ){

            return;

        }


        this.analyzeInputs(
            requirement,
            knowledge
        );


        this.analyzeActions(
            requirement,
            knowledge
        );


    }







    analyzeInputs(
        requirement,
        knowledge
    ){


        const inputs =
            requirement.inputDefinitions || [];



        inputs.forEach(
            input => {


                const name =
                    input.name.toLowerCase();



                if(
                    name.includes("mật khẩu") ||
                    name.includes("password")
                ){


                    knowledge.securityCases.push(
                        `${input.name} cần kiểm tra bảo mật`
                    );


                }



                if(
                    input.format === "HTML" ||
                    input.format === "TEXT"
                ){


                    knowledge.securityCases.push(
                        `${input.name} cần kiểm tra dữ liệu nhập nguy hiểm`
                    );


                }


            }
        );


    }







    analyzeActions(
        requirement,
        knowledge
    ){


        const actions =
            requirement.actions || [];



        actions.forEach(
            action => {


                const lower =
                    action.toLowerCase();



                if(
                    lower.includes("xóa") ||
                    lower.includes("delete")
                ){


                    knowledge.securityCases.push(
                        "Kiểm tra quyền xóa dữ liệu"
                    );


                }



                if(
                    lower.includes("sửa") ||
                    lower.includes("update")
                ){


                    knowledge.securityCases.push(
                        "Kiểm tra quyền chỉnh sửa dữ liệu"
                    );


                }


            }
        );


    }


}


export default SecurityCaseAnalyzer;