import ScenarioTemplate from "../models/ScenarioTemplate.js";

class ScenarioTemplateRepository {

    constructor() {

        this.templates = {

            POSITIVE: this.createPositive(),

            NEGATIVE: this.createNegative(),

            BOUNDARY: this.createBoundary(),

            SECURITY: this.createSecurity(),

            PERMISSION: this.createPermission(),

            DATA_INTEGRITY: this.createDataIntegrity()

        };

    }

    getTemplate(type) {

        return this.templates[type] ||
               this.templates.POSITIVE;

    }

    createPositive() {

        const t = new ScenarioTemplate();

        t.preconditions = [

            "Người dùng đã đăng nhập"

        ];

        t.steps = [

            "Mở chức năng",

            "Nhập dữ liệu hợp lệ",

            "Nhấn Lưu"

        ];

        t.expectedResults = [

            "Hệ thống lưu thành công"

        ];

        return t;

    }

    createNegative() {

        const t = new ScenarioTemplate();

        t.preconditions = [

            "Người dùng đã đăng nhập"

        ];

        t.steps = [

            "Mở chức năng",

            "Nhập dữ liệu không hợp lệ",

            "Nhấn Lưu"

        ];

        t.expectedResults = [

            "Hệ thống hiển thị lỗi"

        ];

        return t;

    }

    createBoundary() {

        const t = new ScenarioTemplate();

        t.expectedResults = [

            "Boundary được xử lý đúng"

        ];

        return t;

    }

    createSecurity() {

        return new ScenarioTemplate();

    }

    createPermission() {

        return new ScenarioTemplate();

    }

    createDataIntegrity() {

        return new ScenarioTemplate();

    }

}

export default ScenarioTemplateRepository;