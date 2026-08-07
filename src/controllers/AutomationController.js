export default class AutomationController {
    constructor({ service }) {
        if (!service) throw new Error("AutomationController cần service.");
        this.service = service;
    }

    async analyze(req, res) {
        try {
            const data = await this.service.analyze(req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return res.status(500).json({ success: false, data: null, error: { message: "Không thể phân tích dữ liệu bằng AI.", technical: error.message, diagnostic: "AI_MAPPING_FAILED" } });
        }
    }

    async generate(req, res) {
        try {
            const data = await this.service.generate(req.body ?? {});
            // Ưu tiên báo rõ lỗi truncation / encoding / syntax.
            if (data.guardError === "AI_CODEGEN_TRUNCATED") return res.status(200).json({ success: false, data, error: { message: "Mã AI sinh ra chưa hoàn chỉnh. Hãy sinh lại.", diagnostic: "AI_CODEGEN_TRUNCATED" } });
            // Recording không có assertion thành công cho TC POSITIVE -> không được bịa assertion.
            if (data.guardError === "ASSERTION_MAPPING_REQUIRED") return res.status(200).json({ success: false, data, error: { code: "ASSERTION_MAPPING_REQUIRED", message: "Chưa có điều kiện xác nhận phù hợp với kết quả mong đợi.", diagnostic: "ASSERTION_MAPPING_REQUIRED" } });
            if (data.guardError) return res.status(200).json({ success: false, data, error: { message: data.guardReason || "Mã AI sinh ra không hợp lệ. Hãy sinh lại.", diagnostic: data.guardError } });
            if (!data.validation?.ok) return res.status(200).json({ success: false, data, error: { message: "Sinh mã kiểm thử không thành công: " + (data.errors?.join("; ") || data.errorMessage || ""), diagnostic: data.errorCode || "AI_CODEGEN_REJECTED", details: data.errors || [] } });
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return res.status(500).json({ success: false, data: null, error: { message: "Sinh mã kiểm thử không thành công.", technical: error.message, diagnostic: "AI_CODEGEN_FAILED" } });
        }
    }

    async run(req, res) {
        try {
            const data = await this.service.run(req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return res.status(500).json({ success: false, data: null, error: { message: "Testcase thất bại tại bước thực thi.", technical: error.message, diagnostic: "PLAYWRIGHT_RUN_FAILED" } });
        }
    }

    async export(req, res) {
        try {
            const data = await this.service.exportSelected(req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return res.status(500).json({ success: false, data: null, error: { message: "Không thể xuất testcase đã chọn.", technical: error.message, diagnostic: "EXPORT_FAILED" } });
        }
    }
}
