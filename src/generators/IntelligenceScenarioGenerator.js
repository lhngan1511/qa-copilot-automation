import TestScenario from "../models/TestScenario.js";

class IntelligenceScenarioGenerator {

    constructor() {

        this.counter = 1;

    }

    generate(aiResult) {

        if (
            !aiResult ||
            !Array.isArray(aiResult.suggestedScenarios)
        ) {

            return [];

        }

        return aiResult.suggestedScenarios.map(title => {

            const scenario = new TestScenario();

            scenario.id =
                `SC${String(this.counter++).padStart(3, "0")}`;

            scenario.feature =
                aiResult.featureUnderstanding || "";

            scenario.title =
                title;

            scenario.type =
                this.detectType(title);

            scenario.reason = "";

            scenario.riskLevel =
                scenario.type === "NEGATIVE"
                    ? "High"
                    : "Medium";

            scenario.riskCategory =
                this.detectRiskCategory(title);

            scenario.requirementReference =
                aiResult.featureUnderstanding || "";

            scenario.requirementType =
                scenario.type;

            scenario.preconditions = [];

            scenario.testData = null;

            scenario.steps =
                this.generateSteps(
                    scenario
                );

            scenario.expectedResults = [

                this.generateExpectedResult(
                    scenario
                )

            ];

            scenario.severity =
                scenario.riskLevel;

            scenario.priority =
                scenario.riskLevel;

            scenario.automationCandidate =
                true;

            return scenario;

        });

    }

    detectType(title) {

        const negativeKeywords = [

            "không",
            "trùng",
            "thiếu",
            "sai",
            "tồn tại",
            "vượt",
            "lỗi",
            "để trống"

        ];

        const lower =
            title.toLowerCase();

        return negativeKeywords.some(
            keyword => lower.includes(keyword)
        )
            ? "NEGATIVE"
            : "POSITIVE";

    }

    detectRiskCategory(title) {

        const lower =
            title.toLowerCase();

        if (
            lower.includes("trùng")
        ) {

            return "Business Rule";

        }

        if (
            lower.includes("không") ||
            lower.includes("trống")
        ) {

            return "Validation";

        }

        return "General";

    }

    generateSteps(scenario) {

        if (
            scenario.type === "NEGATIVE"
        ) {

            return [

                {
                    order: 1,
                    action: "Mở chức năng",
                    expected: "Màn hình hiển thị"
                },

                {
                    order: 2,
                    action: `Nhập dữ liệu lỗi: ${scenario.title}`,
                    expected: "Hệ thống kiểm tra dữ liệu"
                },

                {
                    order: 3,
                    action: "Thực hiện lưu",
                    expected: "Hệ thống từ chối dữ liệu"
                }

            ];

        }

        return [

            {
                order: 1,
                action: "Mở chức năng",
                expected: "Màn hình hiển thị"
            },

            {
                order: 2,
                action: `Thực hiện ${scenario.title}`,
                expected: "Dữ liệu được xử lý"
            },

            {
                order: 3,
                action: "Kiểm tra kết quả",
                expected: "Kết quả đúng yêu cầu"
            }

        ];

    }

    generateExpectedResult(scenario) {

        if (
            scenario.type === "NEGATIVE"
        ) {

            return "Hệ thống từ chối dữ liệu không hợp lệ";

        }

        return "Hệ thống xử lý thành công";

    }

}

export default IntelligenceScenarioGenerator;