class PermissionCaseAnalyzer {


    analyze(requirement, knowledge) {


        if(
            !requirement ||
            !knowledge
        ){

            return;

        }


        this.analyzeConditions(
            requirement,
            knowledge
        );


        this.analyzeDescription(
            requirement,
            knowledge
        );


        this.analyzeActions(
            requirement,
            knowledge
        );


    }







    analyzeConditions(
        requirement,
        knowledge
    ){


        const conditions =
            requirement.conditions || [];



        conditions.forEach(
            condition => {


                const lower =
                    condition.toLowerCase();



                if(
                    lower.includes("quyền") ||
                    lower.includes("permission") ||
                    lower.includes("role")
                ){


                    knowledge.permissionCases.push(
                        `Kiểm tra ${condition}`
                    );


                }


            }
        );


    }








    analyzeDescription(
        requirement,
        knowledge
    ){


        const description =
            (requirement.purpose || "")
            .toLowerCase();



        if(
            description.includes("quản lý") ||
            description.includes("phân quyền")
        ){


            knowledge.permissionCases.push(
                "User không có quyền không được truy cập chức năng"
            );


        }


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
                    lower.includes("thêm")
                ){

                    knowledge.permissionCases.push(
                        "Kiểm tra quyền thêm dữ liệu"
                    );

                }



                if(
                    lower.includes("sửa")
                ){

                    knowledge.permissionCases.push(
                        "Kiểm tra quyền chỉnh sửa dữ liệu"
                    );

                }



                if(
                    lower.includes("xóa")
                ){

                    knowledge.permissionCases.push(
                        "Kiểm tra quyền xóa dữ liệu"
                    );

                }


            }
        );


    }


}


export default PermissionCaseAnalyzer;