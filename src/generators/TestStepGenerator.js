import TestStep from "../models/TestStep.js";

class TestStepGenerator {

    generate(scenario) {

        const steps = [];

        steps.push(
            this.createStep(
                1,
                "Mở chức năng " + scenario.feature,
                "Màn hình được hiển thị"
            )
        );

        steps.push(
            this.createStep(
                2,
                "Thực hiện tình huống: " + scenario.title,
                "Dữ liệu được xử lý"
            )
        );

        steps.push(
            this.createStep(
                3,
                "Kiểm tra kết quả",
                "Đúng với kết quả mong đợi"
            )
        );

        return steps;

    }

    createStep(order, action, expected) {

        const step = new TestStep();

        step.order = order;
        step.action = action;
        step.expected = expected;

        return step;

    }

}

export default TestStepGenerator;