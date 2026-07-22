import TestStep from "../models/TestStep.js";


class TestStepGenerator {


    generate(scenario) {


        if(!scenario){

            return [];

        }


        switch(scenario.type){


            case "POSITIVE":

                return this.generatePositiveSteps(
                    scenario
                );


            case "NEGATIVE":

                return this.generateNegativeSteps(
                    scenario
                );


            case "BOUNDARY":

                return this.generateBoundarySteps(
                    scenario
                );


            case "PERMISSION":

                return this.generatePermissionSteps(
                    scenario
                );


            case "DATA_INTEGRITY":

                return this.generateDataIntegritySteps(
                    scenario
                );


            default:

                return this.generateDefaultSteps(
                    scenario
                );

        }


    }





    generatePositiveSteps(scenario){


        return [

            this.createStep(
                1,
                `Mở chức năng ${scenario.feature}`,
                "Màn hình chức năng hiển thị"
            ),


            this.createStep(
                2,
                `Nhập dữ liệu hợp lệ cho: ${scenario.title}`,
                "Dữ liệu được chấp nhận"
            ),


            this.createStep(
                3,
                "Thực hiện lưu dữ liệu",
                "Hệ thống xử lý thành công"
            ),


            this.createStep(
                4,
                "Kiểm tra kết quả",
                "Dữ liệu được tạo thành công"

            )

        ];


    }





    generateNegativeSteps(scenario){


        return [

            this.createStep(
                1,
                `Mở chức năng ${scenario.feature}`,
                "Màn hình hiển thị"
            ),


            this.createStep(
                2,
                `Nhập dữ liệu không hợp lệ: ${scenario.title}`,
                "Dữ liệu được kiểm tra"
            ),


            this.createStep(
                3,
                "Thực hiện thao tác lưu",
                "Hệ thống từ chối dữ liệu"
            ),


            this.createStep(
                4,
                "Kiểm tra thông báo lỗi",
                "Thông báo lỗi hiển thị đúng"

            )

        ];


    }





    generateBoundarySteps(scenario){


        return [

            this.createStep(
                1,
                `Mở chức năng ${scenario.feature}`,
                "Màn hình hiển thị"
            ),


            this.createStep(
                2,
                `Nhập dữ liệu biên: ${scenario.title}`,
                "Hệ thống kiểm tra giới hạn"
            ),


            this.createStep(
                3,
                "Thực hiện lưu dữ liệu",
                "Validation được thực hiện"
            ),


            this.createStep(
                4,
                "Kiểm tra kết quả",
                "Thông báo giới hạn dữ liệu chính xác"

            )

        ];


    }





    generatePermissionSteps(scenario){


        return [

            this.createStep(
                1,
                "Đăng nhập bằng tài khoản không đủ quyền",
                "Đăng nhập thành công"
            ),


            this.createStep(
                2,
                `Truy cập chức năng ${scenario.feature}`,
                "Hệ thống kiểm tra quyền"
            ),


            this.createStep(
                3,
                "Thực hiện thao tác",
                "Hệ thống từ chối quyền truy cập"

            )

        ];


    }





    generateDataIntegritySteps(scenario){


        return [

            this.createStep(
                1,
                `Mở chức năng ${scenario.feature}`,
                "Màn hình hiển thị"
            ),


            this.createStep(
                2,
                `Nhập dữ liệu trùng: ${scenario.title}`,
                "Hệ thống phát hiện dữ liệu tồn tại"
            ),


            this.createStep(
                3,
                "Lưu dữ liệu",
                "Hệ thống không cho phép lưu"

            )

        ];


    }





    generateDefaultSteps(scenario){


        return [

            this.createStep(
                1,
                `Mở chức năng ${scenario.feature}`,
                "Màn hình hiển thị"
            ),


            this.createStep(
                2,
                scenario.title,
                "Hệ thống xử lý"
            ),


            this.createStep(
                3,
                "Kiểm tra kết quả",
                "Kết quả đúng mong đợi"
            )

        ];

    }





    createStep(
        order,
        action,
        expected
    ){

        const step =
            new TestStep();


        step.order =
            order;


        step.action =
            action;


        step.expected =
            expected;


        return step;

    }


}


export default TestStepGenerator;