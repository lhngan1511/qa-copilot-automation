export default class CodeGenController {
    constructor({ manager }) {
        if (!manager) throw new Error("CodeGenController cần manager.");
        this.manager = manager;
    }

    async start(req, res) {
        try {
            const data = await this.manager.start(req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_START_FAILED", "Không thể bắt đầu ghi CodeGen.");
        }
    }

    async stop(req, res) {
        try {
            const data = await this.manager.stop(req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 409, "CODE_GEN_STOP_FAILED", "Không thể dừng phiên ghi CodeGen.");
        }
    }

    async status(req, res) {
        try {
            const data = this.manager.getStatus();
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "CODE_GEN_STATUS_FAILED", "Không thể đọc trạng thái CodeGen.");
        }
    }

    async save(req, res) {
        try {
            const data = await this.manager.saveScript(req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_SAVE_FAILED", "Không thể lưu script.");
        }
    }

    async run(req, res) {
        try {
            const data = await this.manager.run(req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_RUN_FAILED", "Không thể chạy thử script.");
        }
    }

    async cleanup(req, res) {
        try {
            const data = await this.manager.dispose();
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "CODE_GEN_CLEANUP_FAILED", "Không thể dọn dữ liệu CodeGen.");
        }
    }

    fail(res, error, status, diagnostic, fallbackMessage) {
        const statusCode =
            Number.isInteger(error?.statusCode) && error.statusCode >= 400
                ? error.statusCode
                : status;
        return res.status(statusCode).json({
            success: false,
            data: null,
            error: {
                code: error?.code ?? diagnostic,
                message: error?.message ?? fallbackMessage,
                diagnostic,
                technical: error?.message ?? ""
            }
        });
    }
}
